import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { DEMO_PASSWORD, DEMO_USERS, loginAs } from './helpers/auth';

const API_URL = 'http://localhost:3000';

/**
 * The destination select starts empty on purpose: Radix clears a controlled
 * value that has no mounted item, so the resident always picks explicitly.
 */
async function pickDestination(page: Page) {
  await page.locator('#resident-destination').click();
  const home = page.getByRole('option', { name: /A-101/ });
  if ((await home.count()) > 0) {
    await home.first().click();
    return;
  }
  await page.locator('[role="option"]:not([aria-disabled="true"])').first().click();
}

async function residentToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: DEMO_USERS.resident, password: DEMO_PASSWORD },
  });
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

/** Revokes the passes this test created so the demo history stays readable. */
async function revokePasses(request: APIRequestContext, lastName: string) {
  const token = await residentToken(request);
  const response = await request.get(
    `${API_URL}/api/passes?search=${encodeURIComponent(lastName)}&pageSize=50`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const body = (await response.json()) as Array<{ id: string }> | { data: Array<{ id: string }> };
  const rows = Array.isArray(body) ? body : body.data;
  for (const row of rows) {
    await request.post(`${API_URL}/api/passes/${row.id}/revoke`, {
      headers: { authorization: `Bearer ${token}` },
    });
  }
}

async function adminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: DEMO_USERS.orgAdmin, password: DEMO_PASSWORD },
  });
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

function unwrap<T>(body: T[] | { data: T[] }): T[] {
  return Array.isArray(body) ? body : body.data;
}

/**
 * Creates a throwaway common-area section so the resident form can offer it and
 * the test can archive it while the form is already open.
 */
async function createCommonArea(request: APIRequestContext, name: string) {
  const token = await adminToken(request);
  const headers = { authorization: `Bearer ${token}` };

  const communitiesResponse = await request.get(`${API_URL}/api/communities`, { headers });
  const communities = unwrap(
    (await communitiesResponse.json()) as Array<{ id: string; name: string }>,
  );
  const community = communities.find((item) => item.name === 'Torre Norte');
  if (!community) throw new Error('No se encontró la comunidad Torre Norte');

  const structuresResponse = await request.get(
    `${API_URL}/api/location-structures?communityId=${community.id}`,
    { headers },
  );
  const structures = unwrap((await structuresResponse.json()) as Array<{ id: string }>);
  const structure = structures[0];
  if (!structure) throw new Error('Torre Norte no tiene estructura');

  const created = await request.post(`${API_URL}/api/location-units`, {
    headers,
    data: {
      communityId: community.id,
      structureId: structure.id,
      name,
      sectionType: 'common_area',
      sectionTypeLabel: 'Zona común',
    },
  });
  if (!created.ok()) throw new Error(`No se pudo crear la zona de prueba: ${created.status()}`);
  const node = (await created.json()) as { id: string };

  return {
    nodeId: node.id,
    archive: () => request.post(`${API_URL}/api/location-units/${node.id}/archive`, { headers }),
    remove: async () => {
      const deleted = await request.delete(`${API_URL}/api/location-units/${node.id}`, {
        headers,
      });
      if (!deleted.ok()) {
        await request.post(`${API_URL}/api/location-units/${node.id}/restore`, { headers });
        await request.delete(`${API_URL}/api/location-units/${node.id}`, { headers });
      }
    },
  };
}

test.describe('resident workspace', () => {
  test('resident lands on the workspace instead of the app-required screen', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);

    await expect(page).toHaveURL(/\/resident$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis autorizaciones' })).toBeVisible();
    await expect(page.getByText('Usá Zima QR Access')).toHaveCount(0);
  });

  test('sidebar only offers the resident entries', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);

    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebar.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Autorizaciones' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Autorizar', exact: true })).toBeVisible();

    await expect(sidebar.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Unidades' })).toHaveCount(0);
  });

  test('home offers the quick actions and the empty state', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);

    await expect(page.getByRole('link', { name: /Autorizar una visita/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Historial/i })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('authorization form loads the authorizable destinations', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);
    await page.goto('/resident/authorizations/new');

    await expect(page.getByRole('heading', { level: 1, name: 'Autorizar visita' })).toBeVisible();
    await expect(page.locator('#resident-visitor-first')).toBeVisible();
    await expect(page.locator('#resident-valid-from')).toBeVisible();

    // The destination select is populated from /api/passes/destinations.
    await page.locator('#resident-destination').click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('history route renders inside the resident shell', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);
    await page.goto('/resident/authorizations');

    await expect(page.getByRole('heading', { level: 1, name: 'Autorizaciones' })).toBeVisible();
  });

  test('the form reviews the data before creating and keeps it when going back', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);
    await page.goto('/resident/authorizations/new');

    await page.locator('#resident-visitor-first').fill('QA');
    await page.locator('#resident-visitor-last').fill('Confirmación');
    await page.locator('#resident-visitor-document').fill('99000111');
    await pickDestination(page);

    await page.getByRole('button', { name: 'Revisar autorización' }).click();

    await expect(
      page.getByRole('heading', { level: 2, name: 'Revisá la autorización' }),
    ).toBeVisible();
    await expect(page.getByText('QA Confirmación')).toBeVisible();
    await expect(page.getByText('99000111')).toBeVisible();
    await expect(page.getByText('No ingresa en vehículo')).toBeVisible();
    await expect(page.getByText('Solo ingreso')).toBeVisible();

    // Going back keeps every entered value.
    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.locator('#resident-visitor-first')).toHaveValue('QA');
    await expect(page.locator('#resident-visitor-last')).toHaveValue('Confirmación');
    await expect(page.locator('#resident-visitor-document')).toHaveValue('99000111');
  });

  test('a short validity window is reported on the window field', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);
    await page.goto('/resident/authorizations/new');

    await page.locator('#resident-visitor-first').fill('QA');
    await page.locator('#resident-visitor-last').fill('Ventana');
    await page.locator('#resident-visitor-document').fill('99000222');
    await pickDestination(page);
    await page.locator('#resident-valid-until').fill('2020-01-01T10:00');

    await page.getByRole('button', { name: 'Revisar autorización' }).click();

    await expect(page.getByText('La vigencia debe terminar después de empezar.')).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Revisá la autorización' }),
    ).toHaveCount(0);
  });

  test('confirming creates the authorization and the history lists it without reloading', async ({
    page,
    request,
  }) => {
    const lastName = `Historial${Date.now()}`;

    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);
    await page.goto('/resident/authorizations/new');

    await page.locator('#resident-visitor-first').fill('QA');
    await page.locator('#resident-visitor-last').fill(lastName);
    await page.locator('#resident-visitor-document').fill('99000333');
    await pickDestination(page);

    await page.getByRole('button', { name: 'Revisar autorización' }).click();

    try {
      await page.getByRole('button', { name: 'Confirmar y autorizar' }).click();

      // Client-side navigation, so the history fetches again on mount.
      await expect(page).toHaveURL(/\/resident\/authorizations$/);
      await expect(page.getByText(lastName)).toBeVisible();
    } finally {
      await revokePasses(request, lastName);
    }
  });

  test('an archived destination is reported on the destination field', async ({
    page,
    request,
  }) => {
    const nodeName = `Zona QA ${Date.now()}`;
    const zone = await createCommonArea(request, nodeName);

    try {
      await loginAs(page, DEMO_USERS.resident);
      await expect(page).toHaveURL(/\/resident$/);
      await page.goto('/resident/authorizations/new');

      await page.locator('#resident-destination').click();
      await page.getByRole('option', { name: nodeName, exact: true }).click();

      await page.locator('#resident-visitor-first').fill('QA');
      await page.locator('#resident-visitor-last').fill('Archivada');
      await page.locator('#resident-visitor-document').fill('99000444');

      await page.getByRole('button', { name: 'Revisar autorización' }).click();
      await expect(
        page.getByRole('heading', { level: 2, name: 'Revisá la autorización' }),
      ).toBeVisible();

      // The admin archives the zone while the resident is on the summary step.
      const archived = await zone.archive();
      expect(archived.ok()).toBe(true);

      await page.getByRole('button', { name: 'Confirmar y autorizar' }).click();

      await expect(
        page.getByText('Ese destino se archivó y ya no recibe autorizaciones. Elegí otro.'),
      ).toBeVisible();
      // The form came back with the visitor data still there.
      await expect(page.locator('#resident-visitor-first')).toHaveValue('QA');
    } finally {
      await zone.remove();
    }
  });

  test('mobile viewport has no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);

    await page.goto('/resident/authorizations/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Autorizar visita' })).toBeVisible();

    const formFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(formFits).toBe(true);
  });
});

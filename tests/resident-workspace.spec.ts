import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { DEMO_PASSWORD, DEMO_USERS, loginAs, logoutFromUserMenu } from './helpers/auth';

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
      page.getByRole('heading', { level: 2, name: 'Revisa la autorización' }),
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
      page.getByRole('heading', { level: 2, name: 'Revisa la autorización' }),
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
        page.getByRole('heading', { level: 2, name: 'Revisa la autorización' }),
      ).toBeVisible();

      // The admin archives the zone while the resident is on the summary step.
      const archived = await zone.archive();
      expect(archived.ok()).toBe(true);

      await page.getByRole('button', { name: 'Confirmar y autorizar' }).click();

      await expect(
        page.getByText('Ese destino se archivó y ya no recibe autorizaciones. Elige otro.'),
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

/** The resident's own home destination, required to create passes through the API. */
async function homeDestination(request: APIRequestContext) {
  const token = await residentToken(request);
  const response = await request.get(`${API_URL}/api/passes/destinations`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const rows = unwrap(
    (await response.json()) as Array<{ id: string; name: string; path: string; kind: string }>,
  );
  const home = rows.find((row) => row.kind === 'home');
  if (!home) throw new Error('El residente demo no tiene una vivienda asociada');
  return home;
}

interface CreatePassInput {
  lastName: string;
  document: string;
  /** ISO timestamps; defaults to a window that starts now and lasts an hour. */
  validFrom?: string;
  validUntil?: string;
  batchLabel?: string;
}

/** Creates a pass through the API so each test controls the window it needs. */
async function createPassViaApi(request: APIRequestContext, input: CreatePassInput) {
  const token = await residentToken(request);
  const destination = await homeDestination(request);
  const now = Date.now();
  const response = await request.post(`${API_URL}/api/passes`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      locationUnitId: destination.id,
      visitorFirstName: 'QA',
      visitorLastName: input.lastName,
      visitorDocument: input.document,
      type: 'entry_exit',
      validFrom: input.validFrom ?? new Date(now).toISOString(),
      validUntil: input.validUntil ?? new Date(now + 60 * 60 * 1000).toISOString(),
    },
  });
  if (!response.ok()) throw new Error(`No se pudo crear el pase: ${response.status()}`);
  const body = (await response.json()) as {
    pass: { id: string };
    shareUrl: string;
  };
  return { id: body.pass.id, shareUrl: body.shareUrl };
}

/** Creates a batch of passes and returns the label used to filter them. */
async function createBatchViaApi(request: APIRequestContext, label: string, documents: string[]) {
  const token = await residentToken(request);
  const destination = await homeDestination(request);
  const now = Date.now();
  const response = await request.post(`${API_URL}/api/passes/batch`, {
    headers: { authorization: `Bearer ${token}` },
    data: {
      destination: destination.id,
      type: 'entry_exit',
      validFrom: new Date(now).toISOString(),
      validUntil: new Date(now + 60 * 60 * 1000).toISOString(),
      batchLabel: label,
      visitors: documents.map((document, index) => ({
        firstName: `Lote${index + 1}`,
        lastName: label,
        document,
      })),
    },
  });
  if (!response.ok()) throw new Error(`No se pudo crear el lote: ${response.status()}`);
  return (await response.json()) as { batchId: string; batchLabel: string; createdCount: number };
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

async function openHistory(page: Page, search?: string) {
  await loginAs(page, DEMO_USERS.resident);
  await expect(page).toHaveURL(/\/resident$/);
  await page.goto('/resident/authorizations');
  await expect(page.getByRole('heading', { level: 1, name: 'Autorizaciones' })).toBeVisible();
  if (search) {
    await page.getByPlaceholder('Buscar autorizaciones').fill(search);
  }
}

test.describe('resident authorization history', () => {
  test('lists the visitor, the destination, the window and the state', async ({
    page,
    request,
  }) => {
    const lastName = `Tabla${Date.now()}`;
    await createPassViaApi(request, { lastName, document: '99100001' });

    try {
      await openHistory(page, lastName);

      await expect(page.getByRole('columnheader', { name: 'Visitante' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Destino' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Vigencia' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Acciones' })).toBeVisible();

      const row = page.locator('tbody tr').filter({ hasText: lastName }).first();
      await expect(row).toBeVisible();
      await expect(row.getByText('Vivienda')).toBeVisible();
      await expect(row.getByText('A-101')).toBeVisible();
      await expect(row.getByText('Activa')).toBeVisible();
      await expect(row.getByText('99100001')).toBeVisible();
    } finally {
      await revokePasses(request, lastName);
    }
  });

  test('an active pass past its window reads as Vencida and loses its actions', async ({
    page,
    request,
  }) => {
    const lastName = `Vencida${Date.now()}`;
    await createPassViaApi(request, {
      lastName,
      document: '99100002',
      validFrom: daysAgo(2),
      validUntil: daysAgo(1),
    });

    try {
      await openHistory(page, lastName);
      const visitor = `QA ${lastName}`;
      const row = page.locator('tbody tr').filter({ hasText: lastName }).first();

      // The database row is still `active`; the UI derives the expired state.
      await expect(row.getByText('Vencida', { exact: true })).toBeVisible();
      await expect(row.getByText('Activa')).toHaveCount(0);
      await expect(page.getByRole('button', { name: `Ver QR de ${visitor}` })).toBeDisabled();
      await expect(
        page.getByRole('button', { name: `Revocar autorización de ${visitor}` }),
      ).toBeDisabled();

      // The status filter uses the same derivation as the badge.
      await page.getByLabel('Estado').click();
      await page.getByRole('option', { name: 'Vencidas' }).click();
      await expect(page.getByText(lastName)).toBeVisible();

      await page.getByLabel('Estado').click();
      await page.getByRole('option', { name: 'Activas' }).click();
      await expect(page.getByText(lastName)).toHaveCount(0);
    } finally {
      await revokePasses(request, lastName);
    }
  });

  test('the QR dialog shows a code and closes cleanly', async ({ page, request }) => {
    const lastName = `Qr${Date.now()}`;
    await createPassViaApi(request, { lastName, document: '99100003' });

    try {
      await openHistory(page, lastName);
      await page.getByRole('button', { name: `Ver QR de QA ${lastName}` }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: 'QR de acceso' })).toBeVisible();
      await expect(dialog.locator('svg').first()).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();

      await dialog.getByRole('button', { name: 'Close' }).click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
    } finally {
      await revokePasses(request, lastName);
    }
  });

  test('copying and regenerating the link hands out a new working URL', async ({
    page,
    context,
    request,
  }) => {
    const lastName = `Enlace${Date.now()}`;
    const created = await createPassViaApi(request, { lastName, document: '99100004' });
    const visitor = `QA ${lastName}`;
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    try {
      await openHistory(page, lastName);

      await page.getByRole('button', { name: `Copiar enlace de ${visitor}` }).click();
      // The welcome toast is also a status region, so filter by the notice text.
      await expect(
        page.getByRole('status').filter({ hasText: `Enlace de ${visitor} copiado.` }),
      ).toBeVisible();
      const copied = await page.evaluate(() => navigator.clipboard.readText());
      expect(copied).toBe(created.shareUrl);

      await page.getByRole('button', { name: `Regenerar enlace de ${visitor}` }).click();
      await expect(
        page.getByRole('status').filter({ hasText: 'El anterior dejó de funcionar.' }),
      ).toBeVisible();

      const regenerated = await page.evaluate(() => navigator.clipboard.readText());
      expect(regenerated).not.toBe(created.shareUrl);
      expect(regenerated).toContain('/p/');
    } finally {
      await revokePasses(request, lastName);
    }
  });

  test('revoking asks for confirmation and updates the row without reloading', async ({
    page,
    request,
  }) => {
    const lastName = `Revocar${Date.now()}`;
    await createPassViaApi(request, { lastName, document: '99100005' });
    const visitor = `QA ${lastName}`;

    await openHistory(page, lastName);
    const row = page.locator('tbody tr').filter({ hasText: lastName }).first();
    await expect(row.getByText('Activa')).toBeVisible();

    await page.getByRole('button', { name: `Revocar autorización de ${visitor}` }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Revocar autorización' })).toBeVisible();

    // Cancelling leaves the pass untouched.
    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(row.getByText('Activa')).toBeVisible();

    await page.getByRole('button', { name: `Revocar autorización de ${visitor}` }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Revocar', exact: true }).click();

    await expect(page.getByRole('status').filter({ hasText: 'revocada' })).toBeVisible();
    await expect(row.getByText('Revocada')).toBeVisible();
    await expect(page.getByRole('button', { name: `Ver QR de ${visitor}` })).toBeDisabled();
  });

  test('the batch chip filters the history down to that batch', async ({ page, request }) => {
    const label = `Lote QA ${Date.now()}`;
    const batch = await createBatchViaApi(request, label, ['99100006', '99100007']);
    expect(batch.createdCount).toBe(2);

    try {
      await openHistory(page, label);

      // Both rows share the batch label and expose the filter action.
      await expect(page.locator('tbody tr').filter({ hasText: label })).toHaveCount(2);

      await page
        .getByRole('button', { name: `Filtrar por el lote ${label}` })
        .first()
        .click();

      await expect(page.getByText(`Lote: ${label}`)).toBeVisible();
      await expect(page.locator('tbody tr').filter({ hasText: label })).toHaveCount(2);
      await expect(page.getByText(/2 autorizaciones/)).toBeVisible();

      await page.getByRole('button', { name: 'Quitar filtro de lote' }).click();
      await expect(page.getByText(`Lote: ${label}`)).toHaveCount(0);
    } finally {
      await revokePasses(request, label);
    }
  });
});

async function openBulk(page: Page) {
  await loginAs(page, DEMO_USERS.resident);
  await expect(page).toHaveURL(/\/resident$/);
  await page.goto('/resident/authorizations/bulk');
  await expect(page.getByRole('heading', { level: 1, name: 'Carga masiva' })).toBeVisible();
}

/** Same Radix caveat as the single form: the destination always starts empty. */
async function pickBulkDestination(page: Page) {
  await page.locator('#bulk-destination').click();
  const home = page.getByRole('option', { name: /A-101/ });
  if ((await home.count()) > 0) {
    await home.first().click();
    return;
  }
  await page.locator('[role="option"]:not([aria-disabled="true"])').first().click();
}

test.describe('resident bulk authorizations', () => {
  test('blocks the preview without a destination and calls no endpoint', async ({ page }) => {
    await openBulk(page);

    let batchRequests = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/passes/batch')) batchRequests += 1;
    });

    await page.locator('#bulk-csv').fill('nombre,apellido,documento\nAna,Torres,30111222');
    await page.getByRole('button', { name: 'Revisar lote' }).click();

    await expect(page.getByText('Elige el destino del lote.')).toBeVisible();
    expect(batchRequests).toBe(0);
  });

  test('rejects the whole file when a required column is missing', async ({ page }) => {
    await openBulk(page);

    await page.locator('#bulk-csv').fill('nombre,apellido\nAna,Torres');

    await expect(page.getByText(/Faltan las columnas: documento/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar lote' })).toBeDisabled();
  });

  test('a file over the limit is rejected before creating anything', async ({ page }) => {
    await openBulk(page);

    const rows = Array.from({ length: 201 }, (_, index) => `Fila,${index},DOC-${index}`);
    await page.locator('#bulk-csv').fill(`nombre,apellido,documento\n${rows.join('\n')}`);

    await expect(page.getByText('El archivo tiene 201 filas y el máximo es 200.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar lote' })).toBeDisabled();
  });

  test('changing the window invalidates the preview', async ({ page }) => {
    await openBulk(page);
    await pickBulkDestination(page);

    await page.locator('#bulk-csv').fill('nombre,apellido,documento\nAna,Torres,30111333');
    await page.getByRole('button', { name: 'Revisar lote' }).click();
    await expect(page.getByText('Vista previa')).toBeVisible();

    await page.locator('#bulk-valid-until').fill('2030-06-01T10:00');
    await expect(page.getByText('Vista previa')).toHaveCount(0);
  });

  test('previews every row, creates the valid ones and links to the batch history', async ({
    page,
    request,
  }) => {
    const stamp = Date.now();
    const label = `Carga ${stamp}`;
    const lastName = `Lote${stamp}`;
    const repeated = `71${stamp}`;
    const fresh = `72${stamp}`;
    const csv = [
      'nombre,apellido,documento,placa',
      `Ana,${lastName},${repeated},`,
      `Beto,${lastName},${fresh},abc123`,
      `Caro,${lastName},${repeated},`,
    ].join('\n');

    await openBulk(page);
    await pickBulkDestination(page);
    await page.locator('#bulk-label').fill(label);
    await page.locator('#bulk-csv').fill(csv);

    const previewResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes('/api/passes/batch/preview'),
    );
    await page.getByRole('button', { name: 'Revisar lote' }).click();
    expect((await previewResponse).status()).toBe(200);

    await expect(page.getByText('3 filas · 2 válidas · 1 con problemas')).toBeVisible();

    const duplicateRow = page.locator('tbody tr').filter({ hasText: repeated }).last();
    await expect(duplicateRow.getByText('documento duplicado en el archivo')).toBeVisible();

    try {
      await page.getByRole('button', { name: 'Crear 2 autorizaciones' }).click();

      await expect(page.getByText('Lote creado', { exact: true })).toBeVisible();
      await expect(page.getByText(/2 autorizaciones creadas/)).toBeVisible();

      await page.getByRole('link', { name: 'Ver historial del lote' }).click();

      await expect(page).toHaveURL(/batchId=/);
      await expect(page.getByText(`Lote: ${label}`)).toBeVisible();
      await expect(page.getByText(/2 autorizaciones/)).toBeVisible();
    } finally {
      await revokePasses(request, lastName);
    }
  });
});

/** Removes a node created through the UI so the demo tree stays clean. */
async function deleteNodeByName(request: APIRequestContext, name: string) {
  const token = await adminToken(request);
  const headers = { authorization: `Bearer ${token}` };

  const communitiesResponse = await request.get(`${API_URL}/api/communities`, { headers });
  const communities = unwrap(
    (await communitiesResponse.json()) as Array<{ id: string; name: string }>,
  );
  const community = communities.find((item) => item.name === 'Torre Norte');
  if (!community) return;

  const nodesResponse = await request.get(
    `${API_URL}/api/location-units?communityId=${community.id}`,
    { headers },
  );
  const nodes = unwrap((await nodesResponse.json()) as Array<{ id: string; name: string }>);
  const node = nodes.find((item) => item.name === name);
  if (!node) return;

  await request.delete(`${API_URL}/api/location-units/${node.id}`, { headers });
}

test.describe('common area branches', () => {
  test('a common area created from Unidades is offered to the resident', async ({
    page,
    request,
  }) => {
    const name = `Zona QA ${Date.now()}`;

    try {
      await loginAs(page, DEMO_USERS.orgAdmin);
      await expect(page).toHaveURL(/\/admin$/);
      await page.goto('/admin/units');
      await expect(page.getByRole('heading', { level: 1, name: 'Unidades' })).toBeVisible();

      // Level one is always visible, so its add action is the only one on screen.
      await page.getByRole('button', { name: /^Agregar torre$/i }).click();

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByRole('heading', { name: /Agregar torre/i })).toBeVisible();

      await page.locator('#unit-node-name').fill(name);
      await page.locator('#unit-node-section-type').click();
      await page.getByRole('option', { name: 'Zona común' }).click();
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();

      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('cell').filter({ hasText: name })).toBeVisible();

      await logoutFromUserMenu(page, DEMO_USERS.orgAdmin);
      await loginAs(page, DEMO_USERS.resident);
      await expect(page).toHaveURL(/\/resident$/);

      await page.goto('/resident/authorizations/new');
      await page.locator('#resident-destination').click();

      // The branch is grouped under common areas, not under the resident home.
      // Scope to the listbox: Radix also renders a hidden native select whose
      // <option>s would match a plain text assertion.
      const listbox = page.getByRole('listbox');
      await expect(listbox).toContainText('Zonas comunes');
      await expect(listbox).toContainText(name);
    } finally {
      await deleteNodeByName(request, name);
    }
  });

  test('a revocation from another session updates the row without reloading', async ({
    page,
    request,
  }) => {
    const lastName = `Live${Date.now()}`;
    const created = await createPassViaApi(request, { lastName, document: `LIVE-${Date.now()}` });
    let pageLoaded = false;

    try {
      await openHistory(page);
      pageLoaded = true;

      const row = page.locator('tbody tr').filter({ hasText: lastName });
      await expect(row).toBeVisible({ timeout: 20_000 });
      await expect(row).toContainText('Activa');

      // Revoke through the API, as a second tab or the phone would. The open page
      // must react on its own: that is what the pass stream is for.
      const token = await residentToken(request);
      await request.post(`${API_URL}/api/passes/${created.id}/revoke`, {
        headers: { authorization: `Bearer ${token}` },
      });

      await expect(row).toContainText('Revocada', { timeout: 15_000 });
    } finally {
      if (!pageLoaded) await revokePasses(request, lastName);
    }
  });
});

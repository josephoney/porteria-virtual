import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { DEMO_PASSWORD, DEMO_USERS, loginAs } from './helpers/auth';

const API_URL = 'http://localhost:3000';
const ORG_NAME = 'Administradora Demo';
const COMMUNITY_NAME = 'Torre Norte';

/** Resolves when the next PATCH to a platform organization or community finishes. */
function waitForSave(page: Page) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      (response.url().includes('/api/platform/organizations/') ||
        response.url().includes('/api/communities/')),
  );
}

async function platformToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: DEMO_USERS.platformAdmin, password: DEMO_PASSWORD },
  });
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

async function findOrganizationId(request: APIRequestContext, token: string): Promise<string> {
  const response = await request.get(
    `${API_URL}/api/platform/organizations?search=Administradora&pageSize=50`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const body = (await response.json()) as { data: Array<{ id: string; name: string }> };
  const match = body.data.find((organization) => organization.name.startsWith(ORG_NAME));
  if (!match) throw new Error('No se encontró la organización de prueba');
  return match.id;
}

/** Puts the demo organization back the way it was, even if the test failed. */
async function restoreOrganization(request: APIRequestContext) {
  const token = await platformToken(request);
  const organizationId = await findOrganizationId(request, token);
  await request.patch(`${API_URL}/api/platform/organizations/${organizationId}`, {
    headers: { authorization: `Bearer ${token}` },
    data: { name: ORG_NAME },
  });
}

/** Revokes a pending org_admin invitation so the demo data stays clean. */
async function revokePendingAdministrator(request: APIRequestContext) {
  const token = await platformToken(request);
  const organizationId = await findOrganizationId(request, token);
  const response = await request.get(
    `${API_URL}/api/platform/organizations/${organizationId}/overview`,
    { headers: { authorization: `Bearer ${token}` } },
  );
  const body = (await response.json()) as {
    pendingAdministrator: { id: string } | null;
  };
  if (!body.pendingAdministrator) return;
  await request.patch(`${API_URL}/api/invitations/${body.pendingAdministrator.id}/revoke`, {
    headers: { authorization: `Bearer ${token}` },
  });
}

test.describe('Organization edit', () => {
  test('renaming from the platform updates the table', async ({ page, request }) => {
    const temporaryName = `${ORG_NAME} QA`;

    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
    await page.goto('/platform/organizations');
    try {
      await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
      await page.locator('#platform-organization-name').fill(temporaryName);

      const saved = waitForSave(page);
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await saved;

      // The dialog stays open in edit mode, which makes the table aria-hidden,
      // so assert against the DOM instead of role queries.
      await expect(page.locator('tbody').first()).toContainText(temporaryName);
    } finally {
      await restoreOrganization(request);
    }

    await page.reload();
    await expect(page.getByRole('cell', { name: ORG_NAME, exact: true })).toBeVisible();
  });

  test('a new administrator email stays pending and shows the invite link', async ({
    page,
    request,
  }) => {
    const invitedEmail = `qa-admin-${Date.now()}@test.local`;

    try {
      await loginAs(page, DEMO_USERS.platformAdmin);
      await expect(page).toHaveURL(/\/platform$/);
      await page.goto('/platform/organizations');

      await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
      await page.locator('#platform-organization-admin').fill(invitedEmail);

      const saved = waitForSave(page);
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await saved;

      const dialog = page.getByRole('dialog');
      await expect(dialog.getByText('Invitación pendiente').first()).toBeVisible();
      await expect(dialog.getByText(/\/invite\//).first()).toBeVisible();
      await expect(dialog.getByRole('button', { name: 'Copiar enlace' })).toBeVisible();
      await expect(dialog.getByText(invitedEmail).first()).toBeVisible();
    } finally {
      await revokePendingAdministrator(request);
    }
  });
});

test.describe('Community geography', () => {
  test('editar guarda municipio y departamento, y el detalle se actualiza', async ({ page }) => {
    const temporaryMunicipality = 'Medellín QA';

    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/communities');

    await page.getByRole('cell', { name: COMMUNITY_NAME, exact: true }).first().click();

    const field = (label: RegExp) =>
      page
        .locator('dl > div')
        .filter({ has: page.locator('dt', { hasText: label }) })
        .locator('dd');

    const municipality = field(/^municipio$/i);
    const department = field(/^departamento$/i);
    const country = field(/^pa[ií]s$/i);

    await expect(municipality).toBeVisible();
    await expect(department).toBeVisible();
    await expect(country).toBeVisible();

    // The demo community may have empty geography, so restore whatever was there.
    const originalMunicipality = (await municipality.innerText()).trim();
    const originalDepartment = (await department.innerText()).trim();
    const restoreMunicipality = originalMunicipality === '—' ? '' : originalMunicipality;
    const restoreDepartment = originalDepartment === '—' ? '' : originalDepartment;

    const saveGeography = async (municipalityValue: string, departmentValue: string) => {
      await page.getByRole('button', { name: 'Editar', exact: true }).first().click();
      await page.locator('#admin-community-municipality').fill(municipalityValue);
      await page.locator('#admin-community-department').fill(departmentValue);
      const saved = waitForSave(page);
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await saved;
    };

    try {
      await saveGeography(temporaryMunicipality, 'Antioquia');

      // The row stays expanded and must show what was just saved, not the cache.
      await expect(municipality).toHaveText(temporaryMunicipality);
      await expect(department).toHaveText('Antioquia');
    } finally {
      await saveGeography(restoreMunicipality, restoreDepartment);
    }

    await expect(municipality).toHaveText(originalMunicipality);
    await expect(department).toHaveText(originalDepartment);
  });
});

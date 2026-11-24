import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

/** Every report request the page issues, in order. */
function trackReportRequests(page: Page): string[] {
  const urls: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/api/reports/')) {
      urls.push(request.url());
    }
  });
  return urls;
}

/** Reads the options of a native select, ignoring the "all" placeholder. */
async function selectOptions(page: Page, label: string): Promise<string[]> {
  const options = await page.getByLabel(label).locator('option').allTextContents();
  return options.filter((option) => option !== 'Todas las comunidades' && option !== '');
}

async function expectMetrics(page: Page) {
  await expect(page.getByRole('heading', { level: 4, name: 'Métricas de Llamadas' })).toBeVisible();
}

test.describe('Reportes scope by role', () => {
  test('guard sees Reportes scoped to their community', async ({ page }) => {
    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);

    const requests = trackReportRequests(page);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    // El alcance lo fija el servidor: no hay selector de organización.
    await expect(page.getByLabel('Organización')).toHaveCount(0);
    // La comunidad visible es solo la del guardia.
    await expect.poll(() => selectOptions(page, 'Comunidad')).toEqual(['Torre Norte']);

    await page.getByRole('button', { name: 'Cargar' }).click();
    await expectMetrics(page);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => !url.includes('organizationId='))).toBe(true);
  });

  test('operator sees Reportes scoped to their community', async ({ page }) => {
    await loginAs(page, DEMO_USERS.operator);
    await expect(page).toHaveURL(/\/$/);

    const requests = trackReportRequests(page);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    await expect(page.getByLabel('Organización')).toHaveCount(0);
    await expect.poll(() => selectOptions(page, 'Comunidad')).toEqual(['Torre Norte']);

    await page.getByRole('button', { name: 'Cargar' }).click();
    await expectMetrics(page);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => !url.includes('organizationId='))).toBe(true);
  });

  test('community_admin sees Reportes scoped to their community and cannot reach platform reports', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    const requests = trackReportRequests(page);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    await expect(page.getByLabel('Organización')).toHaveCount(0);
    await expect.poll(() => selectOptions(page, 'Comunidad')).toEqual(['Torre Norte']);

    await page.getByRole('button', { name: 'Cargar' }).click();
    await expectMetrics(page);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => !url.includes('organizationId='))).toBe(true);

    // El contexto de plataforma no le pertenece.
    await page.goto('/platform/reports');
    await expect(page).not.toHaveURL(/\/platform\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toHaveCount(0);
  });

  test('org_admin sees the organization scope and updates the period', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    const requests = trackReportRequests(page);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    // Sin selector de organización: la organización sale del token.
    await expect(page.getByLabel('Organización')).toHaveCount(0);

    // Por defecto el reporte es de toda la organización: sin communityId.
    await page.getByRole('button', { name: 'Cargar' }).click();
    await expectMetrics(page);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(
      requests.every((url) => !url.includes('organizationId=') && !url.includes('communityId=')),
    ).toBe(true);

    await page.getByRole('tab', { name: 'Semanal' }).click();
    await page.getByRole('button', { name: 'Cargar' }).click();
    await expect(page.getByRole('heading', { level: 4, name: 'Tendencia Diaria' })).toBeVisible();
    await expect.poll(() => requests.some((url) => url.includes('/reports/weekly?'))).toBe(true);

    await page.getByRole('tab', { name: 'Mensual' }).click();
    await page.getByRole('button', { name: 'Cargar' }).click();
    await expect(page.getByRole('heading', { level: 4, name: 'Por Semana' })).toBeVisible();
    await expect.poll(() => requests.some((url) => url.includes('/reports/monthly?'))).toBe(true);
  });

  test('superadmin filters platform reports by organization and community', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    const requests = trackReportRequests(page);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    const orgSelect = page.getByLabel('Organización');
    const loadButton = page.getByRole('button', { name: 'Cargar' });

    // Sin organización no hay reporte de plataforma: no existe el agregado global.
    await expect(orgSelect).toBeVisible();
    await expect(orgSelect.locator('option')).not.toHaveCount(0);
    await orgSelect.selectOption('');
    await expect(loadButton).toBeDisabled();
    await expect(
      page.getByText('Selecciona una organización para ver reportes globales.'),
    ).toBeVisible();

    // Una organización habilita el reporte y acota las comunidades.
    await orgSelect.selectOption({ label: 'Administradora Demo' });
    await expect(loadButton).toBeEnabled();
    await expect.poll(() => selectOptions(page, 'Comunidad')).toEqual(['Torre Norte']);

    const adminOrgId = await orgSelect.inputValue();
    await loadButton.click();
    await expectMetrics(page);
    await expect
      .poll(() => requests.some((url) => url.includes(`organizationId=${adminOrgId}`)))
      .toBe(true);

    // Elegir una comunidad agrega su id al pedido.
    const communitySelect = page.getByLabel('Comunidad');
    await communitySelect.selectOption({ label: 'Torre Norte' });
    const communityId = await communitySelect.inputValue();
    await loadButton.click();
    await expect
      .poll(() => requests.some((url) => url.includes(`communityId=${communityId}`)))
      .toBe(true);

    // Cambiar de organización cambia el alcance y sus comunidades.
    await orgSelect.selectOption({ label: 'Comunidad Independiente Demo' });
    await expect(page.getByLabel('Comunidad').locator('option', { hasText: /Los/ })).toHaveCount(1);
    const independentOrgId = await orgSelect.inputValue();
    expect(independentOrgId).not.toBe(adminOrgId);

    await loadButton.click();
    await expect
      .poll(() => requests.some((url) => url.includes(`organizationId=${independentOrgId}`)))
      .toBe(true);
  });
});

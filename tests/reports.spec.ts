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

/**
 * Records a manual observation, which is the only access the tests can create
 * without a pass: it lands in today's bitácora and therefore in the default
 * report range. Without it the report can be legitimately empty.
 */
async function recordManualAccess(page: Page, summary: string) {
  await page.goto('/analysis/bitacora-accesos');
  const addButton = page.getByRole('button', { name: 'Agregar novedad', exact: true });
  await expect(addButton).toBeEnabled();
  await addButton.click();
  await page.locator('#manual-summary').fill(summary);
  await page.getByRole('button', { name: 'Guardar', exact: true }).click();
  await expect(page.getByRole('row', { name: new RegExp(summary) })).toBeVisible();
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

    await expect
      .poll(() => requests.some((url) => url.includes('/api/reports/access?')))
      .toBe(true);
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

    await expect
      .poll(() => requests.some((url) => url.includes('/api/reports/access?')))
      .toBe(true);
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

    await expect
      .poll(() => requests.some((url) => url.includes('/api/reports/access?')))
      .toBe(true);
    expect(requests.every((url) => !url.includes('organizationId='))).toBe(true);

    // El contexto de plataforma no le pertenece.
    await page.goto('/platform/reports');
    await expect(page).not.toHaveURL(/\/platform\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toHaveCount(0);
  });

  test('org_admin sees the whole organization and switches between accesses and shifts', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    const requests = trackReportRequests(page);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/analysis\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    // Sin selector de organización: la organización sale del token.
    await expect(page.getByLabel('Organización')).toHaveCount(0);

    // Por defecto el reporte es de toda la organización: sin communityId.
    await expect
      .poll(() => requests.some((url) => url.includes('/api/reports/access?')))
      .toBe(true);
    expect(
      requests.every((url) => !url.includes('organizationId=') && !url.includes('communityId=')),
    ).toBe(true);

    // La serie cambia de granularidad sin recargar la página.
    await page.getByRole('combobox', { name: 'Granularidad de la serie' }).click();
    await page.getByRole('option', { name: 'Semana', exact: true }).click();
    await expect.poll(() => requests.some((url) => url.includes('granularity=week'))).toBe(true);

    // La familia de turnos tiene su propio pedido.
    await page.getByRole('tab', { name: 'Turnos' }).click();
    await expect
      .poll(() => requests.some((url) => url.includes('/api/reports/shifts?')))
      .toBe(true);
    await expect(
      page.getByText(/Turnos sin cerrar|Sin turnos registrados en el período/),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Exportar a Excel' })).toBeEnabled();
  });

  test('superadmin filters platform reports by organization and community', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    const requests = trackReportRequests(page);
    await page.getByRole('link', { name: 'Reportes', exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/reports$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    const orgSelect = page.getByLabel('Organización');

    // Sin organización no hay reporte de plataforma: no existe el agregado global.
    await expect(orgSelect).toBeVisible();
    await orgSelect.selectOption('');
    await expect(
      page.getByText('Selecciona una organización para ver los reportes de la plataforma.'),
    ).toBeVisible();
    await expect(page.getByLabel('Comunidad')).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Exportar a CSV' })).toBeDisabled();

    // Una organización habilita el reporte y acota las comunidades.
    await orgSelect.selectOption({ label: 'Administradora Demo' });
    await expect.poll(() => selectOptions(page, 'Comunidad')).toEqual(['Torre Norte']);

    const adminOrgId = await orgSelect.inputValue();
    await expect
      .poll(() => requests.some((url) => url.includes(`organizationId=${adminOrgId}`)))
      .toBe(true);

    // Elegir una comunidad agrega su id al pedido.
    const communitySelect = page.getByLabel('Comunidad');
    await communitySelect.selectOption({ label: 'Torre Norte' });
    const communityId = await communitySelect.inputValue();
    await expect
      .poll(() => requests.some((url) => url.includes(`communityId=${communityId}`)))
      .toBe(true);

    // Cambiar de organización cambia el alcance y sus comunidades.
    await orgSelect.selectOption({ label: 'Comunidad Independiente Demo' });
    await expect(page.getByLabel('Comunidad').locator('option', { hasText: /Los/ })).toHaveCount(1);
    const independentOrgId = await orgSelect.inputValue();
    expect(independentOrgId).not.toBe(adminOrgId);
    await expect
      .poll(() => requests.some((url) => url.includes(`organizationId=${independentOrgId}`)))
      .toBe(true);
  });

  test('the access report renders the metrics of the recorded bitacora', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    // Una observación de hoy garantiza que el período por defecto tenga datos.
    await recordManualAccess(page, `Reporte E2E ${Date.now()}`);

    await page.goto('/analysis/reports');
    await expect(page.getByRole('heading', { level: 1, name: 'Reportes' })).toBeVisible();

    await expect(page.getByText('Método de verificación')).toBeVisible();
    await expect(page.getByText('Accesos por hora')).toBeVisible();
    await expect(page.getByText('Accesos por portería')).toBeVisible();
    await expect(page.getByText('Motivos de denegación')).toBeVisible();
    await expect(page.getByText('Latencia de confirmación')).toBeVisible();
    await expect(page.getByText('QR', { exact: true })).toBeVisible();
  });

  test('every report exports to CSV, Excel and PDF', async ({ page }) => {
    test.setTimeout(120_000);

    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await recordManualAccess(page, `Exportación E2E ${Date.now()}`);

    await page.goto('/analysis/reports');
    await expect(page.getByRole('button', { name: 'Exportar a CSV' })).toBeEnabled();

    for (const [label, extension] of [
      ['Exportar a CSV', 'csv'],
      ['Exportar a Excel', 'xlsx'],
      ['Exportar a PDF', 'pdf'],
    ] as const) {
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: label }).click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(
        new RegExp(`^accesos-\\d{4}-\\d{2}-\\d{2}-\\d{4}-\\d{2}-\\d{2}\\.${extension}$`),
      );
    }

    // Los turnos usan el mismo mecanismo con su propio nombre de archivo.
    await page.getByRole('tab', { name: 'Turnos' }).click();
    await expect(page.getByRole('button', { name: 'Exportar a CSV' })).toBeEnabled();
    const shiftDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Exportar a CSV' }).click();
    expect((await shiftDownload).suggestedFilename()).toMatch(/^turnos-\d{4}-\d{2}-\d{2}-/);
  });
});

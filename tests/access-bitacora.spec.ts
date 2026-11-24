import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

/** Collects every list request of the bitacora issued by the page. */
function trackBitacoraRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/api/bitacora?')) {
      requests.push(request.url());
    }
  });
  return requests;
}

test.describe('readable access bitacora', () => {
  test('community admin sees the readable columns and a result badge with icon', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/analysis/bitacora-accesos');
    await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();

    for (const header of [
      'Fecha',
      'Hora',
      'Resultado',
      'Persona',
      'Vehículo',
      'Guardia',
      'Autorizó',
      'Destino',
      'Acceso',
      'Observación',
      'Comentarios',
    ]) {
      await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }

    // A manual note is guaranteed to be a readable row with an observation badge.
    const summary = `Novedad E2E ${Date.now()}`;
    const addButton = page.getByRole('button', { name: 'Agregar novedad', exact: true });
    await expect(addButton).toBeEnabled();
    await addButton.click();
    await page.locator('#manual-summary').fill(summary);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();

    const row = page.getByRole('row', { name: new RegExp(summary) });
    await expect(row).toBeVisible();
    const badge = row.locator('[data-slot="badge"]', { hasText: 'Observación' });
    await expect(badge).toBeVisible();
    await expect(badge.locator('svg')).toHaveCount(1);
  });

  test('result and guard filters change the request', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    const requests = trackBitacoraRequests(page);
    await page.goto('/analysis/bitacora-accesos');
    await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
    await expect.poll(() => requests.length).toBeGreaterThan(0);

    await page.getByRole('combobox', { name: 'Filtrar por resultado' }).click();
    await page.getByRole('option', { name: 'Denegado', exact: true }).click();
    await expect.poll(() => requests.some((url) => url.includes('result=denied'))).toBe(true);

    await page.getByRole('combobox', { name: 'Filtrar por guardia' }).click();
    await page.getByRole('option', { name: 'Carlos Guardia', exact: true }).click();
    await expect.poll(() => requests.some((url) => url.includes('guardId='))).toBe(true);

    // The filters are server-side: the last request carries both values.
    await expect
      .poll(() => requests.some((url) => url.includes('result=denied') && url.includes('guardId=')))
      .toBe(true);
  });

  test('platform admin reads the log globally without a community filter', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    const requests = trackBitacoraRequests(page);
    await page.goto('/platform/bitacora');
    await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filtrar por comunidad' })).toBeVisible();

    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests.every((url) => !url.includes('communityId='))).toBe(true);
  });
});

import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

/** Every history request the page issues, in order. */
function trackHistoryRequests(page: Page): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'GET' && request.url().includes('/api/events?')) {
      requests.push(request.url());
    }
  });
  return requests;
}

test.describe('technical history', () => {
  test('superadmin reads the history and every filter narrows the request', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    const requests = trackHistoryRequests(page);
    await page.goto('/platform/history');
    await expect(page.getByRole('heading', { level: 1, name: 'Historial' })).toBeVisible();

    for (const header of [
      'Fecha',
      'Hora',
      'Evento',
      'Organización',
      'Comunidad',
      'Acceso',
      'Actor',
    ]) {
      await expect(page.getByRole('columnheader', { name: header, exact: true })).toBeVisible();
    }

    await expect.poll(() => requests.length).toBeGreaterThan(0);
    // Sin filtros el alcance es global: no viaja un `organizationId` por defecto.
    expect(requests.every((url) => !url.includes('organizationId='))).toBe(true);

    await page.getByRole('combobox', { name: 'Filtrar por organización' }).click();
    await page.getByRole('option', { name: 'Administradora Demo', exact: true }).click();
    await expect.poll(() => requests.some((url) => url.includes('organizationId='))).toBe(true);

    await page.getByRole('combobox', { name: 'Filtrar por comunidad' }).click();
    await page.getByRole('option', { name: 'Torre Norte', exact: true }).click();
    await expect.poll(() => requests.some((url) => url.includes('communityId='))).toBe(true);

    await page.getByRole('combobox', { name: 'Filtrar por tipo de evento' }).click();
    await page.getByRole('option', { name: 'Ingreso de pase', exact: true }).click();
    await expect
      .poll(() => requests.some((url) => url.includes('eventType=pass.entry')))
      .toBe(true);

    await page.getByLabel('Filtrar por actor').fill('Carlos');
    await expect.poll(() => requests.some((url) => url.includes('actor=Carlos'))).toBe(true);
  });

  test('tenant has no Auditoría entry and cannot open the technical view', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByRole('link', { name: 'Auditoría', exact: true })).toHaveCount(0);

    // El enlace viejo cae en la bitácora legible, no en la vista técnica.
    await page.goto('/analysis/bitacora');
    await expect(page).toHaveURL(/\/analysis\/bitacora-accesos$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Bitácora de accesos' }),
    ).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Filtrar por tipo de evento' })).toHaveCount(0);

    // La ruta del superadmin lo saca del contexto de plataforma.
    await page.goto('/platform/history');
    await expect(page).not.toHaveURL(/\/platform\/history$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Historial' })).toHaveCount(0);
  });
});

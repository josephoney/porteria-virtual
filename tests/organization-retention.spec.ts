import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

/**
 * El panel de la organización toca tres cosas que comparten una sola pantalla:
 * la ventana de retención, las preservaciones y el consentimiento que se muestra
 * en el detalle de la bitácora.
 */
test.describe('mi organización', () => {
  test('cambia la ventana de retención y la reporta a la API', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/organization');
    await expect(page.getByRole('heading', { level: 1, name: 'Mi Organización' })).toBeVisible();

    const window = page.getByLabel('Retención de datos');
    const original = await window.inputValue();
    const target = original === '60' ? '90' : '60';

    const patched = page.waitForRequest(
      (request) => request.url().includes('/api/organizations/me') && request.method() === 'PATCH',
    );
    await window.selectOption(target);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();

    const request = await patched;
    expect(JSON.parse(String(request.postData())).retentionDays).toBe(Number(target));

    // Vuelve a dejarlo como estaba: el test no debe cambiar la configuración.
    const restore = page.waitForRequest(
      (r) => r.url().includes('/api/organizations/me') && r.method() === 'PATCH',
    );
    await window.selectOption(original);
    await page.getByRole('button', { name: 'Guardar cambios' }).click();
    await restore;
  });

  test('crea y libera una preservación de fechas', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/organization');
    await expect(page.getByText('Preservaciones').first()).toBeVisible();

    const reason = `Incidente E2E ${Date.now()}`;
    await page.getByLabel('Desde').last().fill('2026-11-01');
    await page.getByLabel('Hasta').last().fill('2026-11-03');
    await page.getByLabel('Motivo').last().fill(reason);
    await page.getByLabel('Vence').last().fill('2026-12-31');

    const created = page.waitForRequest(
      (request) =>
        request.url().includes('/api/organizations/me/retention-holds') &&
        request.method() === 'POST',
    );
    await page.getByRole('button', { name: 'Preservar rango' }).click();
    await created;

    const row = page.getByRole('row', { name: new RegExp(reason) });
    await expect(row).toBeVisible();

    const released = page.waitForRequest(
      (request) => request.url().includes('/release') && request.method() === 'POST',
    );
    await row.getByRole('button', { name: 'Liberar' }).click();
    await released;

    await expect(row.getByRole('button', { name: 'Liberar' })).toHaveCount(0);
  });

  test('el detalle de la bitácora muestra el consentimiento del pase', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/analysis/bitacora-accesos');
    await expect(page.getByText('Bitácora de accesos').first()).toBeVisible();

    const rows = page.locator('tbody tr');
    await expect(rows.first()).toBeVisible();

    await rows.first().click();
    await expect(page.getByText('Detalle del movimiento')).toBeVisible();
    await expect(page.getByText('Consentimiento')).toBeVisible();
  });
});

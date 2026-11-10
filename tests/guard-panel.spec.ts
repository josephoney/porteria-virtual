import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });

test.describe('guard panel and access bitacora', () => {
  test('guard starts a shift, adds a manual entry and ends the shift', async ({ page }) => {
    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);

    await expect(page.getByText('Turno actual', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar turno|Cerrar turno/ })).toBeVisible();

    const endShiftButton = page.getByRole('button', { name: 'Cerrar turno', exact: true });
    if (await endShiftButton.isVisible()) {
      page.once('dialog', (dialog) => dialog.accept());
      await endShiftButton.click();
      await expect(page.getByRole('button', { name: 'Iniciar turno', exact: true })).toBeVisible();
    }

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Puerta Principal', exact: true }).click();
    await page.getByRole('button', { name: 'Iniciar turno', exact: true }).click();

    const currentShiftCard = page.locator('[data-slot="card"]').filter({ hasText: 'Turno actual' });
    await expect(currentShiftCard.getByText('Abierto', { exact: true })).toBeVisible();
    await expect(currentShiftCard.getByText(/Acceso:/)).toContainText('Puerta Principal');

    const manualSummary = `E2E novedad ${Date.now()}`;
    await page.getByRole('button', { name: 'Agregar novedad', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Agregar novedad', { exact: true })).toBeVisible();
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Puerta Principal', exact: true }).click();
    await dialog.locator('#manual-summary').fill(manualSummary);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(manualSummary, { exact: true })).toBeVisible();

    page.once('dialog', (confirmDialog) => confirmDialog.accept());
    await page.getByRole('button', { name: 'Cerrar turno', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Iniciar turno', exact: true })).toBeVisible();
  });

  test('community admin sees the access bitacora with destination and authorizer', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/analysis/bitacora-accesos');
    await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Destino', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Autorizó', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar novedad', exact: true })).toBeVisible();
  });
});

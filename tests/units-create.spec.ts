import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });

test.describe('create a unit from the units page', () => {
  test('an admin creates a unit under a section and sees it in the list', async ({ page }) => {
    const unitName = `E2E-${Date.now().toString().slice(-6)}`;

    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/units');
    await expect(page.getByRole('heading', { name: 'Unidades', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Nueva unidad', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Nueva unidad' })).toBeVisible();

    await dialog.locator('#unit-level-1').click();
    await page.getByRole('option', { name: 'Torre A', exact: true }).click();

    await dialog.locator('#unit-level-2').click();
    await page.getByRole('option', { name: 'Piso 1', exact: true }).click();

    await dialog.locator('#unit-name').fill(unitName);
    await dialog.getByRole('button', { name: 'Crear unidad', exact: true }).click();

    await expect(dialog).toBeHidden();

    // La búsqueda confirma que la unidad quedó creada y es visible en el listado.
    await page.getByPlaceholder('Buscar por código o nombre…').fill(unitName);
    await expect(page.getByText(unitName, { exact: true }).first()).toBeVisible();
  });

  test('the platform admin does not get the creation action', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    await page.goto('/platform/units');
    await expect(page.getByRole('button', { name: 'Nueva unidad', exact: true })).toHaveCount(0);
  });
});

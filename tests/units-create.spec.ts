import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });

async function pickPathToFirstUnit(page: import('@playwright/test').Page) {
  const dialog = page.getByRole('dialog');
  await dialog.locator('#unit-level-1').click();
  await page.getByRole('option', { name: 'Torre A', exact: true }).click();
  await dialog.locator('#unit-level-2').click();
  await page.getByRole('option', { name: 'Piso 1', exact: true }).click();
}

test.describe('unit administration from the units page', () => {
  test('create, reject a duplicate, edit and delete with double confirmation', async ({
    page,
  }) => {
    const suffix = Date.now().toString().slice(-6);
    const unitName = `E2E-${suffix}`;
    const renamed = `${unitName}-B`;

    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/units');
    await expect(page.getByRole('heading', { name: 'Unidades', exact: true })).toBeVisible();

    // 1. Alta
    await page.getByRole('button', { name: 'Nueva unidad', exact: true }).click();
    let dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Nueva unidad' })).toBeVisible();
    await pickPathToFirstUnit(page);
    await dialog.locator('#unit-name').fill(unitName);
    await dialog.getByRole('button', { name: 'Crear unidad', exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder('Buscar por código o nombre…').fill(unitName);
    await expect(page.getByText(unitName, { exact: true }).first()).toBeVisible();

    // 2. Duplicado: misma sección y mismo nombre
    await page.getByRole('button', { name: 'Nueva unidad', exact: true }).click();
    dialog = page.getByRole('dialog');
    await pickPathToFirstUnit(page);
    await dialog.locator('#unit-name').fill(unitName);
    await dialog.getByRole('button', { name: 'Crear unidad', exact: true }).click();
    await expect(
      dialog.getByText('Ya existe un elemento con ese nombre en este nivel.'),
    ).toBeVisible();
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    await expect(dialog).toBeHidden();

    // 3. Edición
    await page.getByPlaceholder('Buscar por código o nombre…').fill(unitName);
    await page.getByRole('button', { name: `Editar ${unitName}`, exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Editar unidad' })).toBeVisible();
    await dialog.locator('#edit-unit-name').fill(renamed);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog).toBeHidden();

    await page.getByPlaceholder('Buscar por código o nombre…').fill(renamed);
    await expect(page.getByText(renamed, { exact: true }).first()).toBeVisible();

    // 4. Borrado con dos confirmaciones
    await page.getByRole('button', { name: `Eliminar ${renamed}`, exact: true }).click();
    dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Eliminar unidad' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Continuar', exact: true }).click();
    await expect(dialog.getByRole('heading', { name: 'Confirmar eliminación' })).toBeVisible();
    await dialog
      .getByRole('button', { name: 'Eliminar definitivamente', exact: true })
      .click();
    await expect(dialog).toBeHidden();

    await expect(page.getByText('No hay unidades para mostrar')).toBeVisible();
  });

  test('the platform admin does not get the creation action', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    await page.goto('/platform/units');
    await expect(page.getByRole('button', { name: 'Nueva unidad', exact: true })).toHaveCount(0);
  });
});

import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs, logoutFromUserMenu } from './helpers/auth';

test.describe.configure({ mode: 'serial' });

const ACCESS_POINT = 'Puerta Principal';

test.describe('guard workstation assignment', () => {
  test('an admin assigns the workstation and the guard sees it', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/users');
    await page
      .getByLabel('Buscar usuarios por correo, nombre o documento')
      .fill(DEMO_USERS.guard);

    const workstationButton = page.getByRole('button', {
      name: new RegExp(`Puesto por defecto de ${DEMO_USERS.guard}`),
    });
    await expect(workstationButton).toBeVisible();
    await workstationButton.click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Puesto por defecto' })).toBeVisible();
    await dialog.locator('#workstation-access-point').click();
    await page.getByRole('option', { name: ACCESS_POINT, exact: true }).click();
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(dialog.getByText('Puesto actualizado.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(dialog).toBeHidden();

    // La tabla refleja el puesto sin recargar la página.
    await expect(
      page.getByText(ACCESS_POINT, { exact: true }).first(),
    ).toBeVisible();

    await logoutFromUserMenu(page, DEMO_USERS.communityAdmin);

    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);

    const personalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Datos personales' });
    await expect(personalCard.getByText('Puesto por defecto:')).toBeVisible();
    await expect(personalCard.getByText(ACCESS_POINT, { exact: true })).toBeVisible();
  });

  test('an admin clears the workstation and the guard sees the empty state', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/users');
    await page
      .getByLabel('Buscar usuarios por correo, nombre o documento')
      .fill(DEMO_USERS.guard);

    const workstationButton = page.getByRole('button', {
      name: new RegExp(`Puesto por defecto de ${DEMO_USERS.guard}`),
    });
    await expect(workstationButton).toBeVisible();
    await workstationButton.click();

    const dialog = page.getByRole('dialog');
    await dialog.locator('#workstation-access-point').click();
    await page.getByRole('option', { name: 'Sin asignar', exact: true }).click();
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
    await expect(dialog.getByText('Puesto actualizado.')).toBeVisible();
    await dialog.getByRole('button', { name: 'Cerrar', exact: true }).click();
    await expect(dialog).toBeHidden();

    await logoutFromUserMenu(page, DEMO_USERS.communityAdmin);

    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);

    const personalCard = page.locator('[data-slot="card"]').filter({ hasText: 'Datos personales' });
    await expect(personalCard.getByText('Sin puesto asignado')).toBeVisible();
    await expect(
      personalCard.getByText('Pide a un administrador que te asigne un puesto por defecto'),
    ).toBeVisible();
  });
});

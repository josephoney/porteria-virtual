import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('polished dashboard', () => {
  test('login page shows the brand panel and the signup tab', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Sistema Portería virtual y accesos').first()).toBeVisible();
    await expect(page.getByRole('img', { name: 'Zima Seguridad' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Crear cuenta' })).toBeVisible();

    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page.locator('#invite-token')).toBeVisible();
    await expect(page.getByText(/pedísela al administrador de tu comunidad/)).toBeVisible();
  });

  test('admin filters users, sees one row per community and toggles status', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/admin/users');
    await expect(page.getByText(/\d+ usuarios en la organización/)).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Comunidad' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Membresía' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Estado' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Activo' })).toHaveCount(0);

    await page.getByLabel('Buscar usuarios por correo, nombre o documento').fill('multi');
    await expect(page.getByText(/resultados? de \d+ usuarios?/)).toBeVisible();
    await expect(page.getByText('Torre Norte')).toBeVisible();
    await expect(page.getByText('Los Álamos')).toBeVisible();

    const toggle = page.getByRole('switch', { name: /usuario multi@porteria.local/ });
    await expect(toggle).toContainText('Activo');
    await toggle.click();
    await expect(toggle).toContainText('Inactivo');
    await toggle.click();
    await expect(toggle).toContainText('Activo');
  });

  test.describe('mobile login', () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test('shows the mobile hero and the login form without horizontal overflow', async ({
      page,
    }) => {
      await page.goto('/login');

      await expect(page.getByRole('img', { name: 'Zima Seguridad' }).first()).toBeVisible();
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();

      const fitsViewport = await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      );
      expect(fitsViewport).toBe(true);
    });
  });

  test('community row expands without a Detalle button', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/communities');

    await expect(page.getByRole('button', { name: 'Detalle' })).toHaveCount(0);
    await page.getByText('Torre Norte', { exact: true }).first().click();
    // The detail now renders label/value pairs through DetailGrid (a <dl>).
    await expect(page.locator('dl dt', { hasText: 'Tipo' }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver estructura', exact: true })).toBeVisible();
  });
});

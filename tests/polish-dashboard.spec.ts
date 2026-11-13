import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

// One test toggles the status of the multi-context user and another signs in as
// that same user. Running them in parallel turns the toggle into a login failure.
test.describe.configure({ mode: 'serial' });

test.describe('polished dashboard', () => {
  test('login page shows the brand panel and the signup tab', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Sistema Portería virtual y accesos').first()).toBeVisible();
    await expect(page.getByRole('img', { name: 'Zima Seguridad' }).first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Iniciar sesión' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Crear cuenta' })).toBeVisible();

    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page.locator('#invite-token')).toBeVisible();
    await expect(page.getByText(/pidesela al administrador de tu comunidad/)).toBeVisible();
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
    await expect(page.getByText('Torre Norte')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('Los Álamos')).toBeVisible();

    // The switch is exercised on a user nobody signs in as: toggling the
    // multi-context account would break the specs that log in with it while this
    // file runs in parallel.
    await page.getByLabel('Buscar usuarios por correo, nombre o documento').fill('nuevo');
    const toggle = page.getByRole('switch', { name: /usuario nuevo@porteria.local/ });
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
    await expect(page.getByRole('button', { name: /^Ver estructura de / })).toBeVisible();
  });
});

test.describe('auth shell', () => {
  test('signup tab fits the mobile viewport without horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/login');

    await page.getByRole('tab', { name: 'Crear cuenta' }).click();
    await expect(page.locator('#invite-token')).toBeVisible();

    const fitsViewport = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fitsViewport).toBe(true);
  });

  test('dark preference applies dark tokens to the login card', async ({ page }) => {
    await page.goto('/login');

    const card = page.locator('[data-slot="card"]').first();
    await expect(card).toBeVisible();
    const lightBackground = await card.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );

    // The dashboard persists the theme, so this exercises the real path.
    await page.evaluate(() => localStorage.setItem('porteria-theme', 'dark'));
    await page.reload();

    await expect(page.locator('html')).toHaveClass(/dark/);
    await expect(page.locator('#email')).toBeVisible();

    const darkBackground = await card.evaluate(
      (element) => getComputedStyle(element).backgroundColor,
    );
    expect(darkBackground).not.toBe(lightBackground);
  });

  test('multi-context user picks a membership and leaves the selection screen', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.multiContext);

    await expect(page.getByText('Elige tu contexto')).toBeVisible();

    const options = page.getByRole('button', { name: /owner|resident/i });
    await expect(options).toHaveCount(2);

    await options.first().click();

    // Both demo memberships are resident roles, so both land on the resident workspace.
    await expect(page).toHaveURL(/\/resident$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis autorizaciones' })).toBeVisible();
    await expect(page.getByText('Elige tu contexto')).toHaveCount(0);
  });
});

import { test, expect } from '@playwright/test';
import { DEMO_PASSWORD, DEMO_USERS, loginAs, logoutFromUserMenu } from './helpers/auth';

test.describe('Login', () => {
  test('renders the login form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Iniciar Sesión');
    await expect(page.locator('#email')).toBeVisible();
    await expect(page.locator('#password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ingresar', exact: true })).toBeVisible();
  });

  test('shows an error for invalid credentials', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin, 'not-the-password');

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page.locator('#login-error')).toContainText('Invalid email or password');
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows an error for an unknown email', async ({ page }) => {
    await loginAs(page, 'nobody@porteria.local', DEMO_PASSWORD);

    await expect(page.locator('#login-error')).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe('Role-based landing', () => {
  test('platform admin lands on the platform dashboard', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);

    await expect(page).toHaveURL(/\/platform$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Organizaciones' })).toBeVisible();
  });

  test('org admin lands on the tenant admin dashboard', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mi Organización' })).toBeVisible();
  });

  test('community admin lands on the tenant admin dashboard', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);

    await expect(page).toHaveURL(/\/admin$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Resumen' })).toBeVisible();
  });

  test('operator lands on the operator panel', async ({ page }) => {
    await loginAs(page, DEMO_USERS.operator);

    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByText('Sin llamada activa')).toBeVisible();
  });

  test('guard lands on the guard panel', async ({ page }) => {
    await loginAs(page, DEMO_USERS.guard);

    await expect(page).toHaveURL(/\/guard$/);
    await expect(page.getByRole('heading', { name: 'Rondas de Guardia' })).toBeVisible();
  });

  test('resident is sent to the Zima QR Access page', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);

    await expect(page).toHaveURL(/\/app-required$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Usá Zima QR Access' })).toBeVisible();
  });

  test('multi-context user must pick a membership', async ({ page }) => {
    await loginAs(page, DEMO_USERS.multiContext);

    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Elegí tu contexto');
    const options = page.locator('[data-slot="card-content"] button');
    await expect(options).toHaveCount(2);

    await options.first().click();

    await expect(page).toHaveURL(/\/app-required$/);
  });
});

test.describe('Session', () => {
  test('logout clears the session and returns to login', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    await logoutFromUserMenu(page, DEMO_USERS.platformAdmin);

    await expect(page.locator('[data-slot="card-title"]')).toHaveText('Iniciar Sesión');
    expect(await page.evaluate(() => localStorage.getItem('auth_access_token'))).toBeNull();
  });

  test('anonymous users are redirected from the dashboard to login', async ({ page }) => {
    await page.goto('/platform/users');

    await expect(page).toHaveURL(/\/login$/);
  });
});

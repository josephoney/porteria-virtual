import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('Platform navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
  });

  const platformPages = [
    { path: '/platform/organizations', title: 'Organizaciones' },
    { path: '/platform/communities', title: 'Comunidades' },
    { path: '/platform/sections', title: 'Secciones' },
    { path: '/platform/units', title: 'Unidades' },
    { path: '/platform/invitations', title: 'Invitaciones' },
    { path: '/platform/users', title: 'Usuarios' },
  ];

  for (const { path, title } of platformPages) {
    test(`renders ${title} at ${path}`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    });
  }

  test('navigates between platform pages through the sidebar', async ({ page }) => {
    await page.getByRole('link', { name: 'Secciones', exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/sections$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Secciones' })).toBeVisible();

    await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/users$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  });

  test('breadcrumb reflects the current platform section', async ({ page }) => {
    await page.goto('/platform/units');

    const breadcrumb = page.getByRole('navigation', { name: 'breadcrumb' });
    await expect(breadcrumb).toContainText('Plataforma');
    await expect(breadcrumb).toContainText('Unidades');
  });
});

test.describe('Tenant admin navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);
  });

  const adminPages = [
    { path: '/admin/organization', title: 'Mi Organización' },
    { path: '/admin/communities', title: 'Comunidades' },
    { path: '/admin/sections', title: 'Secciones' },
    { path: '/admin/units', title: 'Unidades' },
    { path: '/admin/invitations', title: 'Invitaciones' },
    { path: '/admin/users', title: 'Usuarios' },
  ];

  for (const { path, title } of adminPages) {
    test(`renders ${title} at ${path}`, async ({ page }) => {
      await page.goto(path);

      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole('heading', { level: 1, name: title })).toBeVisible();
    });
  }

  test('navigates between tenant admin pages through the sidebar', async ({ page }) => {
    // `name` is substring-based by default: "Unidades" also matches "Comunidades".
    await page.getByRole('link', { name: 'Unidades', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/units$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Unidades' })).toBeVisible();
  });
});

test.describe('Role isolation', () => {
  test('community admin cannot reach organization-only sections', async ({ page }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByRole('link', { name: 'Mi Organización', exact: true })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Comunidades', exact: true })).toHaveCount(0);

    // RequireRole sends the user to '/', and HomePage then redirects them to '/admin'.
    await page.goto('/admin/communities');
    await expect(page).not.toHaveURL(/\/admin\/communities$/);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('operator cannot reach the platform dashboard', async ({ page }) => {
    await loginAs(page, DEMO_USERS.operator);
    await expect(page).toHaveURL(/\/$/);

    await page.goto('/platform');
    await expect(page).toHaveURL(/\/$/);
  });
});

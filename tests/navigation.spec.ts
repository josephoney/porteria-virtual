import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs, logoutFromUserMenu } from './helpers/auth';

/**
 * Asserts that exactly one sidebar item is highlighted and that it is `label`.
 *
 * The active anchor carries two independent signals:
 * - `data-active` comes from our own `isActive()` in `AppSidebar`.
 * - `aria-current="page"` comes from React Router's `NavLink`.
 * If those two disagree, the sidebar underline lies. Keeping both in the same
 * assertion is what makes this test catch prefix-matching regressions.
 */
async function expectOnlyActive(page: Page, label: string) {
  const active = page.locator('[data-sidebar="menu-button"][data-active="true"]');
  await expect(active).toHaveCount(1);
  await expect(active).toHaveText(label);
  await expect(active).toHaveAttribute('aria-current', 'page');
}

test.describe('Platform navigation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
  });

  const platformPages = [
    { path: '/platform/organizations', title: 'Organizaciones' },
    { path: '/platform/communities', title: 'Comunidades' },
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
    await page.getByRole('link', { name: 'Unidades', exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/units$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Unidades' })).toBeVisible();

    await page.getByRole('link', { name: 'Usuarios', exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/users$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  });

  test('renders the sections page at /platform/sections', async ({ page }) => {
    await page.goto('/platform/sections');

    await expect(page).toHaveURL(/\/platform\/sections$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Estructura' })).toBeVisible();
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

  test('renders the sections page at /admin/sections', async ({ page }) => {
    await page.goto('/admin/sections');

    await expect(page).toHaveURL(/\/admin\/sections$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Estructura' })).toBeVisible();
  });

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

test.describe('Sidebar active state', () => {
  test('tenant root "Resumen" does not stay highlighted on subroutes', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await expectOnlyActive(page, 'Resumen');

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expectOnlyActive(page, 'Usuarios');
  });

  test('platform root "Resumen" does not stay highlighted on subroutes', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
    await expectOnlyActive(page, 'Resumen');

    await page.goto('/platform/organizations');
    await expect(page.getByRole('heading', { level: 1, name: 'Organizaciones' })).toBeVisible();
    await expectOnlyActive(page, 'Organizaciones');
  });

  test('prefix collision: /analysis/bitacora-accesos does not highlight Auditoría', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/analysis/bitacora-accesos');
    await expect(page).toHaveURL(/\/analysis\/bitacora-accesos$/);
    await expectOnlyActive(page, 'Bitácora de accesos');

    await page.goto('/analysis/bitacora');
    await expect(page).toHaveURL(/\/analysis\/bitacora$/);
    await expectOnlyActive(page, 'Auditoría');
  });

  test('highlight follows sidebar clicks', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.getByRole('link', { name: 'Comunidades', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/communities$/);
    await expectOnlyActive(page, 'Comunidades');

    await page.getByRole('link', { name: 'Resumen', exact: true }).click();
    await expect(page).toHaveURL(/\/admin$/);
    await expectOnlyActive(page, 'Resumen');
  });

  test('operator and guard roots highlight only their own item', async ({ page }) => {
    await loginAs(page, DEMO_USERS.operator);
    await expect(page).toHaveURL(/\/$/);
    await expectOnlyActive(page, 'Operador');

    await logoutFromUserMenu(page, DEMO_USERS.operator);

    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);
    await expectOnlyActive(page, 'Guardia');
  });
});

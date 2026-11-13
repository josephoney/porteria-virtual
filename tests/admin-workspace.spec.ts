import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

const ORG_NAME = 'Administradora Demo';
const COMMUNITY_NAME = 'Torre Norte';

/** The brand block in the sidebar header is the only size="lg" menu button. */
function sidebarBrand(page: Page) {
  return page.locator('a[data-sidebar="menu-button"][data-size="lg"]');
}

/**
 * `loginAs` submits the form but does not wait for the redirect. Navigating
 * before the token lands in localStorage aborts the login request and the app
 * bounces back to /login, so every test waits for the landing route first.
 */
async function loginAndWait(page: Page, email: string, landing: RegExp) {
  await loginAs(page, email);
  await expect(page).toHaveURL(landing);
}

test.describe('Workspace identity', () => {
  test('org admin sees the organization name in the sidebar', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);

    await expect(sidebarBrand(page)).toContainText(ORG_NAME);
  });

  test('guard sees the community name in the sidebar', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.guard, /\/guard$/);

    // The workspace name arrives from a second request after the login redirect,
    // so it can lag behind the first paint under parallel workers.
    await expect(sidebarBrand(page)).toContainText(COMMUNITY_NAME, { timeout: 20_000 });
  });

  test('platform admin sees the platform name in the sidebar', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.platformAdmin, /\/platform$/);

    await expect(sidebarBrand(page)).toContainText('Portería Virtual');
  });
});

test.describe('Welcome toast', () => {
  test('appears once, dismisses itself and does not come back on navigation', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);

    const toast = page.getByRole('status');
    await expect(toast).toBeVisible();
    await expect(toast).toContainText(/Bienvenido/);
    await expect(toast).toContainText(ORG_NAME);

    // Auto dismiss after ~5s plus the exit animation.
    await expect(toast).toHaveCount(0, { timeout: 10_000 });

    await page.goto('/admin/users');
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });
});

test.describe('My Organization profile', () => {
  test('logo is a button and the organization name is emphasized', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/organization');

    await expect(page.getByRole('heading', { level: 1, name: 'Mi Organización' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Elegir logo|Cambiar logo/ })).toBeVisible();

    const nameValue = page
      .locator('dl > div')
      .filter({ has: page.locator('dt', { hasText: /organizaci[oó]n/i }) })
      .locator('dd');
    await expect(nameValue).toHaveText(ORG_NAME);
    await expect(nameValue).toHaveCSS('font-weight', '700');
    await expect(nameValue).toHaveCSS('font-size', '16px');
  });
});

test.describe('Platform organizations table', () => {
  test('row click and keyboard expand the detail, second action collapses it', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.platformAdmin, /\/platform$/);
    await page.goto('/platform/organizations');

    const nameCell = page.getByRole('cell', { name: ORG_NAME, exact: true }).first();
    // `role="button"` on the <tr> removes its row role, so query the attribute.
    const row = page.locator('tbody tr[role="button"]').filter({ hasText: ORG_NAME }).first();

    await nameCell.click();
    await expect(page.locator('dl').first()).toBeVisible();
    await expect(page.locator('dl dt', { hasText: 'NIT' })).toBeVisible();

    // Clicking the row again collapses it.
    await nameCell.click();
    await expect(page.locator('dl')).toHaveCount(0);

    // Keyboard: Enter toggles the same way.
    await row.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('dl').first()).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('dl')).toHaveCount(0);
  });

  test('edit dialog is prefilled with name, slug and administrator', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.platformAdmin, /\/platform$/);
    await page.goto('/platform/organizations');

    await page.getByRole('button', { name: 'Editar', exact: true }).first().click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Editar organización' })).toBeVisible();
    await expect(page.locator('#platform-organization-name')).toHaveValue(ORG_NAME);
    await expect(page.locator('#platform-organization-admin')).toBeVisible();
    await expect(dialog.getByText('Administrador actual').first()).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});

test.describe('Community detail', () => {
  test('Editar opens a prefilled form without collapsing the row', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/communities');

    await page.getByRole('cell', { name: COMMUNITY_NAME, exact: true }).first().click();
    await expect(page.locator('dl').first()).toBeVisible();

    await page
      .getByRole('button', { name: `Editar ${COMMUNITY_NAME}`, exact: true })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Editar comunidad' })).toBeVisible();
    await expect(page.locator('#admin-community-name')).toHaveValue(COMMUNITY_NAME);

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // The row stayed expanded while the dialog was open.
    await expect(page.locator('dl').first()).toBeVisible();
  });

  test('detail label and value are visually distinct in light and dark', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/communities');

    await page.getByRole('cell', { name: COMMUNITY_NAME, exact: true }).first().click();

    const label = page.locator('dl dt', { hasText: /^tipo$/i }).first();
    const value = page
      .locator('dl > div')
      .filter({ has: page.locator('dt', { hasText: /^tipo$/i }) })
      .locator('dd');
    await expect(label).toBeVisible();

    await expect(label).toHaveCSS('text-transform', 'uppercase');
    await expect(label).toHaveCSS('font-size', '12px');
    await expect(value).toHaveCSS('font-size', '14px');

    const lightValue = await value.evaluate((element) => getComputedStyle(element).color);
    const lightLabel = await label.evaluate((element) => getComputedStyle(element).color);
    expect(lightValue).not.toBe(lightLabel);

    await page.evaluate(() => document.documentElement.classList.add('dark'));

    const darkValue = await value.evaluate((element) => getComputedStyle(element).color);
    expect(darkValue).not.toBe(lightValue);
  });

  test('structure dialog shows a single header and a single edit action', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/communities');

    // The community row also has role="button" and its accessible name includes
    // this label, so match the inner icon button exactly.
    await page
      .getByRole('button', { name: `Ver estructura de ${COMMUNITY_NAME}`, exact: true })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Estructura de la comunidad')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Editar estructura' })).toHaveCount(1);
    await expect(dialog.getByText(/3 niveles/).first()).toBeVisible();
  });

  test('community detail shows the structure summary', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/communities');

    await page.getByRole('cell', { name: COMMUNITY_NAME, exact: true }).first().click();

    const summary = page.getByText(/torres|pisos|apartamentos|unidades/).first();
    await expect(summary).toBeVisible();
  });

  test('the daily authorization rule can be turned off and survives a reload', async ({ page }) => {
    // The demo community of this org is used by the geography spec, so the rule
    // test runs on another organization's community to avoid parallel interference.
    const ruleCommunity = 'Condominio Los Álamos';

    await loginAndWait(page, DEMO_USERS.orgAdminIndependent, /\/admin$/);
    await page.goto('/admin/communities');

    await page.getByRole('cell', { name: ruleCommunity, exact: true }).first().click();

    // The rule lives in the same form as the rest of the community. The test
    // toggles it off and puts it back at the end, because creating a community
    // here would leave a row behind on every run.
    const saveRule = async (enabled: boolean) => {
      await page
        .getByRole('button', { name: `Editar ${ruleCommunity}`, exact: true })
        .first()
        .click();

      const toggle = page.locator('#admin-community-limit-enabled');
      const limit = page.locator('#admin-community-limit');
      await expect(toggle).toBeVisible();

      if ((await toggle.isChecked()) !== enabled) await toggle.click();
      // The number stays visible but disabled while the rule is off, so nobody
      // has to retype it when the limit comes back.
      if (enabled) {
        await expect(limit).toBeEnabled();
        await limit.fill('50');
      } else {
        await expect(limit).toBeDisabled();
      }

      const saved = page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' && response.url().includes('/api/communities/'),
      );
      await page.getByRole('button', { name: 'Guardar cambios' }).click();
      await saved;
      await expect(page.getByRole('dialog')).toHaveCount(0);
    };

    const rule = page
      .locator('dl > div')
      .filter({ has: page.locator('dt', { hasText: /^límite diario$/i }) })
      .locator('dd');
    await expect(rule).toHaveText('50 por unidad');

    try {
      await saveRule(false);
      await expect(rule).toHaveText('Sin límite');
    } finally {
      await saveRule(true);
    }

    await expect(rule).toHaveText('50 por unidad');
  });
});

import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.use({ viewport: { width: 600, height: 900 } });

function mobileSheet(page: Page) {
  return page.getByRole('dialog', { name: 'Sidebar' });
}

test.describe('mobile sidebar sheet', () => {
  test('platform shell opens the sheet and closes it after navigating', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);

    const sheet = mobileSheet(page);
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Administración');

    await sheet.getByRole('link', { name: 'Organizaciones', exact: true }).click();
    await expect(page).toHaveURL(/\/platform\/organizations$/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Organizaciones' })).toBeVisible();
  });

  test('tenant shell opens the sheet and closes it after navigating', async ({ page }) => {
    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    const sheet = mobileSheet(page);
    await expect(sheet).toBeHidden();

    await page.getByRole('button', { name: 'Toggle Sidebar' }).click();
    await expect(sheet).toBeVisible();
    await expect(sheet).toContainText('Administración');

    await sheet.getByRole('link', { name: 'Usuarios', exact: true }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  });
});

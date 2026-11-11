import { test, expect } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

/**
 * These tests reproduce the class of failure that used to leave a blank page:
 * a malformed API payload that makes a component throw during render.
 *
 * `AdminPanel` stores the `/api/communities` payload as an array and filters it
 * inside a `useMemo`, so returning an object instead makes `.filter` throw.
 */
test.describe('Error boundary', () => {
  test('shows a fallback instead of a blank page when a route crashes', async ({ page }) => {
    await page.route('**/api/communities', (route) => route.fulfill({ json: { oops: true } }));

    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Recargar' })).toBeVisible();

    // The shell survives the error: the sidebar is still usable.
    await expect(page.getByRole('link', { name: 'Usuarios', exact: true })).toBeVisible();
  });

  test('navigating to another route clears the error', async ({ page }) => {
    await page.route('**/api/communities', (route) => route.fulfill({ json: { oops: true } }));

    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toBeVisible();

    // Stop faking the payload: from here the API answers normally again.
    await page.unroute('**/api/communities');

    await page.getByRole('link', { name: 'Usuarios', exact: true }).click();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole('heading', { name: 'Algo salió mal' })).toHaveCount(0);
    await expect(page.getByRole('heading', { level: 1, name: 'Usuarios' })).toBeVisible();
  });
});

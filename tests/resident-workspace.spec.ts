import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe('resident workspace', () => {
  test('resident lands on the workspace instead of the app-required screen', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);

    await expect(page).toHaveURL(/\/resident$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Mis autorizaciones' })).toBeVisible();
    await expect(page.getByText('Usá Zima QR Access')).toHaveCount(0);
  });

  test('sidebar only offers the resident entries', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);

    const sidebar = page.locator('[data-sidebar="sidebar"]').first();
    await expect(sidebar.getByRole('link', { name: 'Inicio' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Autorizaciones' })).toBeVisible();
    await expect(sidebar.getByRole('link', { name: 'Autorizar', exact: true })).toBeVisible();

    await expect(sidebar.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Unidades' })).toHaveCount(0);
  });

  test('home offers the quick actions and the empty state', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);

    await expect(page.getByRole('link', { name: /Autorizar una visita/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Historial/i })).toBeVisible();
    await expect(page.getByRole('status')).toHaveCount(0);
  });

  test('authorization form loads the authorizable destinations', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);
    await page.goto('/resident/authorizations/new');

    await expect(page.getByRole('heading', { level: 1, name: 'Autorizar visita' })).toBeVisible();
    await expect(page.locator('#resident-visitor-first')).toBeVisible();
    await expect(page.locator('#resident-valid-from')).toBeVisible();

    // The destination select is populated from /api/passes/destinations.
    await page.locator('#resident-destination').click();
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('history route renders inside the resident shell', async ({ page }) => {
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);
    await page.goto('/resident/authorizations');

    await expect(page.getByRole('heading', { level: 1, name: 'Autorizaciones' })).toBeVisible();
  });

  test('mobile viewport has no horizontal page scroll', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await loginAs(page, DEMO_USERS.resident);
    await expect(page).toHaveURL(/\/resident$/);

    const fits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(fits).toBe(true);

    await page.goto('/resident/authorizations/new');
    await expect(page.getByRole('heading', { level: 1, name: 'Autorizar visita' })).toBeVisible();

    const formFits = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    );
    expect(formFits).toBe(true);
  });
});

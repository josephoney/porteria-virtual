import { expect, type Page } from '@playwright/test';

export const DEMO_PASSWORD = 'porteria123';

export const DEMO_USERS = {
  platformAdmin: 'superadmin@porteria.local',
  orgAdmin: 'admin@porteria.local',
  orgAdminIndependent: 'admin2@porteria.local',
  communityAdmin: 'communityadmin@porteria.local',
  operator: 'operador@porteria.local',
  guard: 'guardia@porteria.local',
  resident: 'residente@porteria.local',
  multiContext: 'multi@porteria.local',
} as const;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Navigates to /login and submits the credentials form.
 * The caller is responsible for asserting where the app lands.
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string = DEMO_PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await expect(page.locator('[data-slot="card-title"]')).toHaveText('Iniciar Sesión');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
}

/** Opens the user dropdown in the sidebar footer and signs out. */
export async function logoutFromUserMenu(page: Page, email: string): Promise<void> {
  await page.getByRole('button', { name: new RegExp(escapeRegExp(email)) }).click();
  await page.getByRole('menuitem', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/login$/);
}

import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { DEMO_PASSWORD, DEMO_USERS, loginAs } from './helpers/auth';

const API_URL = 'http://localhost:3000';
const COMMUNITY_NAME = 'Torre Norte';

async function loginAndWait(page: Page, email: string, landing: RegExp) {
  await loginAs(page, email);
  await expect(page).toHaveURL(landing);
}

async function orgAdminToken(request: APIRequestContext): Promise<string> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: DEMO_USERS.orgAdmin, password: DEMO_PASSWORD },
  });
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

async function findCommunityId(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<string> {
  const response = await request.get(`${API_URL}/api/communities`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = (await response.json()) as
    | Array<{ id: string; name: string }>
    | { data: Array<{ id: string; name: string }> };
  const rows = Array.isArray(body) ? body : body.data;
  const match = rows.find((community) => community.name === name);
  if (!match) throw new Error(`No se encontró la comunidad ${name}`);
  return match.id;
}

/** Removes a node created by a test so the demo data stays unchanged. */
async function deleteNodeByName(
  request: APIRequestContext,
  token: string,
  communityId: string,
  name: string,
) {
  const headers = { authorization: `Bearer ${token}` };
  const response = await request.get(`${API_URL}/api/location-units?communityId=${communityId}`, {
    headers,
  });
  const body = (await response.json()) as
    | Array<{ id: string; name: string }>
    | { data: Array<{ id: string; name: string }> };
  const rows = Array.isArray(body) ? body : body.data;
  const node = rows.find((candidate) => candidate.name === name);
  if (!node) return;
  await request.delete(`${API_URL}/api/location-units/${node.id}`, { headers });
}

test.describe('nested units workspace', () => {
  test('expands three levels and keeps two branches open', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/units');

    await expect(page.getByRole('heading', { level: 1, name: 'Unidades' })).toBeVisible();
    await expect(page.getByLabel('Comunidad')).toContainText(COMMUNITY_NAME);

    const roots = page.locator('tbody tr[data-level="1"]');
    await expect(roots.first()).toBeVisible();
    expect(await roots.count()).toBeGreaterThan(1);

    // The demo community gained common-area branches that sort first and have no
    // level 3, so the test picks branches by what they can open instead of by
    // position: expand every root, then the first level-2 that can expand.
    const rootCount = await roots.count();
    for (let index = 0; index < rootCount; index += 1) {
      const toggle = roots.nth(index).getByRole('button', { name: /^Expandir / });
      if ((await toggle.count()) > 0) await toggle.click();
    }
    await expect(page.getByRole('button', { name: /^Contraer / })).not.toHaveCount(0);

    const secondLevel = page.locator('tbody tr[data-level="2"]');
    await expect(secondLevel.first()).toBeVisible();

    // A level-2 row can open even when it has no children yet (it then offers the
    // add action), so the test opens them all instead of guessing which branch is
    // the deep one. The demo data changes too often for positional assumptions.
    const closedSecond = secondLevel.getByRole('button', { name: /^Expandir / });
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if ((await closedSecond.count()) === 0) break;
      await closedSecond.first().click();
    }
    await expect(page.locator('tbody tr[data-level="3"]').first()).toBeVisible();

    // Collapsing the level-2 nodes hides their children again.
    const openSecond = secondLevel.getByRole('button', { name: /^Contraer / });
    for (let attempt = 0; attempt < 12; attempt += 1) {
      if ((await openSecond.count()) === 0) break;
      await openSecond.first().click();
    }
    await expect(page.locator('tbody tr[data-level="3"]')).toHaveCount(0);
  });

  test('adds a level-1 node without reloading the page', async ({ page, request }) => {
    const nodeName = `Torre QA ${Date.now()}`;
    const token = await orgAdminToken(request);
    const communityId = await findCommunityId(request, token, COMMUNITY_NAME);

    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/units');
    await expect(page.locator('tbody tr[data-level="1"]').first()).toBeVisible();

    try {
      await page
        .getByRole('button', { name: /Agregar torre/i })
        .last()
        .click();

      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await page.locator('#unit-node-name').fill(nodeName);

      const created = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' && response.url().endsWith('/api/location-units'),
      );
      await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();
      expect((await created).status()).toBeLessThan(300);

      await expect(dialog).toHaveCount(0);
      // The first cell also holds the toggle button and the child count, so its
      // accessible name is not just the node name.
      await expect(page.getByRole('cell').filter({ hasText: nodeName })).toBeVisible();
    } finally {
      await deleteNodeByName(request, token, communityId, nodeName);
    }
  });

  test('structure dialog is read-only and refreshes the community detail on close', async ({
    page,
  }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/communities');

    await page.getByRole('cell', { name: COMMUNITY_NAME, exact: true }).first().click();
    await expect(page.locator('dl').first()).toBeVisible();

    const refreshed = page.waitForResponse((response) => response.url().includes('/overview'));

    // The row itself has role="button" and its accessible name contains this
    // label, so match the inner button exactly.
    await page
      .getByRole('button', { name: `Ver estructura de ${COMMUNITY_NAME}`, exact: true })
      .first()
      .click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Editar estructura' })).toHaveCount(1);
    await expect(dialog.getByRole('button', { name: /^Agregar /i })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: /^Editar (?!estructura)/ })).toHaveCount(0);

    await dialog.getByRole('button', { name: 'Close' }).click();
    await expect(dialog).toHaveCount(0);

    // Closing the dialog must invalidate the cached overview.
    expect((await refreshed).status()).toBeLessThan(300);
  });

  test('dialog surfaces use the neutral popover token', async ({ page }) => {
    await loginAndWait(page, DEMO_USERS.orgAdmin, /\/admin$/);
    await page.goto('/admin/communities');

    await page
      .getByRole('button', { name: `Ver estructura de ${COMMUNITY_NAME}`, exact: true })
      .first()
      .click();

    const token = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--popover').trim(),
    );
    expect(token).toBe('oklch(0.9855 0.0045 258.3245)');
  });
});

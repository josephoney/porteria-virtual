import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

/**
 * El listado plano de unidades se prueba con la API interceptada: así se
 * verifica el contrato de request de los filtros sin tocar la base demo.
 */

const COMMUNITIES = [
  { id: 'community-torre-norte', name: 'Torre Norte' },
  { id: 'community-parque', name: 'Parque Verde' },
];

const SECTIONS = [
  { id: 'section-tower-a', name: 'Torre A', communityId: 'community-torre-norte' },
  { id: 'section-block-b', name: 'Bloque B', communityId: 'community-torre-norte' },
  { id: 'section-parque-1', name: 'Parque 1', communityId: 'community-parque' },
];

const UNITS = [
  {
    id: 'unit-a-101',
    communityId: 'community-torre-norte',
    communityName: 'Torre Norte',
    sectionId: 'section-tower-a',
    sectionName: 'Torre A',
    path: 'Torre A / Piso 2 / 101',
    name: '101',
    code: 'A-101',
    metadata: { legacyFloor: 2, legacyType: 'apartment' },
    status: 'active',
  },
  {
    id: 'unit-casa-1',
    communityId: 'community-parque',
    communityName: 'Parque Verde',
    sectionId: 'section-parque-1',
    sectionName: 'Parque 1',
    path: 'Parque 1 / Casa 1',
    name: 'Casa 1',
    code: 'C-1',
    metadata: {},
    status: 'inactive',
  },
];

interface CapturedRequest {
  url: URL;
}

async function mockUnitsApi(page: Page): Promise<{
  unitRequests: CapturedRequest[];
  sectionRequests: CapturedRequest[];
}> {
  const unitRequests: CapturedRequest[] = [];
  const sectionRequests: CapturedRequest[] = [];

  await page.route('**/api/platform/communities**', async (route) => {
    await route.fulfill({
      status: 200,
      json: { data: COMMUNITIES, total: COMMUNITIES.length, page: 1, pageSize: 100 },
    });
  });

  await page.route('**/api/communities', async (route) => {
    await route.fulfill({ status: 200, json: COMMUNITIES });
  });

  await page.route('**/api/sections**', async (route) => {
    const url = new URL(route.request().url());
    sectionRequests.push({ url });
    const communityId = url.searchParams.get('communityId');
    const data = communityId
      ? SECTIONS.filter((section) => section.communityId === communityId)
      : SECTIONS;
    await route.fulfill({
      status: 200,
      json: { data, total: data.length, page: 1, pageSize: 100 },
    });
  });

  await page.route('**/api/units**', async (route) => {
    const url = new URL(route.request().url());
    unitRequests.push({ url });

    const communityId = url.searchParams.get('communityId');
    const sectionId = url.searchParams.get('sectionId');
    const data = UNITS.filter(
      (unit) =>
        (!communityId || unit.communityId === communityId) &&
        (!sectionId || unit.sectionId === sectionId),
    );
    await route.fulfill({
      status: 200,
      json: { data, total: data.length, page: 1, pageSize: 10 },
    });
  });

  return { unitRequests, sectionRequests };
}

test.describe('Units page', () => {
  test('lists code, unit/section, community, type, floor and status', async ({ page }) => {
    await mockUnitsApi(page);

    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
    await page.goto('/platform/units');

    await expect(page.getByRole('heading', { level: 1, name: 'Unidades' })).toBeVisible();

    for (const column of ['Código', 'Unidad / sección', 'Comunidad', 'Tipo', 'Piso', 'Estado']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }

    const row = page.getByRole('row').filter({ hasText: 'A-101' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('101');
    await expect(row).toContainText('Torre A');
    await expect(row).toContainText('Torre Norte');
    await expect(row).toContainText('Apartamento');
    await expect(row).toContainText('Activa');

    // Sin `legacyType` ni `legacyFloor`, las celdas quedan vacías visualmente.
    const emptyRow = page.getByRole('row').filter({ hasText: 'C-1' });
    await expect(emptyRow).toContainText('Parque 1');
    await expect(emptyRow).toContainText('Inactiva');
    await expect(emptyRow.getByRole('cell').nth(3)).toHaveText('—');
    await expect(emptyRow.getByRole('cell').nth(4)).toHaveText('—');
  });

  test('community and section filters map to the API query', async ({ page }) => {
    const { unitRequests, sectionRequests } = await mockUnitsApi(page);

    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/units');
    await expect(page.getByRole('heading', { level: 1, name: 'Unidades' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Filtrar por comunidad' }).click();
    await page.getByRole('option', { name: 'Torre Norte', exact: true }).click();

    await expect
      .poll(() =>
        sectionRequests.some(
          (request) => request.url.searchParams.get('communityId') === 'community-torre-norte',
        ),
      )
      .toBe(true);

    await page.getByRole('combobox', { name: 'Filtrar por sección' }).click();
    await page.getByRole('option', { name: 'Torre A', exact: true }).click();

    await page.getByRole('combobox', { name: 'Filtrar por estado' }).click();
    await page.getByRole('option', { name: 'Activa', exact: true }).click();

    await expect
      .poll(() =>
        unitRequests.some(
          (request) =>
            request.url.searchParams.get('communityId') === 'community-torre-norte' &&
            request.url.searchParams.get('sectionId') === 'section-tower-a' &&
            request.url.searchParams.get('status') === 'active',
        ),
      )
      .toBe(true);

    const last = [...unitRequests]
      .reverse()
      .find((request) => request.url.searchParams.get('sectionId') === 'section-tower-a');
    expect(last).toBeDefined();
    expect(last!.url.searchParams.get('communityId')).toBe('community-torre-norte');
    expect(last!.url.searchParams.get('page')).toBe('1');
    expect(last!.url.searchParams.get('pageSize')).toBe('10');
  });
});

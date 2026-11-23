import { test, expect, type Page } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

/**
 * Secciones se prueba con la API interceptada: así se verifica el contrato de
 * request (filtros y payloads) sin dejar filas nuevas en la base de desarrollo.
 * El listado base sí usa la API real porque es de sólo lectura.
 */

const COMMUNITIES = [{ id: 'community-torre-norte', name: 'Torre Norte' }];

const SECTIONS = [
  {
    id: 'section-tower-a',
    communityId: 'community-torre-norte',
    communityName: 'Torre Norte',
    name: 'Torre A',
    code: 'A',
    sectionType: 'tower',
    sectionTypeLabel: null,
    levelCount: 3,
    unitCount: 10,
    status: 'active',
  },
  {
    id: 'section-common',
    communityId: 'community-torre-norte',
    communityName: 'Torre Norte',
    name: 'Zona Social',
    code: 'ZS',
    sectionType: 'other',
    sectionTypeLabel: 'Zona común',
    levelCount: 1,
    unitCount: 0,
    status: 'active',
  },
];

interface CapturedRequest {
  method: string;
  url: URL;
  body: Record<string, unknown> | null;
}

async function mockSectionsApi(page: Page): Promise<CapturedRequest[]> {
  const requests: CapturedRequest[] = [];

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
    const request = route.request();
    const method = request.method();
    requests.push({
      method,
      url: new URL(request.url()),
      body: method === 'GET' ? null : (request.postDataJSON() as Record<string, unknown>),
    });

    if (method === 'POST') {
      await route.fulfill({ status: 201, json: { ...SECTIONS[0], id: 'section-created' } });
      return;
    }
    if (method === 'PATCH') {
      await route.fulfill({ status: 200, json: { ...SECTIONS[0], sectionType: 'block' } });
      return;
    }

    await route.fulfill({
      status: 200,
      json: { data: SECTIONS, total: SECTIONS.length, page: 1, pageSize: 10 },
    });
  });

  return requests;
}

test.describe('Sections page', () => {
  test('lists name, type, community, levels, units and status', async ({ page }) => {
    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
    await page.goto('/platform/sections');

    await expect(page.getByRole('heading', { level: 1, name: 'Secciones' })).toBeVisible();

    for (const column of [
      'Nombre',
      'Código',
      'Tipo',
      'Comunidad',
      'Niveles',
      'Unidades',
      'Estado',
      'Acciones',
    ]) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }

    // La base de desarrollo acumula secciones de otras pruebas, así que la
    // búsqueda acota la tabla a la fila que este test necesita.
    await page.getByLabel('Buscar por nombre o código…').fill('Torre A');

    const row = page.getByRole('row').filter({ hasText: 'Torre A' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('Edificio');
    await expect(row).toContainText('Torre Norte');
    await expect(row).toContainText('Activa');
  });

  test('community, type and search filters map to the API query', async ({ page }) => {
    const requests = await mockSectionsApi(page);

    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
    await page.goto('/platform/sections');
    await expect(page.getByRole('heading', { level: 1, name: 'Secciones' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Filtrar por comunidad' }).click();
    await page.getByRole('option', { name: 'Torre Norte', exact: true }).click();

    await page.getByRole('combobox', { name: 'Filtrar por tipo de sección' }).click();
    await page.getByRole('option', { name: 'Torre', exact: true }).click();

    await page.getByLabel('Buscar por nombre o código…').fill('Torre A');

    await expect
      .poll(() =>
        requests
          .filter((request) => request.method === 'GET')
          .some((request) => request.url.searchParams.get('search') === 'Torre A'),
      )
      .toBe(true);

    const last = [...requests]
      .reverse()
      .find(
        (request) =>
          request.method === 'GET' && request.url.searchParams.get('search') === 'Torre A',
      );
    expect(last).toBeDefined();
    expect(last!.url.searchParams.get('communityId')).toBe('community-torre-norte');
    expect(last!.url.searchParams.get('type')).toBe('tower');
    expect(last!.url.searchParams.get('page')).toBe('1');
  });

  test('create with type other sends the custom label', async ({ page }) => {
    await mockSectionsApi(page);

    await loginAs(page, DEMO_USERS.orgAdmin);
    await expect(page).toHaveURL(/\/admin$/);
    await page.goto('/admin/sections');
    await page.getByRole('button', { name: 'Crear sección' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Nueva sección' })).toBeVisible();

    await dialog.getByRole('combobox', { name: 'Comunidad' }).click();
    await page.getByRole('option', { name: 'Torre Norte', exact: true }).click();
    await dialog.locator('#section-name').fill('Zona Social');
    await dialog.locator('#section-code').fill('ZS');
    await dialog.getByRole('combobox', { name: 'Tipo de sección' }).click();
    await page.getByRole('option', { name: 'Otro', exact: true }).click();
    await dialog.locator('#section-type-label').fill('Zona común');

    const postRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/sections'),
    );
    await dialog.getByRole('button', { name: 'Crear sección' }).click();
    const post = await postRequest;

    expect(post.postDataJSON()).toMatchObject({
      communityId: 'community-torre-norte',
      name: 'Zona Social',
      code: 'ZS',
      sectionType: 'other',
      sectionTypeLabel: 'Zona común',
    });
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('edit sends the new section type', async ({ page }) => {
    await mockSectionsApi(page);

    await loginAs(page, DEMO_USERS.platformAdmin);
    await expect(page).toHaveURL(/\/platform$/);
    await page.goto('/platform/sections');
    await page.getByRole('button', { name: 'Editar Torre A' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Editar sección' })).toBeVisible();
    await expect(dialog.locator('#section-name')).toHaveValue('Torre A');

    await dialog.getByRole('combobox', { name: 'Tipo de sección' }).click();
    await page.getByRole('option', { name: 'Bloque', exact: true }).click();

    const patchRequest = page.waitForRequest((request) => request.method() === 'PATCH');
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
    const patch = await patchRequest;

    expect(new URL(patch.url()).pathname).toMatch(/\/api\/sections\/section-tower-a$/);
    expect(patch.postDataJSON()).toMatchObject({
      name: 'Torre A',
      code: 'A',
      sectionType: 'block',
    });
    expect(patch.postDataJSON()).not.toHaveProperty('sectionTypeLabel');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });
});

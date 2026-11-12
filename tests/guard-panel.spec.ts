import { expect, test } from '@playwright/test';
import { DEMO_USERS, loginAs } from './helpers/auth';

test.describe.configure({ mode: 'serial' });

test.describe('guard panel and access bitacora', () => {
  test('guard starts a shift, adds a manual entry and ends the shift', async ({ page }) => {
    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);

    await expect(page.getByText('Turno actual', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar turno|Cerrar turno/ })).toBeVisible();

    const endShiftButton = page.getByRole('button', { name: 'Cerrar turno', exact: true });
    if (await endShiftButton.isVisible()) {
      page.once('dialog', (dialog) => dialog.accept());
      await endShiftButton.click();
      await expect(page.getByRole('button', { name: 'Iniciar turno', exact: true })).toBeVisible();
    }

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Puerta Principal', exact: true }).click();
    await page.getByRole('button', { name: 'Iniciar turno', exact: true }).click();

    const currentShiftCard = page.locator('[data-slot="card"]').filter({ hasText: 'Turno actual' });
    await expect(currentShiftCard.getByText('Abierto', { exact: true })).toBeVisible();
    await expect(currentShiftCard.getByText(/Acceso:/)).toContainText('Puerta Principal');

    const manualSummary = `E2E novedad ${Date.now()}`;
    await page.getByRole('button', { name: 'Agregar novedad', exact: true }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('Agregar novedad', { exact: true })).toBeVisible();
    await dialog.getByRole('combobox').click();
    await page.getByRole('option', { name: 'Puerta Principal', exact: true }).click();
    await dialog.locator('#manual-summary').fill(manualSummary);
    await dialog.getByRole('button', { name: 'Guardar', exact: true }).click();

    await expect(dialog).toBeHidden();
    await expect(page.getByText(manualSummary, { exact: true })).toBeVisible();

    page.once('dialog', (confirmDialog) => confirmDialog.accept());
    await page.getByRole('button', { name: 'Cerrar turno', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Iniciar turno', exact: true })).toBeVisible();
  });

  test('the refresh button reloads the bitacora without reloading the page', async ({ page }) => {
    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);

    // The bitacora only renders with an open shift, so make sure there is one.
    // Wait for the panel to finish loading first: `isVisible` is false while the
    // skeletons are up and would silently skip the start.
    await expect(page.getByText('Turno actual', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Iniciar turno|Cerrar turno/ })).toBeVisible();

    const startShiftButton = page.getByRole('button', { name: 'Iniciar turno', exact: true });
    if (await startShiftButton.isVisible()) {
      await page.getByRole('combobox').first().click();
      await page.getByRole('option', { name: 'Puerta Principal', exact: true }).click();
      await startShiftButton.click();
      await expect(page.getByRole('button', { name: 'Cerrar turno', exact: true })).toBeVisible();
    }

    let bitacoraRequests = 0;
    page.on('request', (request) => {
      if (request.method() === 'GET' && request.url().includes('/api/bitacora?')) {
        bitacoraRequests += 1;
      }
    });

    const before = bitacoraRequests;
    const refreshButton = page.getByRole('button', { name: 'Actualizar', exact: true });
    await expect(refreshButton).toBeEnabled();
    await refreshButton.click();

    // The bug was that the button only refetched the shift, never the table.
    await expect.poll(() => bitacoraRequests).toBeGreaterThan(before);
    await expect(refreshButton).toBeEnabled();
    await expect(page).toHaveURL(/\/guard$/);

    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Cerrar turno', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Iniciar turno', exact: true })).toBeVisible();
  });

  test('community admin sees the access bitacora with destination and authorizer', async ({
    page,
  }) => {
    await loginAs(page, DEMO_USERS.communityAdmin);
    await expect(page).toHaveURL(/\/admin$/);

    await page.goto('/analysis/bitacora-accesos');
    await expect(page.getByRole('heading', { name: 'Bitácora de accesos' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Destino', exact: true })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Autorizó', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Agregar novedad', exact: true })).toBeVisible();
  });

  test('polls the bitacora with a single row while a shift is open', async ({ page }) => {
    await loginAs(page, DEMO_USERS.guard);
    await expect(page).toHaveURL(/\/guard$/);

    await expect(page.getByText('Turno actual', { exact: true })).toBeVisible();
    const closeButton = page.getByRole('button', { name: 'Cerrar turno', exact: true });
    const startShiftButton = page.getByRole('button', { name: 'Iniciar turno', exact: true });
    await expect(page.getByRole('button', { name: /Iniciar turno|Cerrar turno/ })).toBeVisible();

    // Serial mode leaves the shift closed, but a previous failure could not.
    if (await closeButton.isVisible()) {
      page.once('dialog', (dialog) => dialog.accept());
      await closeButton.click();
      await expect(startShiftButton).toBeVisible();
    }

    // The poll asks for one row, so `pageSize=1` tells it apart from the table,
    // which loads 20.
    let polls = 0;
    page.on('request', (request) => {
      const url = request.url();
      if (
        request.method() === 'GET' &&
        url.includes('/api/bitacora?') &&
        url.includes('pageSize=1')
      ) {
        polls += 1;
      }
    });

    await page.getByRole('combobox').first().click();
    await page.getByRole('option', { name: 'Puerta Principal', exact: true }).click();
    await startShiftButton.click();
    await expect(closeButton).toBeVisible();

    // Opening the shift registers the poll and the first tick fires right away,
    // so this does not wait a full interval.
    await expect.poll(() => polls, { timeout: 20_000 }).toBeGreaterThan(0);

    page.once('dialog', (dialog) => dialog.accept());
    await closeButton.click();
    await expect(startShiftButton).toBeVisible();
  });
});

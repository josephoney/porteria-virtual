import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

const API_URL = 'http://127.0.0.1:3003';
const PASSWORD = 'porteria123';
const VISITOR_DOCUMENT = '99887766';

interface LoginResult {
  accessToken: string;
  activeMembership: {
    locationUnitId: string | null;
  };
}

interface CreatedPass {
  pass: { id: string };
  shareUrl: string;
  qrToken: string;
}

async function assertOk(response: APIResponse, label: string) {
  if (!response.ok()) {
    throw new Error(`${label}: ${response.status()} ${await response.text()}`);
  }
}

async function login(request: APIRequestContext, email: string): Promise<LoginResult> {
  const response = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password: PASSWORD },
  });
  await assertOk(response, `login ${email}`);
  return (await response.json()) as LoginResult;
}

async function createPass(
  request: APIRequestContext,
  accessToken: string,
  locationUnitId: string,
  type: 'entry_only' | 'entry_exit',
): Promise<CreatedPass> {
  const now = Date.now();
  const response = await request.post(`${API_URL}/api/passes`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    data: {
      locationUnitId,
      visitorFirstName: 'E2E',
      visitorLastName: 'Visitante',
      visitorDocument: VISITOR_DOCUMENT,
      type,
      validFrom: new Date(now - 60_000).toISOString(),
      validUntil: new Date(now + 3_600_000).toISOString(),
    },
  });
  await assertOk(response, 'create pass');
  return (await response.json()) as CreatedPass;
}

async function currentQr(page: import('@playwright/test').Page, shareUrl: string) {
  const token = shareUrl.split('/p/')[1]!;
  const origin = new URL(shareUrl).origin;
  const response = await page.request.get(`${origin}/api/public/passes/${token}/qr`);
  await assertOk(response, 'qr');
  return ((await await response.json()) as { token: string }).token;
}

async function scanAndConfirm(
  request: APIRequestContext,
  guardToken: string,
  qrToken: string,
): Promise<{ action: string; passStatus: string }> {
  const scan = await request.post(`${API_URL}/api/access/scan`, {
    headers: { Authorization: `Bearer ${guardToken}` },
    data: { token: qrToken },
  });
  await assertOk(scan, 'scan');
  const scanned = (await scan.json()) as { scanId: string; authorized: boolean; action: string };
  expect(scanned.authorized).toBe(true);

  const confirm = await request.post(`${API_URL}/api/access/scans/${scanned.scanId}/confirm`, {
    headers: { Authorization: `Bearer ${guardToken}` },
    data: {},
  });
  await assertOk(confirm, 'confirm');
  const confirmed = (await confirm.json()) as { action: string; passStatus: string };
  return { action: confirmed.action, passStatus: confirmed.passStatus };
}

test.describe('pass-web visitor flow', () => {
  test('resident creates an entry_only pass, visitor shows the QR and the guard confirms it', async ({
    browser,
    request,
  }) => {
    const resident = await login(request, 'residente@porteria.local');
    const guard = await login(request, 'guardia@porteria.local');
    expect(resident.activeMembership.locationUnitId).toBeTruthy();

    const created = await createPass(
      request,
      resident.accessToken,
      resident.activeMembership.locationUnitId!,
      'entry_only',
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(created.shareUrl);

    await expect(page.getByRole('heading', { name: 'Pase de visita' })).toBeVisible();
    await expect(page.getByText('Hola, E2E.')).toBeVisible();
    await page.getByRole('button', { name: 'Mostrar mi QR' }).click();

    await expect(page.locator('.qr-box svg')).toBeVisible();
    await expect(page.getByText(/Se actualiza solo/)).toBeVisible();

    const qrToken = await currentQr(page, created.shareUrl);
    const confirmed = await scanAndConfirm(request, guard.accessToken, qrToken);
    expect(confirmed.action).toBe('entry');
    expect(confirmed.passStatus).toBe('used');

    await expect(page.getByText('Este pase ya fue utilizado.')).toBeVisible({ timeout: 20_000 });
    await context.close();
  });

  test('resident creates an entry_exit pass, guard confirms entry and exit', async ({
    browser,
    request,
  }) => {
    const resident = await login(request, 'residente@porteria.local');
    const guard = await login(request, 'guardia@porteria.local');
    expect(resident.activeMembership.locationUnitId).toBeTruthy();

    const created = await createPass(
      request,
      resident.accessToken,
      resident.activeMembership.locationUnitId!,
      'entry_exit',
    );

    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(created.shareUrl);

    await expect(page.getByText('Hola, E2E.')).toBeVisible();
    await page.getByRole('button', { name: 'Mostrar mi QR' }).click();
    await expect(page.locator('.qr-box svg')).toBeVisible();

    const entryQr = await currentQr(page, created.shareUrl);
    const entry = await scanAndConfirm(request, guard.accessToken, entryQr);
    expect(entry.action).toBe('entry');
    expect(entry.passStatus).toBe('active');

    await expect(page.getByText('Dentro', { exact: true })).toBeVisible({ timeout: 20_000 });

    const exitQr = await currentQr(page, created.shareUrl);
    const exit = await scanAndConfirm(request, guard.accessToken, exitQr);
    expect(exit.action).toBe('exit');
    expect(exit.passStatus).toBe('used');

    await expect(page.getByText('Este pase ya fue utilizado.')).toBeVisible({ timeout: 20_000 });
    await context.close();
  });
});

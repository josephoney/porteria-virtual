import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';

process.env.OUTBOX_WORKER_ENABLED = 'false';
process.env.NODE_ENV = 'test';
process.env.DYNAMIC_QR_ENABLED = 'true';
process.env.PASS_QR_SECRET = 'contract-test-secret-0123456789abcdef';

let app: FastifyInstance;

before(async () => {
  const { buildApp } = await import('../src/index.js');
  app = (await buildApp()).app;
});

after(async () => {
  await app.close();
});

async function inject(method: 'GET' | 'POST', url: string, payload?: unknown) {
  return app.inject({
    method,
    url,
    payload: payload as Record<string, unknown> | undefined,
  });
}

function assertErrorEnvelope(body: unknown, statusCode: number) {
  assert.equal(typeof body, 'object');
  assert.equal((body as { statusCode?: unknown }).statusCode, statusCode);
  assert.equal(typeof (body as { error?: unknown }).error, 'string');
  assert.equal(typeof (body as { message?: unknown }).message, 'string');
}

describe('API v1 contract', () => {
  it('exposes liveness with version metadata', async () => {
    const response = await inject('GET', '/health');
    assert.equal(response.statusCode, 200);
    const body = response.json() as { status: string; service: string; version: string };
    assert.equal(body.status, 'ok');
    assert.equal(body.service, 'api');
    assert.equal(typeof body.version, 'string');
  });

  it('exposes readiness with a database check', async () => {
    const response = await inject('GET', '/ready');
    assert.equal(response.statusCode, 200);
    const body = response.json() as { status: string; db: string };
    assert.equal(body.status, 'ready');
    assert.equal(body.db, 'ok');
  });

  it('freezes the API version and contract number', async () => {
    const response = await inject('GET', '/api/version');
    assert.equal(response.statusCode, 200);
    const body = response.json() as { api: string; contract: number };
    assert.equal(body.api, 'v1');
    assert.equal(body.contract, 1);
  });

  it('exposes feature flags as booleans', async () => {
    const response = await inject('GET', '/api/features');
    assert.equal(response.statusCode, 200);
    const body = response.json() as {
      configurableLocationHierarchy: boolean;
      dynamicQrEnabled: boolean;
    };
    assert.equal(typeof body.configurableLocationHierarchy, 'boolean');
    assert.equal(typeof body.dynamicQrEnabled, 'boolean');
  });

  it('returns the validation error envelope', async () => {
    const response = await inject('POST', '/api/auth/login', {});
    assert.equal(response.statusCode, 400);
    const body = response.json() as {
      statusCode: number;
      error: string;
      message: string;
      details: unknown[];
    };
    assertErrorEnvelope(body, 400);
    assert.equal(body.error, 'Bad Request');
    assert.equal(body.message, 'Validation error');
    assert.ok(Array.isArray(body.details));
  });

  it('requires a bearer token on protected route groups', async () => {
    const routes = [
      '/api/passes',
      '/api/access/scans',
      '/api/bitacora',
      '/api/guard/shifts/current',
    ];

    for (const url of routes) {
      const response = await inject('GET', url);
      assert.equal(response.statusCode, 401, `expected 401 for ${url}`);
      assertErrorEnvelope(response.json(), 401);
    }
  });

  it('returns 404 for an unknown API route', async () => {
    const response = await inject('GET', '/api/does-not-exist');
    assert.equal(response.statusCode, 404);
    assertErrorEnvelope(response.json(), 404);
  });

  it('returns 404 for an unknown public pass token', async () => {
    const response = await inject('GET', '/api/public/passes/token-que-no-existe');
    assert.equal(response.statusCode, 404);
    const body = response.json() as { statusCode: number; error: string; message: string };
    assertErrorEnvelope(body, 404);
    assert.equal(body.message, 'not_found');
  });
});

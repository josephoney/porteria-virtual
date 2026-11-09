import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { can, type AdminRequester } from '../src/services/admin-permissions.service.js';

const org = '11111111-1111-1111-1111-111111111111';
const community = '22222222-2222-2222-2222-222222222222';
const otherCommunity = '33333333-3333-3333-3333-333333333333';

function requester(overrides: Partial<AdminRequester>): AdminRequester {
  return {
    role: 'org_admin',
    orgId: org,
    communityId: null,
    isPlatformAdmin: false,
    ...overrides,
  };
}

describe('admin permissions', () => {
  it('allows org admin to manage communities and structure in scope', () => {
    const user = requester({});
    assert.equal(can(user, 'community.create', { organizationId: org }), true);
    assert.equal(can(user, 'location.write', { organizationId: org, communityId: community }), true);
    assert.equal(can(user, 'reports.read', { organizationId: org }), true);
  });

  it('restricts community admin to its community and forbids community creation', () => {
    const user = requester({ role: 'community_admin', communityId: community });
    assert.equal(can(user, 'community.update', { organizationId: org, communityId: community }), true);
    assert.equal(can(user, 'community.create', { organizationId: org, communityId: community }), false);
    assert.equal(can(user, 'location.write', { organizationId: org, communityId: otherCommunity }), false);
  });

  it('keeps platform admin read-only for tenant data', () => {
    const user = requester({ role: 'staff', isPlatformAdmin: true });
    assert.equal(can(user, 'community.read', { organizationId: org }), true);
    assert.equal(can(user, 'community.update', { organizationId: org }), false);
    assert.equal(can(user, 'location.write', { organizationId: org, communityId: community }), false);
  });

  it('allows guard and operator only read access', () => {
    for (const role of ['guard', 'operator']) {
      const user = requester({ role, communityId: community });
      assert.equal(can(user, 'community.read', { organizationId: org, communityId: community }), true);
      assert.equal(can(user, 'location.read', { organizationId: org, communityId: community }), true);
      assert.equal(can(user, 'location.write', { organizationId: org, communityId: community }), false);
      assert.equal(can(user, 'people.write', { organizationId: org, communityId: community }), false);
    }
  });

  it('rejects cross-organization scopes', () => {
    const user = requester({});
    assert.equal(can(user, 'community.read', { organizationId: 'other-org' }), false);
  });
});

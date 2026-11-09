import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assignableRoles, canAssignRole } from '../src/services/role-policy.service.js';

describe('canAssignRole', () => {
  it('lets a platform admin assign every role', () => {
    const requester = { role: 'platform_admin', isPlatformAdmin: true };
    for (const role of assignableRoles(requester)) {
      assert.equal(canAssignRole(requester, role), true, role);
    }
  });

  it('does not let an org_admin create another org_admin', () => {
    const requester = { role: 'org_admin', isPlatformAdmin: false };
    assert.equal(canAssignRole(requester, 'org_admin'), false);
    assert.equal(canAssignRole(requester, 'community_admin'), true);
    assert.equal(canAssignRole(requester, 'operator'), true);
  });

  it('limits a community_admin to community roles', () => {
    const requester = { role: 'community_admin', isPlatformAdmin: false };
    assert.equal(canAssignRole(requester, 'org_admin'), false);
    assert.equal(canAssignRole(requester, 'community_admin'), false);
    assert.equal(canAssignRole(requester, 'operator'), true);
    assert.equal(canAssignRole(requester, 'tenant'), true);
  });

  it('rejects non-manager roles', () => {
    for (const role of ['operator', 'guard', 'resident', 'tenant'] as const) {
      const requester = { role, isPlatformAdmin: false };
      assert.equal(canAssignRole(requester, 'operator'), false, role);
      assert.deepEqual(assignableRoles(requester), [], role);
    }
  });
});

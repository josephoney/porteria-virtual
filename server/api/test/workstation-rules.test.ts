import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateWorkstationTarget } from '../src/lib/workstation-rules.js';

const base = {
  isPlatformAdmin: false,
  actorRole: 'community_admin',
  membershipRole: 'guard',
  membershipCommunityId: 'community-1',
  accessPointId: null,
  accessPoint: null,
};

describe('evaluateWorkstationTarget', () => {
  it('allows assigning an active access point of the community', () => {
    assert.equal(
      evaluateWorkstationTarget({ ...base, accessPointId: 'ap-1', accessPoint: { active: true } }),
      null,
    );
  });

  it('allows clearing the workstation', () => {
    assert.equal(evaluateWorkstationTarget(base), null);
  });

  it('allows an org admin to assign', () => {
    assert.equal(
      evaluateWorkstationTarget({
        ...base,
        actorRole: 'org_admin',
        accessPointId: 'ap-1',
        accessPoint: { active: true },
      }),
      null,
    );
  });

  it('rejects the platform admin: tenant data is read-only for it', () => {
    assert.equal(evaluateWorkstationTarget({ ...base, isPlatformAdmin: true }), 'tenant_read_only');
  });

  it('rejects actors without a management role', () => {
    for (const actorRole of ['guard', 'operator', 'owner', 'tenant', 'resident', 'staff']) {
      assert.equal(evaluateWorkstationTarget({ ...base, actorRole }), 'forbidden', actorRole);
    }
  });

  it('rejects memberships that are not guard memberships', () => {
    for (const membershipRole of [
      'operator',
      'owner',
      'tenant',
      'resident',
      'staff',
      'community_admin',
      'org_admin',
    ]) {
      assert.equal(
        evaluateWorkstationTarget({ ...base, membershipRole }),
        'role_not_guard',
        membershipRole,
      );
    }
  });

  it('rejects a membership without community', () => {
    assert.equal(
      evaluateWorkstationTarget({ ...base, membershipCommunityId: null }),
      'membership_requires_community',
    );
  });

  it('rejects an access point that does not belong to the community', () => {
    assert.equal(
      evaluateWorkstationTarget({ ...base, accessPointId: 'ap-1', accessPoint: null }),
      'not_found',
    );
  });

  it('rejects an inactive access point', () => {
    assert.equal(
      evaluateWorkstationTarget({
        ...base,
        accessPointId: 'ap-1',
        accessPoint: { active: false },
      }),
      'access_point_inactive',
    );
  });

  it('returns the most specific reason first', () => {
    assert.equal(
      evaluateWorkstationTarget({ ...base, isPlatformAdmin: true, membershipRole: 'resident' }),
      'tenant_read_only',
    );
    assert.equal(
      evaluateWorkstationTarget({ ...base, actorRole: 'guard', membershipRole: 'resident' }),
      'forbidden',
    );
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { passTicketState, type PassTicketPass } from '@porteria/shared';

const tomorrow = () => new Date(Date.now() + 86_400_000);
const yesterday = () => new Date(Date.now() - 86_400_000);

function pass(overrides: Partial<PassTicketPass> = {}): PassTicketPass {
  return {
    type: 'entry_exit',
    status: 'active',
    presenceState: 'outside',
    recurrence: 'once',
    maxUses: 1,
    exitCount: 0,
    validUntil: tomorrow(),
    ...overrides,
  };
}

describe('passTicketState', () => {
  it('shows a green pending state before the first entry', () => {
    const state = passTicketState(pass({ maxUses: 2 }));

    assert.equal(state.kind, 'pending');
    assert.equal(state.tone, 'success');
  });

  it('shows the inside state while the visitor is inside', () => {
    const state = passTicketState(pass({ presenceState: 'inside' }));

    assert.equal(state.kind, 'inside');
    assert.equal(state.tone, 'warning');
  });

  it('shows a green re-entry state after a completed cycle with uses left', () => {
    const state = passTicketState(pass({ maxUses: 2, exitCount: 1 }));

    assert.equal(state.kind, 'reentry');
    assert.equal(state.tone, 'success');
    assert.match(state.detail, /Queda 1 uso/);
  });

  it('shows daily exhaustion as a warning for recurring passes', () => {
    const state = passTicketState(
      pass({ recurrence: 'range', exitCount: 1, rule: { remainingUses: 0 } }),
    );

    assert.equal(state.kind, 'exhausted');
    assert.equal(state.tone, 'danger');
    assert.equal(state.label, 'Sin usos hoy');
  });

  it('shows the final used state when a once pass is exhausted', () => {
    const state = passTicketState(pass({ status: 'used' }));

    assert.equal(state.kind, 'used');
    assert.equal(state.tone, 'danger');
  });

  it('shows expired before the remaining active states', () => {
    const state = passTicketState(pass({ validUntil: yesterday() }));

    assert.equal(state.kind, 'expired');
  });

  it('shows revoked before expired', () => {
    const state = passTicketState(pass({ status: 'revoked', validUntil: yesterday() }));

    assert.equal(state.kind, 'revoked');
  });

  it('keeps an entry-only pass pending until it is used', () => {
    const state = passTicketState(pass({ type: 'entry_only' }));

    assert.equal(state.kind, 'pending');
  });
});

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { onPassEvent, publishPassEvent, type PassEvent } from '../src/lib/pass-bus.js';

describe('pass bus', () => {
  it('delivers the event to the owner and to nobody else', () => {
    const alice: PassEvent[] = [];
    const bob: PassEvent[] = [];

    const unsubscribeAlice = onPassEvent((event) => {
      if (event.personId === 'alice') alice.push(event);
    });
    const unsubscribeBob = onPassEvent((event) => {
      if (event.personId === 'bob') bob.push(event);
    });

    try {
      publishPassEvent({ personId: 'alice', passId: 'pass-1', status: 'used' });

      assert.equal(alice.length, 1);
      assert.equal(alice[0].passId, 'pass-1');
      assert.equal(bob.length, 0, 'the other resident must not receive it');
    } finally {
      unsubscribeAlice();
      unsubscribeBob();
    }
  });

  it('stops delivering after the subscription is cancelled', () => {
    const received: PassEvent[] = [];
    const unsubscribe = onPassEvent((event) => received.push(event));

    publishPassEvent({ personId: 'alice', passId: 'pass-1', status: 'used' });
    unsubscribe();
    publishPassEvent({ personId: 'alice', passId: 'pass-2', status: 'revoked' });

    assert.equal(received.length, 1);
    assert.equal(received[0].passId, 'pass-1');
  });
});

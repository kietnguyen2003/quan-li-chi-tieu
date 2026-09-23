import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveSessionAmount } from '../src/transaction-helpers.ts';

test('zero-value session snapshots stay zero after a class price changes', () => {
  assert.equal(resolveSessionAmount({ id: 'session', classId: 'class', date: '2026-09-22', sessionHours: 1.5, sessionAmount: 0 }, { id: 'class', name: 'Lớp', salary: 200000, durationHours: 1.5, note: '' }), 0);
});

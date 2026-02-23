import { describe, it, expect } from 'vitest';
import { cancelDispatch, isDispatching } from './auto-dispatch.service';

// ============================================================
// Auto-Dispatch State Management Tests
//
// Tests for the in-memory dispatch state tracking functions.
// These don't need database or socket mocks.
// ============================================================

describe('isDispatching', () => {
  it('returns false for non-existent order', () => {
    expect(isDispatching('non-existent-order-id')).toBe(false);
  });

  it('returns false for a random UUID', () => {
    expect(isDispatching('550e8400-e29b-41d4-a716-446655440000')).toBe(false);
  });
});

describe('cancelDispatch', () => {
  it('does not throw when cancelling non-existent dispatch', () => {
    expect(() => cancelDispatch('non-existent-order-id')).not.toThrow();
  });

  it('is idempotent — can cancel same order twice', () => {
    expect(() => {
      cancelDispatch('some-order');
      cancelDispatch('some-order');
    }).not.toThrow();
  });
});

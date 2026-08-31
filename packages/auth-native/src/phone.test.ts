import { describe, expect, it } from 'vitest';
import { normalizePhoneNumber } from './phone';

describe('normalizePhoneNumber', () => {
  it.each([
    ['024 123 4567', '+233241234567'],
    ['233241234567', '+233241234567'],
    ['+233 (24) 123-4567', '+233241234567'],
    ['241234567', '+233241234567'],
  ])('normalizes %s to Ghana E.164', (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });

  it.each(['+2348012345678', '+1 202 555 0123', '024123456', 'phone0241234567', ''])(
    'rejects unsupported input %s',
    (input) => {
      expect(normalizePhoneNumber(input)).toBe('');
    },
  );
});

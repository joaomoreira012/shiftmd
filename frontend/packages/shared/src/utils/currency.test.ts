import { describe, it, expect } from 'vitest';
import { formatEuros, eurosToCents, centsToEuros } from './currency';

describe('formatEuros', () => {
  it('formats 0 cents', () => {
    const result = formatEuros(0);
    expect(result).toContain('0,00');
    expect(result).toContain('€');
  });

  it('formats 100 cents as 1 EUR', () => {
    const result = formatEuros(100);
    expect(result).toContain('1,00');
    expect(result).toContain('€');
  });

  it('formats 254050 cents correctly', () => {
    const result = formatEuros(254050);
    // 254050 cents = 2540.50 EUR
    expect(result).toContain('2');
    expect(result).toContain('540,50');
    expect(result).toContain('€');
  });

  it('formats negative values', () => {
    const result = formatEuros(-500);
    // -500 cents = -5.00 EUR
    expect(result).toContain('5,00');
    expect(result).toContain('€');
  });

  it('uses pt-PT locale by default', () => {
    const result = formatEuros(100);
    // pt-PT uses comma as decimal separator
    expect(result).toContain(',');
  });

  it('accepts a custom locale', () => {
    const result = formatEuros(100, 'en-US');
    // en-US uses period as decimal separator
    expect(result).toContain('.');
  });
});

describe('eurosToCents', () => {
  it('converts 0 euros to 0 cents', () => {
    expect(eurosToCents(0)).toBe(0);
  });

  it('converts 25.50 euros to 2550 cents', () => {
    expect(eurosToCents(25.50)).toBe(2550);
  });

  it('converts 1 euro to 100 cents', () => {
    expect(eurosToCents(1)).toBe(100);
  });

  it('handles floating point edge case with 19.99', () => {
    // 19.99 * 100 in raw floating point could produce 1998.9999...
    // Math.round should handle this correctly
    expect(eurosToCents(19.99)).toBe(1999);
  });

  it('handles floating point edge case with 0.1 + 0.2', () => {
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
  });

  it('rounds correctly for sub-cent amounts', () => {
    expect(eurosToCents(1.555)).toBe(156);
    expect(eurosToCents(1.554)).toBe(155);
  });
});

describe('centsToEuros', () => {
  it('converts 0 cents to 0 euros', () => {
    expect(centsToEuros(0)).toBe(0);
  });

  it('converts 2550 cents to 25.50 euros', () => {
    expect(centsToEuros(2550)).toBe(25.50);
  });

  it('converts 1 cent to 0.01 euros', () => {
    expect(centsToEuros(1)).toBe(0.01);
  });

  it('converts 100 cents to 1 euro', () => {
    expect(centsToEuros(100)).toBe(1);
  });

  it('is the inverse of eurosToCents for whole cent amounts', () => {
    expect(centsToEuros(eurosToCents(25.50))).toBe(25.50);
    expect(eurosToCents(centsToEuros(2550))).toBe(2550);
  });
});

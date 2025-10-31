import { describe, it, expect } from 'vitest';
import { normalizeBytes32 } from '@/lib/fhe';

describe('normalizeBytes32', () => {
  it('pads shorter byte arrays to 32 bytes', () => {
    const input = Uint8Array.from([1, 2, 3, 4]);
    const normalized = normalizeBytes32(input);
    expect(normalized).toMatch(/^0x[0-9a-f]{64}$/i);
    expect(normalized).toBe('0x01020304' + '00'.repeat(28));
  });

  it('truncates longer byte arrays', () => {
    const input = Uint8Array.from({ length: 40 }, (_, i) => i + 1);
    const normalized = normalizeBytes32(input);
    const expected = '0x' + Array.from(input.slice(0, 32), (b) => b.toString(16).padStart(2, '0')).join('');
    expect(normalized).toBe(expected);
  });
});

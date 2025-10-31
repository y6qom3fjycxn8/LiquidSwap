import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const DOC_PATH = resolve(__dirname, '../docs/README.md');

describe('Documentation README', () => {
  const content = readFileSync(DOC_PATH, 'utf-8');

  it('mentions the deployed contracts section', () => {
    expect(content).toContain('Deployed Addresses');
  });

  it('contains a link to the demo video', () => {
    expect(content).toContain('youtube.com');
  });

  it('describes the security features', () => {
    expect(content).toMatch(/Security & Privacy Features/i);
  });
});

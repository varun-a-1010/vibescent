import { describe, expect, it } from 'vitest';
import { retryOnce } from '../server/retry';

describe('retryOnce', () => {
  it('retries a 504 once', async () => {
    let n = 0;
    expect(
      await retryOnce(async () => {
        if (++n === 1) throw Object.assign(new Error('x'), { status: 504 });
        return 'ok';
      }),
    ).toBe('ok');
  });
  it('does not retry a 400', async () => {
    let n = 0;
    await expect(
      retryOnce(async () => {
        n++;
        throw Object.assign(new Error('x'), { status: 400 });
      }),
    ).rejects.toThrow();
    expect(n).toBe(1);
  });
});

import { describe, expect, it, vi } from 'vitest';
import type { GenerateContentResponse } from '@google/genai';
import { withBackup } from '../server/models';

describe('backup project', () => {
  const answer = {} as GenerateContentResponse;
  const failure = Object.assign(new Error('quota'), { status: 429 });

  it('sends the same request to the backup when the primary fails', async () => {
    const primary = vi.fn(async () => {
      throw failure;
    });
    const backup = vi.fn(async () => answer);
    const request = { model: 'gemini-4-argon', contents: 'hello' };
    await expect(withBackup(primary, backup)(request)).resolves.toBe(answer);
    expect(backup).toHaveBeenCalledWith(request);
  });

  it('never calls the backup when the primary answers', async () => {
    const backup = vi.fn(async () => answer);
    await withBackup(async () => answer, backup)({ model: 'm', contents: 'hello' });
    expect(backup).not.toHaveBeenCalled();
  });

  it('leaves a call that timed out to the next model', async () => {
    const backup = vi.fn(async () => answer);
    const fail = async () => {
      throw failure;
    };
    const config = { abortSignal: AbortSignal.abort() };
    await expect(withBackup(fail, backup)({ model: 'm', contents: 'hello', config })).rejects.toBe(
      failure,
    );
    expect(backup).not.toHaveBeenCalled();
  });
});

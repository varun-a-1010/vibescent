/** One retry for transient provider failures (Vertex occasionally returns 504 or 429). */
export async function retryOnce<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    const status = (error as { status?: unknown })?.status;
    if (typeof status === 'number' && status !== 429 && status < 500) throw error;
    return fn();
  }
}

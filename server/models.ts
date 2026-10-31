import {
  GoogleGenAI,
  ThinkingLevel,
  type GenerateContentParameters,
  type GenerateContentResponse,
} from '@google/genai';

export type Generate = (request: GenerateContentParameters) => Promise<GenerateContentResponse>;
export type VertexAccount = { project?: string; serviceAccount?: string };
export type VertexOptions = VertexAccount & { location?: string; backup?: VertexAccount };

/** The scent judgment leads with Argon. The Flash models catch its failures and rate limits. */
export const MODEL_CHAIN = [
  'gemini-4-argon',
  'gemini-3.5-flash-lite',
  'gemini-3-flash-preview',
  'gemini-3.8-flash',
  'gemini-2.5-flash',
] as const;

/** For quick first steps. Argon stays on the scent brief, where its judgment matters most. */
export const ROUTINE_CHAIN = MODEL_CHAIN.slice(1);

const TIMEOUT_MS: Record<string, number> = { 'gemini-4-argon': 50_000 };
const DEFAULT_TIMEOUT_MS = 40_000;

export const thinkingFor = (model: string) =>
  model === 'gemini-2.5-flash' ? {} : { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } };

export type FallbackOptions = {
  passes?: number;
  deadlineMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

/**
 * Walk the chain until a model answers. A rate limit on one model must never end a request, so a
 * pass where every model fails backs off and walks the chain again, within a deadline.
 */
export async function withFallback<T>(
  chain: readonly string[],
  attempt: (model: string, timeoutMs: number) => Promise<T>,
  options: FallbackOptions = {},
): Promise<{ value: T; model: string }> {
  const passes = options.passes ?? 3;
  const started = Date.now();
  const deadline = options.deadlineMs ?? 110_000;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  let lastError: unknown = new Error('No model available.');
  for (let pass = 0; pass < passes; pass++) {
    for (const model of chain) {
      const remaining = deadline - (Date.now() - started);
      if (remaining <= 0) throw lastError;
      try {
        const timeout = Math.min(TIMEOUT_MS[model] ?? DEFAULT_TIMEOUT_MS, remaining);
        return { value: await attempt(model, timeout), model };
      } catch (error) {
        lastError = error;
      }
    }
    if (pass < passes - 1) await sleep(1_500 * 2 ** pass + Math.random() * 400);
  }
  throw lastError;
}

/** Send one request down the chain, keeping its prompt and output contract. */
export function chainGenerate(
  client: {
    models: { generateContent(r: GenerateContentParameters): Promise<GenerateContentResponse> };
  },
  chain: readonly string[] = MODEL_CHAIN,
) {
  return async (request: GenerateContentParameters) => {
    const { thinkingConfig: _thinking, ...config } = request.config ?? {};
    const { value } = await withFallback(chain, (model, timeoutMs) =>
      client.models.generateContent({
        ...request,
        model,
        config: { ...config, ...thinkingFor(model), abortSignal: AbortSignal.timeout(timeoutMs) },
      }),
    );
    return value;
  };
}

const statusOf = (error: unknown) => (error as { status?: number }).status ?? 'unknown';

/**
 * Each project has its own quota, so a failed call tries the same model on the backup before the
 * model chain moves on. A call that already timed out has no time left to try again.
 */
export const withBackup =
  (primary: Generate, backup: Generate): Generate =>
  async (request) => {
    try {
      return await primary(request);
    } catch (error) {
      if (request.config?.abortSignal?.aborted) throw error;
      console.warn('Primary Vertex project failed, trying the backup.', statusOf(error));
      return backup(request);
    }
  };

function connect(project: string, serviceAccount: string, location?: string): Generate {
  const raw = serviceAccount.trim();
  const credentials = JSON.parse(
    raw.startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8'),
  );
  const client = new GoogleGenAI({
    vertexai: true,
    project,
    location: location || 'global',
    googleAuthOptions: { credentials },
    httpOptions: { apiVersion: 'v1', timeout: 60_000, retryOptions: { attempts: 1 } },
  });
  return (request) => client.models.generateContent(request);
}

export function createVertexClient(options: VertexOptions) {
  if (!options.project || !options.serviceAccount) return undefined;
  let generateContent = connect(options.project, options.serviceAccount, options.location);
  const { backup } = options;
  if (backup?.project && backup.serviceAccount) {
    try {
      const second = connect(backup.project, backup.serviceAccount, options.location);
      generateContent = withBackup(generateContent, second);
    } catch {
      console.warn('The backup Vertex credential could not be read, so it is not in use.');
    }
  }
  return { models: { generateContent } };
}

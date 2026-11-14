import test from 'node:test';
import assert from 'node:assert/strict';
import { OpenAIResponsesProvider, ProviderError, DEFAULT_OPENAI_MODEL, type StructuredTaskRequest } from '../src/infrastructure/openai/OpenAIResponsesProvider.ts';

const request: StructuredTaskRequest = {
  task: 'analyze-photo',
  input: { context: { step: 1 }, availableSchemas: [] },
  schema: { type: 'object', properties: { status: { type: 'string' } }, required: ['status'], additionalProperties: false },
  image: { mimeType: 'image/png', base64: 'aW1hZ2U=' }
};
function response(output: unknown, status = 'completed'): Response {
  return Response.json({ status, output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(output) }] }] });
}
function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>): typeof globalThis.fetch {
  return handler as typeof globalThis.fetch;
}
function isError(code: string, status: number, retryable: boolean): (error: unknown) => boolean {
  return (error: unknown) => {
    assert.ok(error instanceof ProviderError);
    assert.equal(error.code, code);
    assert.equal(error.status, status);
    assert.equal(error.retryable, retryable);
    return true;
  };
}

test('Responses request uses image input, strict schema and store:false; only completed JSON is returned', async () => {
  const provider = new OpenAIResponsesProvider({
    apiKey: 'test-key',
    model: DEFAULT_OPENAI_MODEL,
    fetch: mockFetch(async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/responses');
      assert.equal(init?.method, 'POST');
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer test-key');
      const body = JSON.parse(String(init?.body));
      assert.equal(body.model, DEFAULT_OPENAI_MODEL);
      assert.equal(body.store, false);
      assert.deepEqual(body.text.format, { type: 'json_schema', name: 'physim_analyze_photo', schema: request.schema, strict: true });
      assert.deepEqual(body.input[0].content[1], { type: 'input_image', image_url: 'data:image/png;base64,aW1hZ2U=', detail: 'high' });
      assert.match(body.instructions, /không tin cậy/);
      assert.match(body.instructions, /không cung cấp đáp số/);
      assert.ok(init?.signal instanceof AbortSignal);
      return response({ status: 'unreadable' });
    })
  });
  assert.deepEqual(await provider.complete(request), { status: 'unreadable' });
});

test('model override is honored and text-only coaching does not include an image', async () => {
  const provider = new OpenAIResponsesProvider({ apiKey: 'key', model: 'test-model', fetch: mockFetch(async (_url, init) => {
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, 'test-model');
    assert.equal(body.input[0].content.length, 1);
    assert.equal(body.text.format.name, 'physim_evaluate_teach_back');
    return response({ status: 'evaluated' });
  }) });
  await provider.complete({ task: 'evaluate-teach-back', schema: request.schema, input: { explanation: 'Vì điện trở không đổi nên I tăng theo U.' } });
});

test('missing key fails before any network request and remains usable with sample lessons', async () => {
  const provider = new OpenAIResponsesProvider({ apiKey: '', fetch: mockFetch(async () => { assert.fail('must not fetch'); }) });
  await assert.rejects(provider.complete(request), isError('AI_NOT_CONFIGURED', 503, false));
});

test('HTTP errors map to safe actionable errors without exposing provider response text', async () => {
  for (const [status, code, translated, retryable] of [
    [400, 'AI_INVALID_RESPONSE', 502, true], [401, 'AI_NOT_CONFIGURED', 503, false],
    [403, 'AI_NOT_CONFIGURED', 503, false], [404, 'AI_NOT_CONFIGURED', 503, false],
    [429, 'AI_RATE_LIMITED', 429, true], [408, 'AI_TIMEOUT', 504, true],
    [504, 'AI_TIMEOUT', 504, true], [500, 'AI_UNAVAILABLE', 503, true]
  ] as const) {
    const provider = new OpenAIResponsesProvider({ apiKey: 'secret-key', fetch: mockFetch(async () => new Response('private answer and secret-key', { status })) });
    await assert.rejects(provider.complete(request), error => {
      isError(code, translated, retryable)(error);
      assert.doesNotMatch(String(error), /private answer|secret-key/);
      return true;
    });
  }
});

test('timeout aborts an in-flight provider request', async () => {
  let signal: AbortSignal | null | undefined;
  const provider = new OpenAIResponsesProvider({ apiKey: 'key', timeoutMs: 15, fetch: mockFetch(async (_url, init) => {
    signal = init?.signal;
    return new Promise<Response>((_resolve, reject) => signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true }));
  }) });
  await assert.rejects(provider.complete(request), isError('AI_TIMEOUT', 504, true));
  assert.equal(signal?.aborted, true);
});

test('timeout also bounds a stalled response body', async () => {
  const provider = new OpenAIResponsesProvider({ apiKey: 'key', timeoutMs: 15, fetch: mockFetch(async () => ({
    ok: true, json: () => new Promise(() => undefined)
  } as unknown as Response)) });
  await assert.rejects(provider.complete(request), isError('AI_TIMEOUT', 504, true));
});

test('refusal is surfaced as a safe refusal, not parsed or exposed verbatim', async () => {
  const provider = new OpenAIResponsesProvider({ apiKey: 'key', fetch: mockFetch(async () => Response.json({ status: 'completed', output: [
    { type: 'message', content: [{ type: 'refusal', refusal: 'private refusal reason' }] }
  ] })) });
  await assert.rejects(provider.complete(request), error => {
    isError('AI_REFUSED', 422, false)(error);
    assert.doesNotMatch(String(error), /private refusal/);
    return true;
  });
});

test('partial, empty, non-object and malformed provider outputs are rejected', async () => {
  const invalid = [
    () => response({ status: 'readable' }, 'incomplete'),
    () => response([]),
    () => response(null),
    () => Response.json({ status: 'completed', output: [] }),
    () => Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'private answer not JSON' }] }] }),
    () => new Response('not JSON', { status: 200 })
  ];
  for (const next of invalid) {
    const provider = new OpenAIResponsesProvider({ apiKey: 'key', fetch: mockFetch(async () => next()) });
    await assert.rejects(provider.complete(request), error => {
      isError('AI_INVALID_RESPONSE', 502, true)(error);
      assert.doesNotMatch(String(error), /private answer/);
      return true;
    });
  }
});

test('network errors never echo headers or provider URL internals', async () => {
  const provider = new OpenAIResponsesProvider({ apiKey: 'key', fetch: mockFetch(async () => { throw new Error('Authorization: Bearer sensitive'); }) });
  await assert.rejects(provider.complete(request), error => {
    isError('AI_UNAVAILABLE', 503, true)(error);
    assert.doesNotMatch(String(error), /sensitive|Authorization/);
    return true;
  });
});

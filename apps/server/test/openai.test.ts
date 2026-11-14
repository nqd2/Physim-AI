import assert from 'node:assert/strict';
import { test } from 'node:test';
import OpenAI from 'openai';
import { OpenAiClientAdapter } from '../src/shared/infrastructure/openai/OpenAiClientAdapter.ts';
import { OpenAiProblemVisionAnalyzer } from '../src/modules/problem-analysis/infrastructure/OpenAiProblemVisionAnalyzer.ts';

test('analyses photos through stateless structured output and surfaces unreadable images', async () => {
  let requestPayload: Record<string, unknown> | undefined;
  const client = new OpenAI({
    apiKey: 'test-key',
    fetch: async (_url, init) => {
      requestPayload = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return Response.json({
        status: 'completed',
        output: [{
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: '{"status":"unreadable","analysis":null}', annotations: [] }],
        }],
      });
    },
  });
  const analyzer = new OpenAiProblemVisionAnalyzer(new OpenAiClientAdapter(client, 'test-model'));
  await assert.rejects(
    analyzer.analyzePhoto({ mimeType: 'image/png', base64: 'AA==' }, []),
    { code: 'IMAGE_UNREADABLE' },
  );
  assert.equal(requestPayload?.store, false);
  assert.match(JSON.stringify(requestPayload?.text), /json_schema/u);
  assert.match(JSON.stringify(requestPayload?.input), /data:image\/png;base64,AA==/u);
  assert.equal(requestPayload?.tools, undefined);
});

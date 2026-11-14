import assert from 'node:assert/strict';
import { test } from 'node:test';
import { once } from 'node:events';
import express from 'express';
import { limitLearningRequests } from '../src/shared/infrastructure/http/limitLearningRequests.ts';
import { errorHandler } from '../src/shared/infrastructure/http/errorHandler.ts';

test('limits concurrent AI calls while freeing the slot after a response', async () => {
  let enter: () => void = () => {};
  let leave: () => void = () => {};
  const entered = new Promise<void>(resolve => { enter = resolve; });
  const completed = new Promise<void>(resolve => { leave = resolve; });
  const app = express();
  app.post('/learning', limitLearningRequests({ perMinute: 3, concurrent: 1 })(async (_request, response) => {
    enter();
    await completed;
    response.end();
  }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind TCP');
  const post = () => fetch(`http://127.0.0.1:${address.port}/learning`, { method: 'POST' });
  try {
    const first = post();
    await entered;
    const busy = await post();
    assert.equal(busy.status, 429);
    assert.equal((await busy.json() as { error: { code: string } }).error.code, 'AI_BUSY');
    leave();
    assert.equal((await first).status, 200);
    assert.equal((await post()).status, 200);
    assert.equal((await post()).status, 200);
    const limited = await post();
    assert.equal(limited.status, 429);
    assert.equal((await limited.json() as { error: { code: string } }).error.code, 'AI_REQUEST_LIMIT');
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  } finally {
    leave();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

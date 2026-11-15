/** Run after the shared Node scaffold exists: npx tsx --test web/src/features/community/community.test.ts */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createCommunityRouter } from '../../../../server/src/routes/community';

test('community demo contract and interactive journey', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api', createCommunityRouter({ pulseGenerate: false, demoClips: [{ id: 'existing-clip', user_id: 'demo-fan', game: 'cs2', title: 'Existing clutch', blob_url: 'https://example.com/clip.mp4' }] }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.on('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const root = `http://127.0.0.1:${address.port}/api`;
  async function request(path: string, body?: unknown, user = 'demo-fan') {
    const res = await fetch(root + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'Content-Type': 'application/json', 'x-user-id': user }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { status: res.status, ...(await res.json()) };
  }
  try {
    const boards = await request('/communities');
    assert.equal(boards.mode, 'demo'); assert.equal(boards.data.length, 5);
    const created = await request('/communities/clips/threads', { title: 'My clutch', body: 'Feedback welcome', clip_id: 'existing-clip' });
    assert.equal(created.status, 201); assert.equal(created.data.clip.id, 'existing-clip');
    const tid = created.data.id;
    assert.equal((await request('/votes', { target_type: 'thread', target_id: tid, value: 1 })).data.score, 1);
    assert.equal((await request('/votes', { target_type: 'thread', target_id: tid, value: 1 })).data.score, 1);
    assert.equal((await request('/votes', { target_type: 'thread', target_id: tid, value: -1 })).data.score, -1);
    assert.equal((await request('/votes', { target_type: 'thread', target_id: tid, value: 0 })).data.score, 0);
    await Promise.all(Array.from({ length: 10 }, () => request('/votes', { target_type: 'thread', target_id: tid, value: 1 })));
    const feed = await request('/communities/clips/threads?sort=top');
    assert.equal(feed.data.find((t: { id: string }) => t.id === tid).score, 1);
    const comment = await request(`/threads/${tid}/comments`, { body: 'Nice crosshair placement' });
    assert.equal(comment.status, 201);
    const reply = await request(`/threads/${tid}/comments`, { body: 'Thanks!', parent_id: comment.data.id });
    assert.equal(reply.status, 201); assert.equal(reply.data.parent_id, comment.data.id);
    const other = await request('/communities/clips/threads', { title: 'Other', body: 'Another thread' });
    assert.equal((await request(`/threads/${other.data.id}/comments`, { body: 'Wrong parent', parent_id: comment.data.id })).status, 400);
    assert.equal((await request('/communities/clips/threads', { title: 'Invalid clip', body: 'Test', clip_id: 'missing' })).status, 404);
    assert.equal((await request('/communities/clips/threads', { title: 'Wrong owner', body: 'Test', clip_id: 'existing-clip' }, 'demo-prospect')).status, 403);
    assert.equal((await request('/communities/clips/threads', { title: '', body: 'Test' })).status, 400);
    assert.equal((await request('/communities/clips/threads', { title: 'Filter', body: 'swatting' })).status, 400);
    assert.equal((await request('/votes', { target_type: 'thread', target_id: tid, value: 2 })).status, 400);
    assert.equal((await request('/votes', { target_type: 'thread', target_id: tid, value: 1 }, 'unknown')).status, 401);
    assert.equal((await request('/communities/clips/threads?sort=invalid')).status, 400);
    const challenge = feed.data.find((t: { type: string }) => t.type === 'challenge');
    assert.ok(challenge);
    assert.equal((await request(`/threads/${challenge.id}/comments`, { body: 'No clip' })).status, 400);
    assert.equal((await request(`/threads/${challenge.id}/comments`, { body: 'One tap', clip_id: 'existing-clip' })).status, 201);
    assert.equal((await request(`/threads/${challenge.id}/comments`, { body: 'Duplicate', clip_id: 'existing-clip' })).status, 409);
    const report = { target_type: 'thread', target_id: tid, reason: 'Spam' };
    assert.equal((await request('/community/reports', report)).status, 201);
    assert.equal((await request('/community/reports', report)).status, 409);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});

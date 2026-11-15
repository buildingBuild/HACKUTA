import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortThreads, threadTopic } from './discussions';
import type { Thread, Community } from './types';
const boards: Community[] = [{ id:'legacy',slug:'faze-cs2',name:'FaZe CS2',description:'' }, { id:'clips',slug:'clips',name:'Clips',description:'' }];
const thread = (id: string, score: number, created_at: string, body = 'Existing discussion', community_id = 'legacy') => ({ id, score, created_at, body, community_id } as Thread);
test('legacy boards and explicit hashtags map to topics without modifying records', () => {
  assert.equal(threadTopic(thread('1',0,'',undefined,'legacy'), boards),'CS2');
  assert.equal(threadTopic(thread('2',0,'',undefined,'clips'), boards),'Trickshots');
  assert.equal(threadTopic(thread('3',0,'','#General\n\nA fan discussion'), boards),'General');
  assert.equal(threadTopic(thread('4',0,'','#Talent Watch\n\nA prospect'), boards),'Talent Watch');
});
test('unified sorting ranks across original boards and leaves inputs unchanged', () => {
  const old = thread('old',20,'2026-11-01T00:00:00Z');
  const recent = thread('recent',5,'2026-11-14T00:00:00Z',undefined,'clips');
  const rows = [old,recent];
  assert.deepEqual(sortThreads(rows,'top').map(t=>t.id),['old','recent']);
  assert.deepEqual(sortThreads(rows,'new').map(t=>t.id),['recent','old']);
  assert.deepEqual(sortThreads(rows,'hot',Date.parse('2026-11-14T01:00:00Z')).map(t=>t.id),['recent','old']);
  assert.deepEqual(rows,[old,recent]);
});
test('existing challenges use the Challenges topic regardless of legacy board or body tag', () => {
  const challenge = { ...thread('challenge', 3, '2026-11-14T00:00:00Z', '#Trickshots\n\nRules', 'clips'), type: 'challenge' as const };
  assert.equal(threadTopic(challenge, boards), 'Challenges');
  assert.equal(threadTopic({ ...challenge, community_id: 'legacy' }, boards), 'Challenges');
  assert.equal(threadTopic({ ...challenge, type: 'post' }, boards), 'Trickshots');
});

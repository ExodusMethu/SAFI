import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPlaylist, queuedImport } from '../lib/music-import-queue.mjs';

const url = 'https://music.youtube.com/playlist?list=PL1234567890';

test('accepts only YouTube playlist links and strips extra parameters', () => {
  assert.equal(canonicalPlaylist(url + '&redirect=https://localhost'), url);
  for (const value of [null, {}, 'https://youtube.com.evil.test/?list=PL1234567890',
    'http://youtube.com/?list=PL1234567890', 'https://user:pass@youtube.com/?list=PL1234567890',
    'https://youtube.com:9999/?list=PL1234567890', 'https://youtube.com/watch?v=abcdefghijk']) {
    assert.throws(() => canonicalPlaylist(value));
  }
});

test('enqueues for the verified user, ignoring any supplied user ID', async () => {
  const db = { rpc: async (name, params) => {
    assert.equal(name, 'enqueue_music_import');
    assert.deepEqual(params, { p_user_id: 'signed-in-user', p_url: url });
    return { data: { status: 'queued' } };
  } };
  const result = await queuedImport(db, 'signed-in-user', 'POST', null, { url, user_id: 'someone-else' });
  assert.equal(result.status, 202);
});

test('rejects invalid URLs before touching the database and maps queue limits', async () => {
  assert.equal((await queuedImport({}, 'user', 'POST', null, {})).status, 400);
  for (const [message, expected] of [['IMPORT_ALREADY_ACTIVE', 409], ['IMPORT_QUEUE_FULL', 429]]) {
    const db = { rpc: async () => ({ error: { message } }) };
    assert.equal((await queuedImport(db, 'user', 'POST', null, { url })).status, expected);
  }
});

test('progress lookup always filters by owner and returns 404 for another user job', async () => {
  const filters = [];
  const query = {
    select() { return this; },
    eq(key, value) { filters.push([key, value]); return this; },
    order() { return this; }, limit() { return this; },
    async maybeSingle() { return { data: null }; },
  };
  const db = { rpc: async () => ({}), from: () => query };
  assert.equal((await queuedImport(db, 'owner', 'GET', 'other-job')).status, 404);
  assert.deepEqual(filters, [['user_id', 'owner'], ['id', 'other-job']]);
});

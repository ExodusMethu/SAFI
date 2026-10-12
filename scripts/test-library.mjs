import { test } from 'node:test';
import assert from 'node:assert/strict';
import { playlistTracks, selectTracks, groupAlbums, formatTime } from '../lib/library.mjs';
const tracks = [
  { id: 'old', title: 'Amber', artist: 'Zed', album: 'One', created_at: '2025-01-01', duration: 185 },
  { id: 'new', title: 'Blue', artist: 'Ada', album: 'One', created_at: '2026-01-01' },
];
test('playlist newest-first order is immutable and uses updated metadata', () => {
  const entries = [{ position: 0, track_id: 'old', tracks: { ...tracks[0], title: 'Stale' } }, { position: 1, track_id: 'new', tracks: tracks[1] }];
  assert.deepEqual(playlistTracks({ playlist_tracks: entries }, tracks).map(t => t.id), ['new', 'old']);
  assert.deepEqual(playlistTracks({ playlist_tracks: entries }, tracks, 'oldest').map(t => t.id), ['old', 'new']);
  assert.equal(playlistTracks({ playlist_tracks: entries }, tracks)[1].title, 'Amber');
  assert.equal(entries[0].position, 0);
});
test('search reaches songs beyond the old 50-song home cutoff', () => {
  const large = Array.from({ length: 80 }, (_, i) => ({ ...tracks[0], id: String(i), title: `Song ${i}` }));
  assert.equal(selectTracks(large, { search: ' SONG 79 ' })[0].id, '79');
  assert.equal(selectTracks(tracks, { search: 'ada' })[0].id, 'new');
});
test('download filters and sorting do not mutate the library', () => {
  assert.deepEqual(selectTracks(tracks).map(t => t.id), ['new', 'old']);
  assert.deepEqual(selectTracks(tracks, { order: 'title' }).map(t => t.id), ['old', 'new']);
  assert.deepEqual(selectTracks(tracks, { downloadsOnly: true, downloadedIds: new Set(['old']) }).map(t => t.id), ['old']);
  assert.equal(tracks[0].id, 'old');
});
test('albums with the same name by different artists stay separate', () => {
  assert.equal(groupAlbums(tracks).length, 2);
});
test('durations display stored song length and handle missing metadata', () => {
  assert.equal(formatTime(185), '3:05');
  assert.equal(formatTime(null), '—');
  assert.equal(formatTime(NaN), '—');
});

export function canonicalPlaylist(value) {
  try {
    const url = new URL(value);
    const list = url.searchParams.get('list');
    if (typeof value !== 'string' || value.length > 2048 || url.protocol !== 'https:' ||
        !['youtube.com', 'www.youtube.com', 'music.youtube.com'].includes(url.hostname) ||
        url.username || url.password || url.port || !/^[A-Za-z0-9_-]{10,150}$/.test(list || '')) throw new Error();
    return `https://music.youtube.com/playlist?list=${list}`;
  } catch {
    throw new Error('Use a public or unlisted YouTube Music playlist link.');
  }
}

export async function queuedImport(db, userId, method, id, body) {
  if (method === 'POST') {
    let url;
    try { url = canonicalPlaylist(body?.url); } catch (error) {
      return { status: 400, data: { error: error.message } };
    }
    const { data, error } = await db.rpc('enqueue_music_import', { p_user_id: userId, p_url: url });
    if (error?.message === 'IMPORT_ALREADY_ACTIVE') return { status: 409, data: { error: 'You already have an import waiting or running.' } };
    if (error?.message === 'IMPORT_QUEUE_FULL') return { status: 429, data: { error: 'The import queue is full. Try again later.' } };
    if (error) throw error;
    return { status: 202, data };
  }
  const { error: recoveryError } = await db.rpc('expire_music_imports');
  if (recoveryError) throw recoveryError;
  let query = db.from('music_import_jobs').select('state').eq('user_id', userId);
  if (id) query = query.eq('id', id);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  if (id && !data) return { status: 404, data: { error: 'Import not found.' } };
  return { status: 200, data: data?.state ?? null };
}

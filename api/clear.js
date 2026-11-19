// POST /api/clear  { id? }  → delete one item, or everything in this room
const { BLOB_ENABLED, blobAuth, isBlobUrl, MAX_ITEMS, TTL, redis, getRoom, keys, send, body } = require('./_lib');

async function deleteBlobs(urls) {
  urls = urls.filter(isBlobUrl);
  if (!urls.length || !BLOB_ENABLED) return;
  try {
    const { del } = await import('@vercel/blob');
    // Never let a slow delete block the page; files also auto-delete after 1 day.
    await Promise.race([del(urls, blobAuth()), new Promise(r => setTimeout(r, 5000))]);
  } catch {}
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const room = getRoom(req);
    const k = keys(room.id);
    const id = String(body(req).id || '');
    const [list] = await redis([['LRANGE', k.list, 0, MAX_ITEMS - 1]]);
    const parsed = (list || []).map(raw => { try { return { raw, item: JSON.parse(raw) }; } catch { return null; } }).filter(Boolean);

    if (id) {
      const hit = parsed.find(p => p.item.id === id);
      if (hit) {
        await redis([['LREM', k.list, 1, hit.raw], ['DEL', k.file(id)], ['INCR', k.ver], ['EXPIRE', k.ver, TTL]]);
        await deleteBlobs([hit.item.url || '']);
      }
    } else {
      await redis([['DEL', k.list], ...parsed.map(p => ['DEL', k.file(p.item.id)]), ['INCR', k.ver], ['EXPIRE', k.ver, TTL]]);
      await deleteBlobs(parsed.map(p => p.item.url || ''));
    }
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, 500, { error: e.message || 'Server error' });
  }
};

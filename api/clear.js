// POST /api/clear  { id? }  → delete one item, or everything in this room
const { MAX_ITEMS, TTL, redis, getRoom, keys, send, body } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const room = getRoom(req);
    const k = keys(room.id);
    const id = String(body(req).id || '');

    if (id) {
      const [list] = await redis([['LRANGE', k.list, 0, MAX_ITEMS - 1]]);
      const raw = (list || []).find(s => { try { return JSON.parse(s).id === id; } catch { return false; } });
      if (raw) await redis([['LREM', k.list, 1, raw], ['DEL', k.file(id)], ['INCR', k.ver], ['EXPIRE', k.ver, TTL]]);
    } else {
      await redis([['DEL', k.list], ['INCR', k.ver], ['EXPIRE', k.ver, TTL]]);
    }
    send(res, 200, { ok: true });
  } catch (e) {
    send(res, 500, { error: e.message || 'Server error' });
  }
};

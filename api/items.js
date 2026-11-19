// GET /api/items?since=<ver>  → list of items in this WiFi room
const { TTL, MAX_ITEMS, STORAGE, redis, getRoom, keys, send } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const room = getRoom(req);
    const k = keys(room.id);
    const since = String((req.query && req.query.since) || '');
    const [ver] = await redis([['GET', k.ver]]);
    const v = ver ? String(ver) : '0';
    const base = { ver: v, room: room.label, isCode: room.isCode, storage: STORAGE };

    // Nothing new → cheap answer (1 storage command per poll).
    if (since && since === v) return send(res, 200, { ...base, changed: false });

    const [list] = await redis([['LRANGE', k.list, 0, MAX_ITEMS - 1]]);
    const now = Date.now();
    const items = (list || [])
      .map(s => { try { return JSON.parse(s); } catch { return null; } })
      .filter(x => x && now - x.ts < TTL * 1000);
    send(res, 200, { ...base, changed: true, items });
  } catch (e) {
    send(res, 500, { error: e.message || 'Server error' });
  }
};

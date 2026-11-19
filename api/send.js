// POST /api/send  { type:'text', text }  or  { type:'file', name, mime, data(base64) }
const crypto = require('crypto');
const { TTL, MAX_ITEMS, MAX_FILE_BYTES, MAX_TEXT, redis, getRoom, keys, send, body } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = body(req);
    const room = getRoom(req);
    const k = keys(room.id);
    const id = crypto.randomBytes(8).toString('hex');
    const meta = {
      id,
      ts: Date.now(),
      from: String(b.from || 'Device').slice(0, 40),
      did: String(b.did || '').slice(0, 40),
    };
    const cmds = [];

    if (b.type === 'text') {
      const text = String(b.text || '');
      if (!text.trim()) return send(res, 400, { error: 'Text is empty' });
      if (text.length > MAX_TEXT) return send(res, 400, { error: 'Text is too long (max 20,000 characters)' });
      Object.assign(meta, { type: 'text', text });
    } else if (b.type === 'file') {
      const data = String(b.data || '').replace(/^data:[^,]*,/, '');
      if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) return send(res, 400, { error: 'Invalid file' });
      const size = Math.floor(data.length * 3 / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0);
      if (size > MAX_FILE_BYTES) return send(res, 413, { error: 'File is too large (max 3 MB)' });
      const name = String(b.name || 'file').replace(/[\\/\r\n"]/g, '_').slice(0, 120);
      const mime = /^[\w.+-]+\/[\w.+-]+$/.test(b.mime || '') ? b.mime : 'application/octet-stream';
      Object.assign(meta, { type: mime.startsWith('image/') ? 'image' : 'file', name, mime, size });
      cmds.push(['SET', k.file(id), JSON.stringify({ name, mime, data }), 'EX', TTL]);
    } else {
      return send(res, 400, { error: 'Unknown type' });
    }

    cmds.push(
      ['LPUSH', k.list, JSON.stringify(meta)],
      ['LTRIM', k.list, 0, MAX_ITEMS - 1],
      ['EXPIRE', k.list, TTL],
      ['INCR', k.ver],
      ['EXPIRE', k.ver, TTL]
    );
    await redis(cmds);
    send(res, 200, { ok: true, item: meta });
  } catch (e) {
    send(res, 500, { error: e.message || 'Server error' });
  }
};

// GET /api/file?id=<id>[&dl=1]  → the image / file itself
const { redis, getRoom, keys, send } = require('./_lib');

module.exports = async (req, res) => {
  try {
    const id = String((req.query && req.query.id) || '');
    if (!/^[a-f0-9]{16}$/.test(id)) return send(res, 400, { error: 'Bad id' });
    const room = getRoom(req);
    const [raw] = await redis([['GET', keys(room.id).file(id)]]);
    if (!raw) return send(res, 404, { error: 'File expired or not found' });
    const f = JSON.parse(raw);
    const buf = Buffer.from(f.data, 'base64');
    const download = req.query && req.query.dl === '1';
    res.statusCode = 200;
    res.setHeader('Content-Type', f.mime);
    res.setHeader('Content-Length', buf.length);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition',
      `${download ? 'attachment' : 'inline'}; filename="file"; filename*=UTF-8''${encodeURIComponent(f.name)}`);
    res.end(buf);
  } catch (e) {
    send(res, 500, { error: e.message || 'Server error' });
  }
};

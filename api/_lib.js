// Shared helpers for all API routes.
// Files starting with "_" inside /api are NOT turned into endpoints by Vercel.
const crypto = require('crypto');

const TTL = 24 * 60 * 60;          // items auto-delete after 24 hours
const MAX_ITEMS = 50;              // newest 50 items kept per room
const MAX_FILE_BYTES = 3 * 1024 * 1024; // 3 MB per file (Vercel body limit is 4.5 MB)
const MAX_TEXT = 20000;

// Finds the Upstash keys whatever prefix Vercel gave them (KV_, STORAGE_, etc.)
function findEnv(suffixes) {
  for (const s of suffixes) if (process.env[s]) return process.env[s];
  const name = Object.keys(process.env).find(k => suffixes.some(s => k.endsWith('_' + s)) && !k.includes('READ_ONLY'));
  return name ? process.env[name] : '';
}
const REDIS_URL = findEnv(['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', 'REST_API_URL']);
const REDIS_TOKEN = findEnv(['KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN', 'REST_API_TOKEN']);
const STORAGE = REDIS_URL && REDIS_TOKEN ? 'redis' : 'memory';

// Vercel Blob (for big files). Also works if Vercel added a prefix to the name.
const BLOB_TOKEN = findEnv(['BLOB_READ_WRITE_TOKEN']);
const MAX_BIG_FILE = 200 * 1024 * 1024; // 200 MB per file via Vercel Blob
const isBlobUrl = u => { try { const x = new URL(u); return x.protocol === 'https:' && x.hostname.endsWith('.blob.vercel-storage.com'); } catch { return false; } };

// ---------- tiny in-memory fallback (for local testing only) ----------
const mem = globalThis.__dropMem || (globalThis.__dropMem = new Map());
function memGet(k) {
  const e = mem.get(k);
  if (!e) return null;
  if (e.exp && e.exp < Date.now()) { mem.delete(k); return null; }
  return e;
}
function memCmd(cmd) {
  const [c, k, ...a] = cmd.map(String);
  const e = memGet(k);
  switch (c.toUpperCase()) {
    case 'GET': return e ? e.v : null;
    case 'SET': mem.set(k, { v: a[0], exp: a[1] === 'EX' ? Date.now() + Number(a[2]) * 1000 : 0 }); return 'OK';
    case 'DEL': return mem.delete(k) ? 1 : 0;
    case 'INCR': { const n = (e ? Number(e.v) : 0) + 1; mem.set(k, { v: String(n), exp: e ? e.exp : 0 }); return n; }
    case 'EXPIRE': if (e) e.exp = Date.now() + Number(a[0]) * 1000; return e ? 1 : 0;
    case 'LPUSH': { const l = e ? e.v : []; l.unshift(...a.reverse()); mem.set(k, { v: l, exp: e ? e.exp : 0 }); return l.length; }
    case 'LTRIM': if (e) e.v = e.v.slice(Number(a[0]), Number(a[1]) + 1); return 'OK';
    case 'LRANGE': return e ? e.v.slice(Number(a[0]), Number(a[1]) === -1 ? undefined : Number(a[1]) + 1) : [];
    case 'LREM': { if (!e) return 0; const before = e.v.length; const i = e.v.indexOf(a[1]); if (i >= 0) e.v.splice(i, 1); return before - e.v.length; }
    default: throw new Error('Unsupported command ' + c);
  }
}

// Runs several Redis commands in one HTTP call (Upstash REST pipeline).
async function redis(cmds) {
  if (STORAGE === 'memory') return cmds.map(memCmd);
  const r = await fetch(REDIS_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + REDIS_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds.map(c => c.map(String))),
  });
  if (!r.ok) throw new Error('Storage error (' + r.status + ')');
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

// ---------- "same WiFi" detection ----------
function expandIPv6(ip) {
  const [head, tail] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = tail !== undefined && tail !== '' ? tail.split(':') : [];
  const parts = tail === undefined ? h : [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t];
  return parts.map(p => p.padStart(4, '0').toLowerCase());
}

function networkKey(req) {
  const xf = req.headers['x-forwarded-for'];
  let ip = String((xf ? String(xf).split(',')[0] : req.headers['x-real-ip']) || (req.socket && req.socket.remoteAddress) || '').trim();
  ip = ip.replace(/%.*$/, '');
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  // Devices on one WiFi share a public IPv4. With IPv6 each device has its own
  // address, but they share the first 64 bits (the network prefix).
  if (ip.includes(':')) ip = expandIPv6(ip).slice(0, 4).join(':') + '::/64';
  return ip || 'unknown';
}

function cleanCode(v) {
  return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
}

// Room = hash of the WiFi's public IP, or of a private code if the user set one.
function getRoom(req) {
  const code = cleanCode(req.headers['x-room-code'] || (req.query && req.query.code));
  const source = code.length >= 4 ? 'code:' + code : 'net:' + networkKey(req);
  const salt = process.env.ROOM_SALT || 'airdrop-clone-salt';
  const id = crypto.createHash('sha256').update(salt + '|' + source).digest('hex').slice(0, 20);
  return { id, isCode: code.length >= 4, label: code.length >= 4 ? code : id.slice(0, 4).toUpperCase() };
}

function keys(room) {
  return { list: `r:${room}:l`, ver: `r:${room}:v`, file: id => `r:${room}:f:${id}` };
}

function send(res, status, data) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function body(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

module.exports = { BLOB_TOKEN, MAX_BIG_FILE, isBlobUrl, TTL, MAX_ITEMS, MAX_FILE_BYTES, MAX_TEXT, STORAGE, redis, getRoom, keys, send, body };

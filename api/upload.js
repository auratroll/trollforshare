// POST /api/upload  → gives the browser a one-time token to upload a big file
// straight to Vercel Blob (so the 4.5 MB Vercel limit doesn't apply).
// GET  /api/upload  → tells the page whether big-file uploads are enabled.
const { BLOB_TOKEN, MAX_BIG_FILE, send, body } = require('./_lib');

module.exports = async (req, res) => {
  if (req.method === 'GET') return send(res, 200, { enabled: !!BLOB_TOKEN, max: MAX_BIG_FILE });
  if (!BLOB_TOKEN) return send(res, 501, { error: 'Big files are not enabled. Connect Vercel Blob in Storage.' });
  try {
    const { handleUpload } = await import('@vercel/blob/client');
    const result = await handleUpload({
      token: BLOB_TOKEN,
      request: req,
      body: body(req),
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('tfs/')) throw new Error('Bad path');
        return {
          maximumSizeInBytes: MAX_BIG_FILE,
          addRandomSuffix: true,
          ttlDays: 1, // Vercel deletes the file automatically after 1 day
        };
      },
      onUploadCompleted: async () => {},
    });
    send(res, 200, result);
  } catch (e) {
    send(res, 400, { error: e.message || 'Upload error' });
  }
};

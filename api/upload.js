// POST /api/upload  → gives the browser a short-lived presigned URL to upload a
// big file straight to Vercel Blob (so the 4.5 MB Vercel limit doesn't apply).
// Works with both Vercel Blob setups: BLOB_STORE_ID (OIDC) or BLOB_READ_WRITE_TOKEN.
// GET  /api/upload  → tells the page whether big-file uploads are enabled.
const { BLOB_ENABLED, blobAuth, MAX_BIG_FILE, send, body } = require('./_lib');

const PATH_RE = /^tfs\/[a-z0-9]{8,32}\/[\w.\-]{1,100}$/;

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    // Shows only the NAMES of Blob settings (never their secret values) to help setup.
    const blobVars = Object.keys(process.env).filter(k => k.includes('BLOB'));
    return send(res, 200, { enabled: BLOB_ENABLED, max: MAX_BIG_FILE, blobVars });
  }
  if (!BLOB_ENABLED) return send(res, 501, { error: 'Big files are not enabled. Connect Vercel Blob in Storage.' });
  try {
    const { handleUploadPresigned } = await import('@vercel/blob/client');
    const { issueSignedToken } = await import('@vercel/blob');
    const result = await handleUploadPresigned({
      request: req,
      body: body(req),
      getSignedToken: async (pathname) => {
        if (!PATH_RE.test(pathname)) throw new Error('Bad file name');
        const token = await issueSignedToken({
          ...blobAuth(),
          pathname,                         // token only works for this one file
          operations: ['put'],
          maximumSizeInBytes: MAX_BIG_FILE,
          validUntil: Date.now() + 60 * 60 * 1000,
        });
        return {
          token,
          urlOptions: {
            maximumSizeInBytes: MAX_BIG_FILE,
            ttlDays: 1,                     // Vercel deletes the file automatically after 1 day
          },
        };
      },
    });
    send(res, 200, result);
  } catch (e) {
    send(res, 400, { error: e.message || 'Upload error' });
  }
};

import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync } from 'node:fs';
import { rename, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import os from 'node:os';

const root = path.dirname(fileURLToPath(import.meta.url));
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DAY_MS = 86400000;

function failure(status, message) {
  return Object.assign(new Error(message), { status });
}

function newState() {
  return { profile: { name: 'Alex' }, streak: 0, coins: 0, xp: 0, sessions: [], lastStudyDate: null };
}

function loadState(file) {
  try {
    const state = JSON.parse(readFileSync(file, 'utf8'));
    if (!state || !Array.isArray(state.sessions) || !state.profile || typeof state.profile.name !== 'string'
      || !['streak', 'coins', 'xp'].every(key => Number.isSafeInteger(state[key]) && state[key] >= 0)
      || !(state.lastStudyDate === null || /^\d{4}-\d{2}-\d{2}$/.test(state.lastStudyDate))) {
      throw new Error('Invalid state schema');
    }
    return state;
  } catch (error) {
    if (error.code === 'ENOENT') return newState();
    throw new Error(`Cannot read saved study data at ${file}. Restore this file before restarting.`, { cause: error });
  }
}

function dayDistance(date) {
  const today = new Date().toISOString().slice(0, 10);
  return date ? (Date.parse(today) - Date.parse(date)) / DAY_MS : Infinity;
}

function publicState(state) {
  const { lastStudyDate, ...visible } = state;
  return { ...visible, streak: dayDistance(lastStudyDate) > 1 ? 0 : state.streak };
}

function imageType(bytes) {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return 'png';
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpg';
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return null;
}

function validSession(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw failure(400, 'Invalid session.');
  const { topic, score, durationSeconds, mode, clientSessionId } = body;
  if (typeof topic !== 'string' || !topic.trim() || topic.trim().length > 120) throw failure(400, 'Topic must contain 1–120 characters.');
  if (!Number.isInteger(score) || score < 0 || score > 100) throw failure(400, 'Score must be an integer from 0 to 100.');
  if (!Number.isInteger(durationSeconds) || durationSeconds < 0 || durationSeconds > 86400) throw failure(400, 'Duration must be 0–86400 seconds.');
  if (typeof mode !== 'string' || !mode.trim() || mode.trim().length > 40) throw failure(400, 'A session mode is required (up to 40 characters).');
  if (clientSessionId !== undefined && (typeof clientSessionId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(clientSessionId))) {
    throw failure(400, 'Invalid client session identifier.');
  }
  return { topic: topic.trim(), score, durationSeconds, mode: mode.trim(), ...(clientSessionId ? { clientSessionId } : {}) };
}

// Single-user LAN MVP. All clients share one study profile. Add authentication
// and per-user storage before exposing this service to the public internet.
// Run one server process per data directory; the queue serializes its writes.
export function createApp({ dataDir = path.join(root, 'data'), webDir = path.join(root, 'web') } = {}) {
  const app = express();
  const resolvedDataDir = path.resolve(dataDir);
  const uploadDir = path.join(resolvedDataDir, 'uploads');
  mkdirSync(uploadDir, { recursive: true });
  const stateFile = path.join(resolvedDataDir, 'state.json');
  let state = loadState(stateFile);
  let writeQueue = Promise.resolve();
  const serialized = action => {
    const pending = writeQueue.then(action);
    writeQueue = pending.catch(() => {});
    return pending;
  };

  async function save(next) {
    const temporary = `${stateFile}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporary, JSON.stringify(next, null, 2), { flag: 'wx' });
      await rename(temporary, stateFile);
      state = next;
    } catch (error) {
      await unlink(temporary).catch(() => {});
      throw error;
    }
  }

  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'same-origin');
    next();
  });
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    // WebView loads the UI and API from the same host; cross-site writes are unnecessary.
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method) && req.get('origin')) {
      try {
        if (new URL(req.get('origin')).host !== req.get('host')) throw new Error('Foreign origin');
      } catch {
        return next(failure(403, 'Cross-origin writes are not allowed.'));
      }
    }
    next();
  });
  app.use(express.json({ limit: '16kb' }));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/state', async (_req, res) => {
    await writeQueue;
    res.json(publicState(state));
  });

  const upload = multer({
    storage: multer.memoryStorage(),
    defParamCharset: 'utf8',
    limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 0, parts: 1 },
    fileFilter: (_req, file, callback) => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
        return callback(failure(415, 'Choose a JPEG, PNG, or WebP image.'));
      }
      callback(null, true);
    }
  });

  app.post('/api/uploads', upload.single('image'), async (req, res) => {
    if (!req.file) throw failure(400, 'An image is required.');
    const extension = imageType(req.file.buffer);
    if (!extension) throw failure(415, 'The file is not a supported image.');
    const id = randomUUID();
    const filename = `${id}.${extension}`;
    await writeFile(path.join(uploadDir, filename), req.file.buffer, { flag: 'wx' });
    const name = req.file.originalname.replace(/^.*[\\/]/, '').replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 200) || filename;
    res.status(201).json({ id, url: `/uploads/${filename}`, name });
  });

  app.post('/api/sessions', async (req, res) => {
    const input = validSession(req.body);
    const result = await serialized(async () => {
      // A retry with the same clientSessionId does not award points twice.
      const existing = input.clientSessionId && state.sessions.find(item => item.clientSessionId === input.clientSessionId);
      if (existing) return { session: existing, state: publicState(state), duplicate: true };
      const today = new Date().toISOString().slice(0, 10);
      const distance = dayDistance(state.lastStudyDate);
      const rewards = { xp: 10 + Math.round(input.score / 5), coins: 5 };
      const session = { id: randomUUID(), ...input, createdAt: new Date().toISOString(), rewards };
      const next = {
        ...state,
        streak: distance === 0 ? state.streak : distance === 1 ? state.streak + 1 : 1,
        coins: state.coins + rewards.coins,
        xp: state.xp + rewards.xp,
        lastStudyDate: today,
        sessions: [session, ...state.sessions].slice(0, 100)
      };
      await save(next);
      return { session, state: publicState(next), duplicate: false };
    });
    res.status(result.duplicate ? 200 : 201).json(result);
  });

  app.use('/api', (_req, res) => res.status(404).json({ error: 'API route not found.' }));
  app.use('/uploads', (req, res, next) => {
    if (!/^\/[0-9a-f-]{36}\.(?:jpg|png|webp)$/.test(req.path)) return res.status(404).end();
    next();
  }, express.static(uploadDir, { dotfiles: 'deny', index: false, fallthrough: false, immutable: true, maxAge: '1y' }));
  app.use(express.static(path.resolve(webDir), { dotfiles: 'deny', index: 'index.html', etag: true, maxAge: 0 }));
  app.use((_req, res) => res.status(404).type('text/plain').send('Not found'));
  app.use((error, _req, res, _next) => {
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({ error: tooLarge ? 'Image must be 10 MB or smaller.' : 'Upload one image using the image field.' });
    }
    const status = error.status >= 400 && error.status < 500 ? error.status : 500;
    if (status === 500) console.error('Request failed:', error);
    res.status(status).json({ error: status === 500 ? 'Server could not save the request. Please try again.' : error.message });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  const host = process.env.HOST || '0.0.0.0';
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be 1–65535.');
  const app = createApp({ dataDir: process.env.DATA_DIR || path.join(root, 'data') });
  const server = app.listen(port, host, () => {
    console.log(`Study Buddy: http://localhost:${port}`);
    if (host === '0.0.0.0') {
      for (const addresses of Object.values(os.networkInterfaces())) {
        for (const address of addresses || []) {
          if (address.family === 'IPv4' && !address.internal) console.log(`Android / LAN: http://${address.address}:${port}`);
        }
      }
    }
  });
  server.on('error', error => { console.error(error.message); process.exitCode = 1; });
}

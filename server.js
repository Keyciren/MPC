import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { defaultPointTables, defaultSeasonConfig } from './public/js/logic.js';
import { summaryDocx } from './lib/docx.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PORT = Number(process.env.PORT) || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin';
const SECRET = process.env.SESSION_SECRET || crypto.createHash('sha256').update('mpc:' + ADMIN_PASSWORD).digest('hex');

if (!process.env.ADMIN_PASSWORD) {
  console.warn('⚠️  ADMIN_PASSWORD no está definido: la contraseña de administrador es "admin". Cámbiala en producción.');
}

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function emptyDb() {
  const seasonId = 's' + Date.now().toString(36);
  return {
    version: 1,
    settings: { clubName: 'Club de Poker', pointTables: defaultPointTables(), currentSeasonId: seasonId },
    players: [],
    seasons: [{ id: seasonId, name: 'Temporada 1', tournamentsCount: 12, config: defaultSeasonConfig() }],
    tournaments: Array.from({ length: 12 }, (_, i) => ({
      id: 't' + Date.now().toString(36) + i,
      seasonId,
      number: i + 1,
      label: `Fecha ${i + 1}`,
      dateOptions: [],
      finalDate: null,
      venue: '',
      modality: 'rebuy',
      type: 'normal',
      status: 'planned',
      dealersText: '',
      entries: [],
      tables: [],
      events: [],
      jackpots: [],
      bonus: [],
    })),
  };
}

let db;
function loadDb() {
  try {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch {
    db = emptyDb();
    saveDb();
  }
}
function saveDb() {
  const tmp = DB_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(db, null, 1));
  fs.renameSync(tmp, DB_FILE);
}
loadDb();

const sign = (v) => crypto.createHmac('sha256', SECRET).update(v).digest('hex');
function isAdmin(req) {
  const h = req.headers.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = tok.split('.');
  if (!payload || !sig || sign(payload) !== sig) return false;
  const exp = Number(payload.split(':')[1]);
  return exp > Date.now();
}
function requireAdmin(req, res, next) {
  if (!isAdmin(req)) return res.status(401).json({ error: 'No autorizado' });
  next();
}

function publicDb() {
  // Los jugadores no ven los correos
  return { ...db, players: db.players.map(({ email, ...p }) => p) };
}

const app = express();
app.use(express.json({ limit: '25mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '30d' }));

app.post('/api/login', (req, res) => {
  const pw = String((req.body && req.body.password) || '');
  const a = Buffer.from(sign(pw));
  const b = Buffer.from(sign(ADMIN_PASSWORD));
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const payload = 'admin:' + (Date.now() + 30 * 24 * 3600 * 1000);
  res.json({ token: payload + '.' + sign(payload) });
});

app.get('/api/db', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(isAdmin(req) ? db : publicDb());
});

app.get('/api/version', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ version: db.version });
});

app.put('/api/db', requireAdmin, (req, res) => {
  const { version, data } = req.body || {};
  if (!data || typeof data !== 'object' || !Array.isArray(data.players)) return res.status(400).json({ error: 'Datos inválidos' });
  if (version !== db.version) return res.status(409).json({ error: 'Los datos cambiaron en otro dispositivo. Recarga.', db });
  db = { ...data, version: db.version + 1 };
  saveDb();
  res.json({ version: db.version });
});

app.post('/api/upload', requireAdmin, (req, res) => {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec((req.body && req.body.dataUrl) || '');
  if (!m) return res.status(400).json({ error: 'Imagen inválida' });
  const ext = m[1] === 'jpeg' ? 'jpg' : m[1];
  const name = crypto.randomBytes(8).toString('hex') + '.' + ext;
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
  res.json({ url: '/uploads/' + name });
});

app.get('/api/backup', requireAdmin, (req, res) => {
  res.set('Content-Disposition', `attachment; filename="mpc-backup-${new Date().toISOString().slice(0, 10)}.json"`);
  res.json(db);
});

app.get('/api/tournaments/:id/resumen.docx', async (req, res) => {
  const t = db.tournaments.find((x) => x.id === req.params.id);
  if (!t) return res.status(404).send('Fecha no encontrada');
  try {
    const buf = await summaryDocx(db, t, UPLOAD_DIR);
    const fname = `Resumen_${(t.label || 'Fecha').replace(/[^\w]+/g, '_')}.docx`;
    res.set('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.set('Content-Disposition', `attachment; filename="${fname}"`);
    res.send(buf);
  } catch (e) {
    console.error(e);
    res.status(500).send('No se pudo generar el documento');
  }
});

app.listen(PORT, () => console.log(`Club de poker listo en http://localhost:${PORT}`));

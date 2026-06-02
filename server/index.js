const express = require('express');
const path    = require('path');
const fs      = require('fs');
const db      = require('./db');

// On startup: if DB is empty, seed from data/seed.json
const _existing = db.prepare('SELECT value FROM app_state WHERE key = ?').get('state');
if (!_existing) {
  const seedPath = path.join(__dirname, '../data/seed.json');
  if (fs.existsSync(seedPath)) {
    try {
      const seed = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      db.prepare('INSERT INTO app_state (key, value) VALUES (?, ?)').run('state', JSON.stringify(seed));
      console.log('DB seeded from seed.json');
    } catch(e) { console.error('Seed failed:', e.message); }
  }
}

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Never cache ANY static file — force proxy and browser to always fetch fresh
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, s-maxage=0');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  res.set('Surrogate-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, '../public')));

// ── GET full state ──────────────────────────────────────────────────────────
app.get('/api/state', (req, res) => {
  const row = db.prepare('SELECT value FROM app_state WHERE key = ?').get('state');
  res.json(row ? JSON.parse(row.value) : {});
});

// ── PUT full state ──────────────────────────────────────────────────────────
app.put('/api/state', (req, res) => {
  db.prepare(`
    INSERT INTO app_state (key, value, updated_at)
    VALUES (?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
  `).run('state', JSON.stringify(req.body));
  res.json({ ok: true });
});

// ── Fallback: serve index.html for any unknown route ───────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.listen(PORT, () => {
  console.log(`PeoplePlanner running at http://localhost:${PORT}`);
});

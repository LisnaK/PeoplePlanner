const express = require('express');
const path    = require('path');
const db      = require('./db');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));
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

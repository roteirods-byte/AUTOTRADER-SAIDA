/**
 * AUTOTRADER-SAIDA V2 — API/Servidor
 * Rotas:
 *  GET  /health
 *  GET  /api/saida/monitor
 *  GET  /api/saida/ops
 *  POST /api/saida/ops
 *  DELETE /api/saida/ops/:id
 *  GET  /saida
 */
const express = require("express");
const path = require("path");
const fs = require("fs");
const morgan = require("morgan");

const app = express();

app.disable("etag");
app.disable("x-powered-by");
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});
app.use(morgan("combined"));
app.use(express.json({ limit: "200kb" }));

const PORT = process.env.PORT || 8096;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DIST_DIR = path.join(__dirname, "dist");

app.use(express.static(DIST_DIR, { maxAge: "60s", etag: true }));

function readJson(p, fallback) {
  try {
    const raw = fs.readFileSync(p, "utf-8");
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function atomicWriteJson(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, p);
}

function ensureDataDir() {
  try { fs.mkdirSync(DATA_DIR, { recursive: true }); } catch {}
}

function opsPath() { return path.join(DATA_DIR, "saida_ops.json"); }
function monitorPath() { return path.join(DATA_DIR, "saida_monitor.json"); }

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "autotrader-saida-v2", ts: new Date().toISOString() });
});

app.get("/api/saida/monitor", (req, res) => {
  ensureDataDir();
  const data = readJson(monitorPath(), { updated_brt: null, ops: [] });
  res.json(data);
});

app.get("/api/saida/ops", (req, res) => {
  ensureDataDir();
  const data = readJson(opsPath(), { ops: [] });
  res.json(data);
});

app.post("/api/saida/ops", (req, res) => {
  ensureDataDir();
  const body = req.body || {};
  const par = String(body.par || "").trim().toUpperCase();
  const side = String(body.side || "").trim().toUpperCase();
  const entrada = Number(body.entrada);
  const alav = Number(body.alav);

  if (!par || !(side === "LONG" || side === "SHORT") || !Number.isFinite(entrada) || entrada <= 0 || !Number.isFinite(alav) || alav <= 0) {
    return res.status(400).json({ ok: false, error: "Dados inválidos. Use PAR, SIDE (LONG/SHORT), ENTRADA>0, ALAV>0." });
  }

  const now = new Date();
  const id = `${par}-${now.getTime()}`;

  const db = readJson(opsPath(), { ops: [] });
  const ops = Array.isArray(db.ops) ? db.ops : [];

  ops.push({ id, par, side, entrada, alav, created_ts: now.toISOString() });

  atomicWriteJson(opsPath(), { ops });
  return res.json({ ok: true, id });
});

app.delete("/api/saida/ops/:id", (req, res) => {
  ensureDataDir();
  const id = String(req.params.id || "").trim();
  const db = readJson(opsPath(), { ops: [] });
  const ops = Array.isArray(db.ops) ? db.ops : [];
  const next = ops.filter(o => String(o.id) !== id);
  atomicWriteJson(opsPath(), { ops: next });
  return res.json({ ok: true, removed: ops.length - next.length });
});

app.get("/saida", (req, res) => res.sendFile(path.join(DIST_DIR, "saida.html")));
app.get("/", (req, res) => res.redirect("/saida"));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[AUTOTRADER-SAIDA-V2] API on :${PORT} | DATA_DIR=${DATA_DIR}`);
});

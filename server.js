"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();

const PORT = process.env.PORT || 8096;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DIST_DIR = path.join(__dirname, "dist");

fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: "100kb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function safeReadJson(p, fallback) {
  try {
    if (!fs.existsSync(p)) return fallback;
    const s = fs.readFileSync(p, "utf-8");
    if (!s || !String(s).trim()) return fallback;
    return JSON.parse(s);
  } catch (e) {
    return fallback;
  }
}

function safeWriteJson(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf-8");
  fs.renameSync(tmp, p);
}

function nowBrtStr() {
  try {
    const d = new Date();
    const f = new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    });
    const parts = f.formatToParts(d);
    const y = parts.find(x => x.type === "year").value;
    const m = parts.find(x => x.type === "month").value;
    const da = parts.find(x => x.type === "day").value;
    const hh = parts.find(x => x.type === "hour").value;
    const mm = parts.find(x => x.type === "minute").value;
    return `${y}-${m}-${da} ${hh}:${mm}`;
  } catch (e) {
    return null;
  }
}

const OPS_FILE = path.join(DATA_DIR, "saida_ops.json");
const MON_FILE = path.join(DATA_DIR, "saida_monitor.json");

/* =========================
   HEALTH
========================= */
app.get("/health", (req, res) => {
  res.json({ ok: true, service: "autotrader-saida-v2", ts: new Date().toISOString() });
});

/* =========================
   SAÍDA 1 (OPS) - ENTRADA MANUAL
========================= */
app.get("/api/ops", (req, res) => {
  const d = safeReadJson(OPS_FILE, { ops: [] });
  res.json({ updated_brt: nowBrtStr(), ops: Array.isArray(d.ops) ? d.ops : [] });
});

app.post("/api/ops/add", (req, res) => {
  const par = String(req.body?.par || "").trim().toUpperCase();
  const side = String(req.body?.side || "").trim().toUpperCase();
  const entrada = Number(req.body?.entrada);
  const alav = Number(req.body?.alav);

  if (!par) return res.status(400).json({ ok: false, error: "PAR inválido" });
  if (!(side === "LONG" || side === "SHORT")) return res.status(400).json({ ok: false, error: "SIDE inválido" });
  if (!Number.isFinite(entrada) || entrada <= 0) return res.status(400).json({ ok: false, error: "ENTRADA inválida" });
  if (!Number.isFinite(alav) || alav <= 0) return res.status(400).json({ ok: false, error: "ALAV inválida" });

  const cur = safeReadJson(OPS_FILE, { ops: [] });
  const ops = Array.isArray(cur.ops) ? cur.ops : [];

  const op = {
    id: `${par}-${Date.now()}`,
    par,
    side,
    entrada,
    alav,
    created_ts: new Date().toISOString()
  };

  ops.push(op);
  safeWriteJson(OPS_FILE, { ops });

  res.json({ ok: true, op, ops });
});

app.post("/api/ops/del", (req, res) => {
  const id = String(req.body?.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, error: "ID inválido" });

  const cur = safeReadJson(OPS_FILE, { ops: [] });
  let ops = Array.isArray(cur.ops) ? cur.ops : [];
  ops = ops.filter(o => String(o.id) !== id);

  safeWriteJson(OPS_FILE, { ops });
  res.json({ ok: true, ops });
});

/* =========================
   SAÍDA 2 (MONITOR) - LÊ O JSON DO WORKER
========================= */
app.get("/api/monitor", (req, res) => {
  const d = safeReadJson(MON_FILE, { updated_brt: null, ops: [] });
  const ops = Array.isArray(d.ops) ? d.ops : [];
  res.json({ updated_brt: d.updated_brt || nowBrtStr(), ops });
});

/* =========================
   PÁGINAS
========================= */
app.use("/dist", express.static(DIST_DIR, { maxAge: 0 }));

app.get("/", (req, res) => res.redirect("/saida2"));
app.get("/saida", (req, res) => res.redirect("/saida2"));

app.get("/saida1", (req, res) => res.sendFile(path.join(DIST_DIR, "saida1.html")));
app.get("/saida2", (req, res) => res.sendFile(path.join(DIST_DIR, "saida2.html")));

/* =========================
   START
========================= */
app.listen(PORT, "0.0.0.0", () => {
  console.log(`[AUTOTRADER-SAIDA-V2] API on :${PORT} | DATA_DIR=${DATA_DIR}`);
});

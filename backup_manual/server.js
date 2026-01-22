"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();

const PORT = process.env.PORT || 8096;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DIST_DIR = process.env.DIST_DIR || path.join(__dirname, "dist");

// caminho do PRO (para puxar o ALVO fixo)
const PRO_JSON = process.env.PRO_JSON || "/home/roteiro_ds/AUTOTRADER-PRO/data/pro.json";

fs.mkdirSync(DATA_DIR, { recursive: true });
// versão/build do deploy (para confirmar que a revisão entrou no ar)
const VERSION_FILE = process.env.VERSION_FILE || path.join(__dirname, "VERSION");
function readVersion() {
  try {
    const v = fs.readFileSync(VERSION_FILE, "utf-8").trim();
    return v || "unknown";
  } catch (e) {
    return String(process.env.BUILD_ID || "unknown");
  }
}


app.use(express.json({ limit: "200kb" }));
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
  } catch {
    return fallback;
  }
}

function safeWriteJson(p, obj) {
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf-8");
  fs.renameSync(tmp, p);
}

function up(v) {
  return String(v || "").trim().toUpperCase();
}
function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function readPro() {
  return safeReadJson(PRO_JSON, { updated_brt: null, sinais: [], lista: [] });
}

function pickSinais(pro) {
  if (Array.isArray(pro.sinais)) return pro.sinais;
  if (Array.isArray(pro.lista)) return pro.lista;
  return [];
}

function findAlvoFromPro(par, side) {
  const pro = readPro();
  const sinais = pickSinais(pro);

  const P = up(par);
  const S = up(side);

  // tenta achar por par+side
  let hit =
    sinais.find((x) => up(x.par) === P && up(x.side || x.sinal || x.side_src) === S) ||
    sinais.find((x) => up(x.par) === P);

  if (!hit) return { ok: false, msg: "Sem alvo no PRO para esta moeda.", updated_brt: pro.updated_brt || null };

  const alvo = num(hit.alvo ?? hit.target ?? hit.tp ?? hit.takeprofit);
  if (!alvo) return { ok: false, msg: "PRO não trouxe alvo válido para esta moeda.", updated_brt: pro.updated_brt || null };

  return { ok: true, alvo, updated_brt: pro.updated_brt || null };
}

// arquivos do SAÍDA
const P_OPS = path.join(DATA_DIR, "saida_ops.json");
const P_MON = path.join(DATA_DIR, "saida_monitor.json");

function readOps() {
  const d = safeReadJson(P_OPS, { ops: [] });
  if (!d || !Array.isArray(d.ops)) return { ops: [] };
  return d;
}

function writeOps(d) {
  safeWriteJson(P_OPS, d);
}

// --- ROTAS ---
app.get("/health", (req, res) => res.json({ ok: true, service: "autotrader-saida-v2", ts: new Date().toISOString() }));

// serve página única (2 painéis)
app.use("/dist", express.static(DIST_DIR));
app.get("/", (req, res) => res.redirect("/saida"));
app.get("/saida", (req, res) => res.sendFile(path.join(DIST_DIR, "saida.html")));
app.get("/saida2", (req, res) => res.redirect("/saida")); // compatibilidade

// versão (para debug de deploy)
app.get("/api/saida/version", (req, res) => {
  res.json({ ok: true, version: readVersion(), now_utc: new Date().toISOString() });
});
app.get("/version", (req, res) => {
  res.json({ ok: true, version: readVersion(), now_utc: new Date().toISOString() });
});


// alvo do PRO (para preencher no painel antes de adicionar)
app.get("/api/saida/alvo", (req, res) => {
  const par = up(req.query.par);
  const side = up(req.query.side);
  const r = findAlvoFromPro(par, side);
  if (!r.ok) return res.status(404).json({ ok: false, msg: r.msg, updated_brt: r.updated_brt || null });
  res.json({ ok: true, par, side, alvo: r.alvo, updated_brt: r.updated_brt || null });
});

// adicionar operação (ALVO fica congelado aqui)
app.post("/api/saida/add", (req, res) => {
  const par = up(req.body?.par);
  const side = up(req.body?.side);
  const entrada = num(req.body?.entrada);
  const alav = Math.max(1, Math.floor(num(req.body?.alav)));

  if (!par) return res.status(400).json({ ok: false, msg: "PAR inválido." });
  if (!(side === "LONG" || side === "SHORT")) return res.status(400).json({ ok: false, msg: "SIDE inválido (LONG/SHORT)." });
  if (!(entrada > 0)) return res.status(400).json({ ok: false, msg: "ENTRADA inválida." });

  // pega alvo do PRO
  const alvoR = findAlvoFromPro(par, side);
  if (!alvoR.ok) return res.status(400).json({ ok: false, msg: alvoR.msg });

  const d = readOps();

  // evita duplicar a mesma moeda
  if (d.ops.some((x) => up(x.par) === par)) {
    return res.status(400).json({ ok: false, msg: "Essa moeda já está na lista. Exclua antes para adicionar de novo." });
  }

  const id = `${par}-${Date.now()}`;
  d.ops.push({
    id,
    par,
    side,
    entrada,
    alvo: alvoR.alvo, // congelado
    alav,
    created_ts: new Date().toISOString(),
    pro_updated_brt: alvoR.updated_brt || null,
  });

  writeOps(d);
  res.json({ ok: true, id });
});

// excluir operação
app.post("/api/saida/del", (req, res) => {
  const id = String(req.body?.id || "").trim();
  if (!id) return res.status(400).json({ ok: false, msg: "ID inválido." });

  const d = readOps();
  const before = d.ops.length;
  d.ops = d.ops.filter((x) => String(x.id) !== id);
  writeOps(d);

  res.json({ ok: true, removed: before - d.ops.length });
});


// compatibilidade: alguns painéis antigos usam /api/saida/delete
app.post("/api/saida/delete", (req, res) => {
  // reaproveita a mesma lógica do /del
  req.url = '/api/saida/del';
  return app._router.handle(req, res, () => {});
});

// monitor (arquivo gerado pelo worker)
app.get("/api/saida/monitor", (req, res) => {
  const d = safeReadJson(P_MON, { updated_brt: null, ops: [] });
  res.json(d);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[AUTOTRADER-SAIDA-V2] API on :${PORT} | DATA_DIR=${DATA_DIR}`);
});

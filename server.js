"use strict";

const fs = require("fs");
const path = require("path");
const express = require("express");

const app = express();

const PORT = process.env.PORT || 8096;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DIST_DIR = process.env.DIST_DIR || path.join(__dirname, "dist");

fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(express.json({ limit: "200kb" }));
app.use((req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

function up(v){ return String(v || "").trim().toUpperCase(); }
function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function safeReadJson(p, fallback){
  try{
    if (!fs.existsSync(p)) return fallback;
    const s = fs.readFileSync(p, "utf-8");
    if (!s || !String(s).trim()) return fallback;
    return JSON.parse(s);
  }catch{
    return fallback;
  }
}

function safeWriteJson(p, obj){
  const tmp = p + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf-8");
  fs.renameSync(tmp, p);
}

function pickExisting(paths){
  for (const p of paths){
    try{
      if (p && fs.existsSync(p)) return p;
    }catch{}
  }
  return null;
}

function collectEntries(node, out, depth){
  if (depth > 6) return;
  if (Array.isArray(node)){
    for (const x of node) collectEntries(x, out, depth+1);
    return;
  }
  if (!node || typeof node !== "object") return;

  const par = up(node.par || node.symbol || node.moeda || node.ticker);
  const side = up(node.side || node.sinal || node.tipo || node.position || node.direction);
  const alvo = node.alvo ?? node.target ?? node.tp ?? node.take_profit ?? node.takeProfit;

  if (par && alvo !== undefined){
    out.push({ par, side, alvo });
  }

  for (const k of Object.keys(node)){
    const v = node[k];
    if (typeof v === "object" && v !== null) collectEntries(v, out, depth+1);
  }
}

function readProAndFindAlvo(par, side){
  const candidates = [
    process.env.PRO_JSON,
    "/home/roteiro_ds/AUTOTRADER-PRO/data/pro.json",
    "/home/roteiro_ds/AUTOTRADER-PRO/data/pro_api.json",
    "/home/roteiro_ds/AUTOTRADER-PRO/data/top10.json",
    "/home/roteiro_ds/AUTOTRADER-PRO/data/pro_top10.json"
  ];
  const proFile = pickExisting(candidates);
  if (!proFile){
    return { ok:false, msg:"Não achei o arquivo do PRO no servidor.", updated_brt:null };
  }

  const d = safeReadJson(proFile, null);
  if (!d) return { ok:false, msg:"Arquivo do PRO está vazio ou inválido.", updated_brt:null };

  const updated_brt = d.updated_brt || d.updated || d.updatedAt || d.pro_updated_brt || null;

  const items = [];
  collectEntries(d, items, 0);

  const wantPar = up(par);
  const wantSide = up(side);

  for (const it of items){
    if (it.par === wantPar && (it.side === wantSide)){
      const a = Number(it.alvo);
      if (Number.isFinite(a) && a > 0) return { ok:true, alvo:a, updated_brt };
    }
  }
  for (const it of items){
    if (it.par === wantPar){
      const a = Number(it.alvo);
      if (Number.isFinite(a) && a > 0) return { ok:true, alvo:a, updated_brt };
    }
  }

  return { ok:false, msg:"Sem alvo do PRO para essa moeda.", updated_brt };
}

const OPS_FILE = path.join(DATA_DIR, "saida_ops.json");
const MON_FILE = path.join(DATA_DIR, "saida_monitor.json");

function readOps(){
  const d = safeReadJson(OPS_FILE, { ops: [] });
  if (!d.ops || !Array.isArray(d.ops)) d.ops = [];
  return d;
}

function writeOps(d){
  safeWriteJson(OPS_FILE, d);
}

app.use("/dist", express.static(DIST_DIR));
app.get("/", (req,res)=>res.redirect("/saida"));
app.get("/saida", (req,res)=>res.sendFile(path.join(DIST_DIR, "saida.html")));

app.get("/api/saida/version", (req,res)=>{
  let v = "unknown";
  try {
    v = fs.readFileSync(path.join(__dirname, "VERSION"), "utf-8").trim();
  } catch (e) {}
  res.json({ ok:true, version: v, now_utc: new Date().toISOString() });
});


app.get("/api/saida/monitor", (req,res)=>{
  const d = safeReadJson(MON_FILE, { updated_brt: null, ops: [] });
  res.json(d);
});

app.get("/api/saida/ops", (req,res)=>{
  res.json(readOps());
});

app.get("/api/saida/alvo", (req,res)=>{
  const par = up(req.query.par);
  const side = up(req.query.side);
  if (!par) return res.status(400).json({ ok:false, msg:"Moeda inválida." });
  if (!(side==="LONG" || side==="SHORT")) return res.status(400).json({ ok:false, msg:"Side inválido." });

  const r = readProAndFindAlvo(par, side);
  if (!r.ok) return res.status(404).json({ ok:false, msg:r.msg, updated_brt:r.updated_brt });
  res.json({ ok:true, par, side, alvo:r.alvo, updated_brt:r.updated_brt });
});

app.post("/api/saida/add", (req,res)=>{
  const par = up(req.body?.par);
  const side = up(req.body?.side);
  const entrada = num(req.body?.entrada);
  const alav = Math.max(1, Math.floor(num(req.body?.alav)));

  if (!par) return res.status(400).json({ ok:false, msg:"Moeda inválida." });
  if (!(side==="LONG" || side==="SHORT")) return res.status(400).json({ ok:false, msg:"Side inválido." });
  if (!Number.isFinite(entrada) || entrada<=0) return res.status(400).json({ ok:false, msg:"Entrada inválida." });
  if (!Number.isFinite(alav) || alav<1) return res.status(400).json({ ok:false, msg:"Alavancagem inválida." });

  const r = readProAndFindAlvo(par, side);
  if (!r.ok) return res.status(400).json({ ok:false, msg:"Sem alvo do PRO para adicionar.", updated_brt:r.updated_brt || null });

  const id = `${par}-${Date.now()}`;
  const d = readOps();
  d.ops.push({
    id,
    par,
    side,
    entrada,
    alvo: r.alvo,
    alav,
    created_ts: new Date().toISOString(),
    pro_updated_brt: r.updated_brt || null
  });
  writeOps(d);
  res.json({ ok:true, id });
});

app.post("/api/saida/del", (req,res)=>{
  const id = String(req.body?.id || "").trim();
  if (!id) return res.status(400).json({ ok:false, msg:"ID inválido." });

  const d = readOps();
  const before = d.ops.length;
  d.ops = d.ops.filter(x => String(x.id) !== id);
  writeOps(d);

  res.json({ ok:true, removed: before - d.ops.length });
});

// rota antiga (compatível com página velha)
app.post("/api/saida/delete", (req,res)=> {
  req.url = "/api/saida/del";
  app._router.handle(req, res);
});

app.listen(PORT, "0.0.0.0", ()=> {
  console.log("AUTOTRADER-SAIDA rodando na porta", PORT);
});

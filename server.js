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

// ====== DATA/HORA BRT (FIXA NO REGISTRO) ======
function nowBRT_DDMMYYYY_HHMM(){
  const d = new Date();
  const data = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(d); // DD/MM/AAAA

  const hora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(d); // HH:MM

  return { data, hora };
}

const OPS_FILE = path.join(DATA_DIR, "saida_ops.json");
const MON_FILE = path.join(DATA_DIR, "saida_monitor.json");
const HISTORY_FILE = path.join(DATA_DIR, "saida_history.json");

function readOps(){
  const d = safeReadJson(OPS_FILE, { ops: [] });
  if (!d.ops || !Array.isArray(d.ops)) d.ops = [];
  return d;
}
function writeOps(d){
  safeWriteJson(OPS_FILE, d);
}

function readHistory(){
  const d = safeReadJson(HISTORY_FILE, { history: [] });
  if (!d.history || !Array.isArray(d.history)) d.history = [];
  return d;
}
function writeHistory(d){
  safeWriteJson(HISTORY_FILE, d);
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

app.get("/api/saida/history", (req,res)=>{
  res.json(readHistory());
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

// ADD (cria operação + DATA/HORA FIXAS)
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
  const reg = nowBRT_DDMMYYYY_HHMM();

  const d = readOps();
  d.ops.push({
    id,
    par,
    side,
    entrada,
    alvo: r.alvo,
    alav,

    // FIXO (auditoria)
    data_reg: reg.data,
    hora_reg: reg.hora,

    // técnico
    created_ts_utc: new Date().toISOString(),
    pro_updated_brt: r.updated_brt || null
  });

  writeOps(d);
  res.json({ ok:true, id });
});

// SAIR (fecha operação -> move para histórico permanente)
app.post("/api/saida/exit", (req,res)=>{
  const id = String(req.body?.id || "").trim();
  const preco_saida = num(req.body?.preco_saida); // opcional (se mandar)
  const motivo = String(req.body?.motivo || "").trim(); // opcional

  if (!id) return res.status(400).json({ ok:false, msg:"ID inválido." });

  const d = readOps();
  const idx = d.ops.findIndex(x => String(x.id) === id);
  if (idx < 0) return res.status(404).json({ ok:false, msg:"Operação não encontrada (ops)." });

  const op = d.ops[idx];
  d.ops.splice(idx, 1);
  writeOps(d);

  const ex = nowBRT_DDMMYYYY_HHMM();
  const hd = readHistory();
  hd.history.push({
    ...op,

    // FECHAMENTO (auditoria)
    data_exit: ex.data,
    hora_exit: ex.hora,
    exit_ts_utc: new Date().toISOString(),
    preco_saida: Number.isFinite(preco_saida) && preco_saida > 0 ? preco_saida : null,
    motivo: motivo || null,
    status_final: "SAIU"
  });
  writeHistory(hd);

  res.json({ ok:true, moved_to_history: 1 });
});

// EXCLUIR (remove da lista em andamento - NÃO vai pro histórico)
app.post("/api/saida/del", (req,res)=>{
  const id = String(req.body?.id || "").trim();
  if (!id) return res.status(400).json({ ok:false, msg:"ID inválido." });

  const d = readOps();
  const before = d.ops.length;
  d.ops = d.ops.filter(x => String(x.id) !== id);
  writeOps(d);

  res.json({ ok:true, removed: before - d.ops.length });
});

// PDF do HISTÓRICO (arquivo real)
app.get("/api/saida/history.pdf", (req,res)=>{
  let PDFDocument;
  try{
    PDFDocument = require("pdfkit");
  }catch{
    return res.status(500).json({
      ok:false,
      msg:"Falta instalar pdfkit. Rode: npm install pdfkit"
    });
  }

  const hd = readHistory();
  const items = Array.isArray(hd.history) ? hd.history : [];

  const ts = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
  const filename = `historico_saida_${ts}.pdf`;

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const doc = new PDFDocument({ size: "A4", margin: 28 });
  doc.pipe(res);

  doc.fontSize(16).text("AUTOTRADER - HISTÓRICO SAÍDA", { align: "center" });
  doc.moveDown(0.4);
  doc.fontSize(9).text(`Gerado (UTC): ${new Date().toISOString()}`, { align: "center" });
  doc.moveDown(0.8);

  doc.fontSize(10).text(`Total de operações encerradas: ${items.length}`);
  doc.moveDown(0.6);

  // cabeçalho
  doc.fontSize(9);
  doc.text("PAR", 28, doc.y, { continued: true, width: 45 });
  doc.text("SIDE", { continued: true, width: 55 });
  doc.text("ENTRADA", { continued: true, width: 65 });
  doc.text("ALVO", { continued: true, width: 60 });
  doc.text("ALAV", { continued: true, width: 45 });
  doc.text("REG", { continued: true, width: 85 });
  doc.text("SAÍDA", { width: 85 });
  doc.moveDown(0.3);
  doc.text("".padEnd(110, "-"));
  doc.moveDown(0.3);

  for (const op of items){
    const reg = `${op.data_reg || ""} ${op.hora_reg || ""}`.trim();
    const ext = `${op.data_exit || ""} ${op.hora_exit || ""}`.trim();

    doc.text(String(op.par || ""), 28, doc.y, { continued: true, width: 45 });
    doc.text(String(op.side || ""), { continued: true, width: 55 });
    doc.text(String(op.entrada ?? ""), { continued: true, width: 65 });
    doc.text(String(op.alvo ?? ""), { continued: true, width: 60 });
    doc.text(String(op.alav ?? ""), { continued: true, width: 45 });
    doc.text(reg, { continued: true, width: 85 });
    doc.text(ext, { width: 85 });

    if (doc.y > 760) doc.addPage();
  }

  doc.end();
});

// rota antiga (compatível com página velha)
app.post("/api/saida/delete", (req,res)=> {
  req.url = "/api/saida/del";
  app._router.handle(req, res);
});

app.listen(PORT, "0.0.0.0", ()=> {
  console.log("AUTOTRADER-SAIDA rodando na porta", PORT);
});

/**
 * AUTOTRADER-SAIDA (SAÍDA V2) — API + Static
 * Objetivo: painéis /saida + API para:
 * - ALVO do PRO (congelado) via /api/saida/alvo?par=XXX&side=LONG|SHORT
 * - Operações ativas (monitoradas) em /api/saida/ops e /api/saida/monitor
 * - Operações realizadas (histórico) em /api/saida/realizadas
 * - ADD, SAIR (move para realizadas), EXCLUIR
 *
 * Regras:
 * - Sem cache (no-store)
 * - Campos e colunas alinhados ao projeto (JORGE)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const PRO_JSON_FILE = process.env.PRO_JSON_FILE || "/home/roteiro_ds/AUTOTRADER-PRO/data/pro.json";
const express = require('express');
const PDFDocument = require('pdfkit');

const PORT = parseInt(process.env.PORT || '8096', 10);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DIST_DIR = path.join(__dirname, 'dist');

const OPS_ACTIVE_FILE = path.join(DATA_DIR, 'ops_active.json');
const OPS_REAL_FILE   = path.join(DATA_DIR, 'ops_realizadas.json');
const MONITOR_FILE    = path.join(DATA_DIR, 'monitor.json');

// Integração do PRO (alvo congelado):
// 1) se existir ENTRADA_PRO_JSON, tenta ler dele
// 2) senão, usa data/alvo_pro.json (local)
const ENTRADA_PRO_JSON = process.env.ENTRADA_PRO_JSON || ''; // ex: /home/roteiro_ds/autotrader-planilhas-python/data/entrada.json
const ALVO_PRO_FALLBACK = path.join(DATA_DIR, 'alvo_pro.json');

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}
ensureDir(DATA_DIR);

function safeReadJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const s = fs.readFileSync(file, 'utf8');
    if (!s.trim()) return fallback;
    return JSON.parse(s);
  } catch (e) {
    return fallback;
  }
}

function safeWriteJson(file, obj) {
  const tmp = file + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2));
  fs.renameSync(tmp, file);
}

function fmtPrice3(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(3);
}

function fmtPct2(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toFixed(2) + '%';
}

function pdfTable(res, title, columns, rows) {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${String(title || '').replace(/\s+/g,'_')}.pdf"`);

  const doc = new PDFDocument({ layout: 'landscape',  margin: 28, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  const { data, hora } = nowBRTParts();
function nowBRT() {
  const d = new Date();
  const parts = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit'
  }).format(d);
  return parts.replace(',', '');
}

  doc.fontSize(16).text('AUTOTRADER-SAÍDA', { align: 'left' });
  doc.moveDown(0.2);
  doc.fontSize(11).text(`${title}  |  Gerado em: ${nowBRT()}`, { align: 'left' });
  doc.moveDown(0.8);
  // Layout simples (tabela em texto):
  doc.fontSize(8);
  const colGap = 8;
  const pageW = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const colW = Math.max(60, Math.floor((pageW - (columns.length - 1) * colGap) / columns.length));

  const drawRow = (cells, isHeader=false) => {
    const y0 = doc.y;
    let x = doc.page.margins.left;
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica');
    for (let i = 0; i < columns.length; i++) {
      doc.text(String(cells[i] ?? ''), x, y0, { width: colW, continued: false, lineBreak: false, ellipsis: true });
      x += colW + colGap;
    }
    doc.y = y0 + 12;
    if (doc.y > doc.page.height - doc.page.margins.bottom - 20) {
      doc.addPage();
    }
  };

  drawRow(columns, true);
  doc.moveDown(0.2);

  for (const r of rows) {
    drawRow(r, false);
  }

  doc.end();
}

function nowBRTParts() {
  // BRT: America/Sao_Paulo
  const dt = new Date();
  const fmtDate = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day:'2-digit', month:'2-digit', year:'numeric' });
  const fmtTime = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', hour:'2-digit', minute:'2-digit', hour12:false });
  return { data: fmtDate.format(dt), hora: fmtTime.format(dt) };
}

function okNoStore(res) {
  res.setHeader('Cache-Control', 'no-store');
}

function normalizeSide(sideRaw) {
  const s = String(sideRaw || '').toUpperCase().trim();
  if (s === 'LONG' || s === 'SHORT') return s;
  return '';
}

function normalizePar(parRaw) {
  const p = String(parRaw || '').toUpperCase().trim();
  // aceita apenas letras/números/underscore/hífen (segurança)
  if (!p || !/^[A-Z0-9_\\-]{2,20}$/.test(p)) return '';
  return p;
}

function loadActive() {
  return safeReadJson(OPS_ACTIVE_FILE, { updated_brt: null, ops: [] });
}
function saveActive(obj) {
  safeWriteJson(OPS_ACTIVE_FILE, obj);
}
function loadReal() {
  return safeReadJson(OPS_REAL_FILE, { updated_brt: null, ops: [] });
}
function saveReal(obj) {
  safeWriteJson(OPS_REAL_FILE, obj);
}
function loadMonitor() {
  const monitor = safeReadJson(MONITOR_FILE, { updated_brt: null, ops: [] });
  const active  = loadActive();

  const mOps = Array.isArray(monitor.ops) ? monitor.ops : [];
  const aOps = Array.isArray(active.ops) ? active.ops : [];

  // merge por id (preferir o que já veio do monitor, se existir)
  const byId = new Map();
  for (const op of aOps) byId.set(String(op.id), op);
  for (const op of mOps) byId.set(String(op.id), Object.assign({}, byId.get(String(op.id)), op));

  const { data, hora } = nowBRTParts();

  const ops = Array.from(byId.values()).map(op => {
    const gains = computeGains(op);
    return Object.assign(
      {
        situacao: op.situacao || 'EM ANDAMENTO',
        data_atual: op.data_atual || data,
        hora_atual: op.hora_atual || hora,
      },
      op,
      gains
    );
  });

  return Object.assign({}, monitor, { updated_brt: `${data} ${hora}`, ops });
}

function findOpById(list, id) {
  return (list || []).find(o => String(o.id) === String(id));
}

function computeGains(op) {
  const side = normalizeSide(op.side);
  const entrada = Number(op.entrada);
  const alvo = Number(op.alvo);
  const atual = Number(op.atual);
  const okNums = Number.isFinite(entrada) && entrada > 0;
  let ganhoAlvo = null;
  let ganhoAtual = null;

  if (okNums && Number.isFinite(alvo) && alvo > 0) {
    ganhoAlvo = side === 'SHORT' ? ((entrada / alvo) - 1) * 100 : ((alvo / entrada) - 1) * 100;
  }
  if (okNums && Number.isFinite(atual) && atual > 0) {
    ganhoAtual = side === 'SHORT' ? ((entrada / atual) - 1) * 100 : ((atual / entrada) - 1) * 100;
  }

  return { ganho_alvo: ganhoAlvo, ganho_atual: ganhoAtual };
}


// ================================
// SAFE HELPERS (produção - anti-erro)
// ================================
function readVersion() {
  // prioridade: arquivo VERSION (repo)
  try {
    const v = fs.readFileSync(path.join(__dirname, "VERSION"), "utf8").trim();
    if (v) return v;
  } catch (e) {}
  // fallback: BUILD_ID ou package.json
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
    return (process.env.BUILD_ID || pkg.version || "unknown");
  } catch (e) {
    return (process.env.BUILD_ID || "unknown");
  }
}


function normPar(x) {
  return String(x || "").trim().toUpperCase().replace(/USDT$/i, "");
}
function normSide(x) {
  const t = String(x || "").trim().toUpperCase();
  if (t === "LONG" || t === "BUY") return "LONG";
  if (t === "SHORT" || t === "SELL") return "SHORT";
  return t || "LONG";
}

/**
 * extractAlvoFromPro(proAny, par, side)
 * Retorna { alvo, updated } ou null.
 * Compatível com pro.json em formatos: array, {items:[]}, {rows:[]}, {data:[]}
 */
function extractAlvoFromPro(proAny, par, side) {
  const P = normPar(par);
  const S = normSide(side);

  const arr =
    (Array.isArray(proAny) && proAny) ||
    (proAny && Array.isArray(proAny.items) && proAny.items) ||
    (proAny && Array.isArray(proAny.rows) && proAny.rows) ||
    (proAny && Array.isArray(proAny.data) && proAny.data) ||
    [];

  for (const it of arr) {
    const ip = normPar(it.par || it.symbol || it.moeda);
    const isd = normSide(it.side || it.signal || it.lado);
    if (ip === P && isd === S) {
      const alvoRaw = (it.alvo ?? it.target ?? it.tp ?? it.price_target);
      const alvo = Number(alvoRaw);
      if (Number.isFinite(alvo) && alvo > 0) {
        const updated = it.updated_brt || it.updated || (it.meta && it.meta.updated_brt) || null;
        return { alvo, updated };
      }
    }
  }
  return null;
}

function safeReadProJson() {
  try {
    if (!PRO_JSON_FILE || !fs.existsSync(PRO_JSON_FILE)) return null;
    return JSON.parse(fs.readFileSync(PRO_JSON_FILE, "utf8"));
  } catch (e) {
    return null;
  }
}

const app = express();
app.use(express.json({ limit: '256kb' }));

// Sem cache em tudo
app.use((req, res, next) => { okNoStore(res); next(); });

// Static
app.get(['/','/saida'], (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'saida.html'));
});
app.use('/dist', express.static(DIST_DIR, { etag: true, immutable: false, maxAge: 0 }));

// Health
app.get('/api/health', (req, res) => res.json({ ok:true, service:'autotrader-saida', ts: new Date().toISOString() }));

// Version (para validar deploy no navegador)

/**
 * GET /api/saida/health
 * Sempre responde JSON (sem HTML)
 */
app.get('/api/saida/health', (req, res) => {
  return res.json({ ok:true, service:'autotrader-saida', ts: new Date().toISOString() });
});

app.get('/api/saida/version', (req, res) => {
  const version = readVersion();
  return res.json({ ok:true, service:'autotrader-saida', version, ts: new Date().toISOString() });
});

/**
 * GET /api/saida/alvo?par=ADA&side=LONG
 * Retorna alvo congelado do PRO.
 */
app.get('/api/saida/alvo', (req, res) => {
  const par = normalizePar(req.query.par);
  const side = normalizeSide(req.query.side);
  if (!par) return res.status(400).json({ ok:false, msg:'Par inválido.' });
  if (!side) return res.status(400).json({ ok:false, msg:'Side inválido.' });

  let alvo = null;
  let updated_brt = null;
  let src = null;

  // 1) fonte oficial: PRO_JSON_FILE (pro.json do PRO)
  try {
    const pro = safeReadProJson();
    if (pro) {
      updated_brt = pro.updated_brt || pro.updated || null;
      const v = extractAlvoFromPro(pro, par, side);
      if (Number.isFinite(v) && v > 0) { alvo = v; src = 'PRO_JSON_FILE'; }
    }
  } catch (e) {}

  // 2) fallback: ENTRADA_PRO_JSON (se existir)
  if (alvo == null && ENTRADA_PRO_JSON && fs.existsSync(ENTRADA_PRO_JSON)) {
    const pro = safeReadJson(ENTRADA_PRO_JSON, null);
    if (pro) {
      updated_brt = updated_brt || pro.updated_brt || pro.updated || null;
      if (Array.isArray(pro.alvos)) {
        const hit = pro.alvos.find(x => normalizePar(x.par) === par && normalizeSide(x.side) === side);
        if (hit && Number.isFinite(Number(hit.alvo)) && Number(hit.alvo) > 0) { alvo = Number(hit.alvo); src='ENTRADA_PRO_JSON'; }
      } else if (pro.alvo_por_par && pro.alvo_por_par[par] && pro.alvo_por_par[par][side] != null) {
        const v = Number(pro.alvo_por_par[par][side]);
        if (Number.isFinite(v) && v > 0) { alvo = v; src='ENTRADA_PRO_JSON'; }
      }
    }
  }

  // 3) fallback local: ALVO_PRO_FALLBACK
  if (alvo == null) {
    const fb = safeReadJson(ALVO_PRO_FALLBACK, {});
    const v = fb?.[par]?.[side];
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) { alvo = Number(v); src='ALVO_PRO_FALLBACK'; }
    updated_brt = updated_brt || fb.updated_brt || null;
  }

  if (alvo == null) return res.status(404).json({ ok:false, msg:'Alvo não encontrado.', par, side });

  return res.json({ ok:true, par, side, alvo, updated_brt, src });
});


/**
 * GET /api/saida/ops  -> operações ativas (cadastro)
 */
app.get('/api/saida/ops', (req, res) => {
  const active = loadActive();
  res.json(active);
});

/**
 * GET /api/saida/monitor -> operações ativas + calculadas (worker)
 */
app.get('/api/saida/monitor', (req, res) => {
  const m = loadMonitor();
  res.json(m);
});

/**
 * GET /api/saida/realizadas -> histórico (não atualiza)
 */
app.get('/api/saida/realizadas', (req, res) => {
  res.json(loadReal());
});

// PDF (arquivo real) - sem colunas de ação (SAIR/EXCLUIR)
app.get('/api/saida/pdf', (req, res) => {
  const scope = String(req.query.scope || 'monitor').toLowerCase();
  const src = (scope === 'real' || scope === 'realizadas') ? loadReal() : loadMonitor();
  const ops = Array.isArray(src.real) ? src.real : (Array.isArray(src.ops) ? src.ops : []);

  const columns = [
    'PAR','SIDE','ENTRADA','ALVO','ALAV','DATA REG','HORA REG',
    'ATUAL','GANHO ALVO','GANHO ATUAL','SITUACAO','DATA ATUAL','HORA ATUAL'
  ];

  const rows = ops.map(op => ([
    String(op.par || '').toUpperCase(),
    String(op.side || '').toUpperCase(),
    fmtPrice3(op.entrada),
    fmtPrice3(op.alvo),
    (Number.isFinite(Number(op.alav)) ? String(Number(op.alav)) : '—'),
    String(op.data_reg || op.data || '—'),
    String(op.hora_reg || op.hora || '—'),
    fmtPrice3(op.atual),
    fmtPct2(op.ganho_alvo),
    fmtPct2(op.ganho_atual),
    String(op.situacao || '').toUpperCase() || '—',
    String(op.data_atual || '—'),
    String(op.hora_atual || '—'),
  ]));

  const name = (scope === 'real' || scope === 'realizadas') ? 'OPERACOES_REALIZADAS' : 'MONITORAMENTO';
  const { data, hora } = nowBRTParts();
  const filename = `AUTOTRADER_SAIDA_${name}_${data.replaceAll('/','-')}_${hora.replaceAll(':','-')}.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  pdfTable(res, `AUTOTRADER-SAIDA - ${name}`, columns, rows);
});

/**
 * POST /api/saida/add
 * body: { par, side, entrada, alvo, alav }
 */
app.post('/api/saida/add', (req, res) => {
  const par = normalizePar(req.body?.par ?? req.query.par);
  const side = normalizeSide(req.body?.side ?? req.query.side);
  const entrada = Number(req.body?.entrada ?? req.query.entrada);
  const alvo = Number(req.body?.alvo ?? req.query.alvo);
  const alav = Number(req.body?.alav ?? req.query.alav);

  if (!par) return res.status(400).json({ ok:false, msg:'Par inválido.' });
  if (!side) return res.status(400).json({ ok:false, msg:'Side inválido.' });
  if (!Number.isFinite(entrada) || entrada <= 0) return res.status(400).json({ ok:false, msg:'Entrada inválida.' });
  if (!Number.isFinite(alvo) || alvo <= 0) return res.status(400).json({ ok:false, msg:'Alvo inválido.' });
  if (!Number.isFinite(alav) || alav <= 0) return res.status(400).json({ ok:false, msg:'Alavancagem inválida.' });

  const active = loadActive();
  const { data, hora } = nowBRTParts();
  const id = `${par}-${Date.now()}`;

  const op = {
    id,
    par,
    side,
    entrada: Number(entrada),
    alvo: Number(alvo),
    alav: Number(alav),
    data_reg: data,
    hora_reg: hora,
    created_ts_utc: new Date().toISOString()
  };

  active.ops = Array.isArray(active.ops) ? active.ops : [];
  active.ops.push(op);
  active.updated_brt = `${data} ${hora}`;
  saveActive(active);

  res.json({ ok:true, id });
});

/**
 * POST /api/saida/sair
 * body: { id }
 * Move de ATIVAS -> REALIZADAS usando o snapshot do MONITOR (se existir).
 */
app.post('/api/saida/sair', (req, res) => {
  const id = String(req.body?.id ?? req.query.id ?? '').trim();
  if (!id) return res.status(400).json({ ok:false, msg:'ID inválido.' });

  const active = loadActive();
  const idx = (active.ops || []).findIndex(o => String(o.id) === id);
  if (idx < 0) return res.status(404).json({ ok:false, msg:'Operação não encontrada.' });

  const monitor = loadMonitor();
  const snap = findOpById(monitor.ops || [], id);
  const base = active.ops[idx];

  // snapshot final com todas colunas do MONITOR, se disponível
  const moved = Object.assign({}, base, snap || {});
  const { data, hora } = nowBRTParts();
  moved.data_sair = data;
  moved.hora_sair = hora;

  // remove de ativas
  active.ops.splice(idx, 1);
  active.updated_brt = `${data} ${hora}`;
  saveActive(active);

  // adiciona em realizadas
  const real = loadReal();
  real.ops = Array.isArray(real.ops) ? real.ops : [];
  real.ops.push(moved);
  real.updated_brt = `${data} ${hora}`;
  saveReal(real);

  res.json({ ok:true });
});

/**
 * POST /api/saida/delete
 * body: { id, scope: 'active'|'real' }
 */
app.post('/api/saida/delete', (req, res) => {
  const id = String(req.body?.id ?? req.query.id ?? '').trim();
  const scope = String(req.body?.scope ?? req.query.scope ?? 'active').toLowerCase();
  if (!id) return res.status(400).json({ ok:false, msg:'ID inválido.' });

  const { data, hora } = nowBRTParts();

  if (scope === 'real') {
    const real = loadReal();
    const before = (real.ops || []).length;
    real.ops = (real.ops || []).filter(o => String(o.id) !== id);
    if (real.ops.length === before) return res.status(404).json({ ok:false, msg:'Operação não encontrada.' });
    real.updated_brt = `${data} ${hora}`;
    saveReal(real);
    return res.json({ ok:true });
  }

  const active = loadActive();
  const before = (active.ops || []).length;
  active.ops = (active.ops || []).filter(o => String(o.id) !== id);
  if (active.ops.length === before) return res.status(404).json({ ok:false, msg:'Operação não encontrada.' });
  active.updated_brt = `${data} ${hora}`;
  saveActive(active);
  return res.json({ ok:true });
});


// Error handler (sempre JSON, evita travar o painel)
app.use((err, req, res, next) => {
  try {
    const code = Number(err && err.status) || 500;
    const msg = (err && err.message) ? String(err.message) : "Internal error";
    return res.status(code).json({ ok:false, error: msg });
  } catch (e) {
    return res.status(500).json({ ok:false, error: "Internal error" });
  }
});

app.listen(PORT, () => {
  console.log(`[SAIDA] server up on :${PORT} | DATA_DIR=${DATA_DIR}`);
});

// Fallback: qualquer rota /api/saida/* não encontrada -> JSON (nunca HTML)
app.use('/api/saida', (req, res) => {
  res.status(404).json({ ok:false, msg:'Rota não encontrada.', path: req.originalUrl });
});

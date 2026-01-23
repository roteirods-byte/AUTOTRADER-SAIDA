#!/usr/bin/env python3
"""AUTOTRADER-SAIDA V2 (worker)
- Lê data/saida_ops.json
- Atualiza data/saida_monitor.json
- FUTUROS USDT (Binance FAPI + Bybit linear)
- Cálculo ALVO + ETA = MESMO motor da ENTRADA (copiado do PRO: calc_target_and_eta)
"""

import os, json, math, re
from datetime import datetime
from zoneinfo import ZoneInfo
from urllib.request import Request, urlopen
from urllib.parse import urlencode

TZ = ZoneInfo("America/Sao_Paulo")

DATA_DIR = os.environ.get("DATA_DIR") or os.path.join(os.path.dirname(__file__), "data")
OPS_PATH = os.path.join(DATA_DIR, "saida_ops.json")
OUT_PATH = os.path.join(DATA_DIR, "saida_monitor.json")

# Regras (mesmas do PRO/ENTRADA)
GAIN_MIN = float(os.environ.get("GAIN_MIN", "3"))

# Universo oficial (77)
UNIVERSE_77 = ['AAVE','ADA','APE','APT','AR','ARB','ATOM','AVAX','AXS','BAT','BCH','BLUR','BNB','BONK','BTC','COMP','CRV','DASH','DENT','DGB','DOGE','DOT','EGLD','SUI','ETC','ETH','FET','FIL','FLOKI','FLOW','S','GALA','GLM','GRT','HBAR','ICP','IMX','INJ','IOST','KAS','KAVA','KSM','LINK','LTC','MANA','POL','SKY','NEAR','NEO','OMG','ONT','OP','ORDI','PEPE','QNT','QTUM','RENDER','ROSE','RUNE','SAND','SEI','SHIB','SNX','SOL','STX','SUSHI','THETA','TIA','TRX','UNI','VET','XEM','XLM','XRP','XVS','ZEC','ZRX']

BINANCE_FAPI = "https://fapi.binance.com"
BYBIT_V5 = "https://api.bybit.com"


def http_json(url: str, timeout=12):
  req = Request(url, headers={"User-Agent": "AUTOTRADER-SAIDA/2.0", "Accept": "application/json"})
  with urlopen(req, timeout=timeout) as r:
    return json.loads(r.read().decode("utf-8", errors="ignore"))


def atomic_write_json(path: str, obj):
  tmp = path + ".tmp"
  with open(tmp, "w", encoding="utf-8") as f:
    json.dump(obj, f, ensure_ascii=False, indent=2)
  os.replace(tmp, path)


def ema(values, period: int):
  if not values or len(values) < period:
    return None
  k = 2.0 / (period + 1.0)
  e = sum(values[:period]) / float(period)
  for v in values[period:]:
    e = v * k + e * (1.0 - k)
  return float(e)


def atr(ohlc, period: int = 14):
  # Wilder ATR
  if not ohlc or len(ohlc) < period + 2:
    return None
  trs = []
  prev_close = ohlc[0][4]
  for i in range(1, len(ohlc)):
    h = ohlc[i][2]; l = ohlc[i][3]; c = ohlc[i][4]
    tr = max(h - l, abs(h - prev_close), abs(l - prev_close))
    trs.append(tr)
    prev_close = c
  a = sum(trs[:period]) / float(period)
  for tr in trs[period:]:
    a = (a * (period - 1) + tr) / float(period)
  return float(a)


def clamp(a, x, b):
  return max(a, min(x, b))


def calc_target_and_eta(side, price, atr_4h, atr_1h, gain_min, e20_1=None, e50_1=None, e20_4=None, e50_4=None):
  # Copiado do PRO (motor da ENTRADA)
  try:
    price = float(price or 0.0)
    atr_4h = float(atr_4h or 0.0)
    atr_1h = float(atr_1h or 0.0)
  except Exception:
    return 0.0, "", 0.0

  if price <= 0 or atr_4h <= 0:
    return 0.0, "", 0.0

  trend_score = 0.0
  try:
    e20_4 = float(e20_4) if e20_4 is not None else None
    e50_4 = float(e50_4) if e50_4 is not None else None
    e20_1 = float(e20_1) if e20_1 is not None else None
    e50_1 = float(e50_1) if e50_1 is not None else None

    if e20_4 and e50_4:
      strength = abs(e20_4 - e50_4) / price
      strength = clamp(0.0, strength * 160.0, 1.0)
      ok4 = ((side=="LONG" and e20_4>e50_4) or (side=="SHORT" and e20_4<e50_4))
      ok1 = False
      if e20_1 and e50_1:
        ok1 = ((side=="LONG" and e20_1>e50_1) or (side=="SHORT" and e20_1<e50_1))
      align = 1.0 if (ok1 and ok4) else (0.6 if ok4 else (0.3 if ok1 else 0.0))
      trend_score = clamp(0.0, 0.65*strength + 0.35*align, 1.0)
  except Exception:
    trend_score = 0.0

  mult = 0.90 + 0.70*trend_score
  try:
    if atr_1h and atr_1h > 0:
      vr = atr_1h / price
      if vr > 0.03:
        mult *= 0.85
  except Exception:
    pass

  dist = atr_4h * mult
  dist_min = price * 0.005
  if dist < dist_min:
    dist = dist_min

  alvo = (price + dist) if side == "LONG" else (price - dist)

  eta = ""
  if atr_1h and atr_1h > 0:
    eta_h = dist / atr_1h
    eta_h *= (1.10 - 0.25*trend_score)
    eta_h = clamp(1.0, eta_h, 96.0)
    eta = f"~{int(round(eta_h))}h" if eta_h < 24 else f"~{int(round(eta_h/24.0))}d"

  return float(alvo), eta, float(trend_score)


def clean_symbol(par: str) -> str:
  p = (par or "").strip().upper().replace("USDT", "").replace("-", "").replace("_", "")
  return f"{p}USDT"


def fetch_binance_klines(par: str, interval: str, limit: int = 200):
  sym = clean_symbol(par)
  url = BINANCE_FAPI + "/fapi/v1/klines?" + urlencode({"symbol": sym, "interval": interval, "limit": limit})
  raw = http_json(url)
  out = []
  if isinstance(raw, list):
    for k in raw:
      try:
        out.append([int(k[0]), float(k[1]), float(k[2]), float(k[3]), float(k[4])])
      except Exception:
        pass
  out.sort(key=lambda x: x[0])
  return out


def fetch_bybit_klines(par: str, interval_min: str, limit: int = 200):
  sym = clean_symbol(par)
  url = BYBIT_V5 + "/v5/market/kline?" + urlencode({"category":"linear", "symbol": sym, "interval": interval_min, "limit": limit})
  raw = http_json(url)
  lst = (((raw.get("result") or {}).get("list")) or [])
  out = []
  if isinstance(lst, list):
    for k in lst:
      try:
        out.append([int(k[0]), float(k[1]), float(k[2]), float(k[3]), float(k[4])])
      except Exception:
        pass
  out.sort(key=lambda x: x[0])
  return out


def fetch_price_now(par: str):
  sym = clean_symbol(par)
  # 1) Binance FAPI ticker
  try:
    url = BINANCE_FAPI + "/fapi/v1/ticker/price?" + urlencode({"symbol": sym})
    d = http_json(url)
    p = float(d.get("price"))
    if p > 0:
      return p
  except Exception:
    pass

  # 2) Bybit ticker
  try:
    url = BYBIT_V5 + "/v5/market/tickers?" + urlencode({"category":"linear", "symbol": sym})
    d = http_json(url)
    lst = ((d.get("result") or {}).get("list")) or []
    if lst:
      p = float(lst[0].get("lastPrice"))
      if p > 0:
        return p
  except Exception:
    pass

  return None


def pnl_pct(side: str, entrada: float, atual: float, alav: float):
  # ROE% simples (sem taxas) — igual prática do painel
  if entrada <= 0 or atual <= 0 or alav <= 0:
    return 0.0
  if side == "LONG":
    raw = (atual / entrada - 1.0)
  else:
    raw = (entrada / atual - 1.0)
  return float(raw * 100.0 * alav)


def main():
  os.makedirs(DATA_DIR, exist_ok=True)

  try:
    db = json.load(open(OPS_PATH, "r", encoding="utf-8"))
  except Exception:
    db = {"ops": []}

  ops_in = db.get("ops") if isinstance(db, dict) else []
  ops_in = ops_in if isinstance(ops_in, list) else []

  now = datetime.now(TZ)
  updated_brt = now.strftime("%Y-%m-%d %H:%M")
  data = now.strftime("%Y-%m-%d")
  hora = now.strftime("%H:%M")

  out_ops = []

  for o in ops_in:
    try:
      _id = str(o.get("id") or "").strip()
      par = str(o.get("par") or "").strip().upper()
      side = str(o.get("side") or "").strip().upper()
      entrada = float(o.get("entrada") or 0.0)
      alav = float(o.get("alav") or 0.0)

      if not _id or par not in UNIVERSE_77 or side not in ("LONG","SHORT") or entrada <= 0 or alav <= 0:
        continue

      # preço atual
      atual = fetch_price_now(par)
      if atual is None:
        # fallback: último close do Binance 1h
        k = fetch_binance_klines(par, "1h", 2)
        atual = float(k[-1][4]) if k else 0.0

      # candles 1H/4H (prioriza Binance FAPI; fallback Bybit)
      k1 = fetch_binance_klines(par, "1h", 220)
      if len(k1) < 60:
        k1 = fetch_bybit_klines(par, "60", 220)

      k4 = fetch_binance_klines(par, "4h", 220)
      if len(k4) < 60:
        k4 = fetch_bybit_klines(par, "240", 220)

      closes_1 = [x[4] for x in k1] if k1 else []
      closes_4 = [x[4] for x in k4] if k4 else []

      atr_1h = atr(k1, 14) or 0.0
      atr_4h = atr(k4, 14) or 0.0

      e20_1 = ema(closes_1, 20)
      e50_1 = ema(closes_1, 50)
      e20_4 = ema(closes_4, 20)
      e50_4 = ema(closes_4, 50)

      alvo, eta, trend_score = calc_target_and_eta(side, entrada, atr_4h, atr_1h, GAIN_MIN, e20_1, e50_1, e20_4, e50_4)

      pnl = pnl_pct(side, entrada, float(atual or 0.0), alav)

      situacao = "EM ANDAMENTO"
      atingiu = (side=="LONG" and atual >= alvo and alvo>0) or (side=="SHORT" and atual <= alvo and alvo>0)
      if atingiu:
        # regra base: SAIR. Se tendência muito forte, sugere MANTER.
        if trend_score >= 0.75:
          situacao = "ALVO ATINGIDO — MANTER"
        else:
          situacao = "ALVO ATINGIDO — SAIR"

      out_ops.append({
        "id": _id,
        "par": par,
        "side": side,
        "entrada": round(entrada, 6),
        "atual": round(float(atual or 0.0), 6),
        "alvo": round(float(alvo or 0.0), 6),
        "pnl_pct": round(float(pnl), 2),
        "eta": eta,
        "situacao": situacao,
        "data": data,
        "hora": hora,
        "alav": int(alav) if float(alav).is_integer() else alav
      })

    except Exception as e:
      # NUNCA quebre o painel: loga e cria linha de fallback
      try:
        logp = os.path.join(DATA_DIR, "saida_worker_err.log")
        with open(logp, "a", encoding="utf-8") as f:
          f.write("\n=== %sZ | %s | %s ===\n" % (datetime.utcnow().isoformat(), str(_id), str(par)))
          f.write(traceback.format_exc())
      except Exception:
        pass

      try:
        side_f = str(o.get("side") or "").upper().strip()
        entrada_f = float(o.get("entrada") or 0.0)
        alav_f = o.get("alav")
      except Exception:
        side_f, entrada_f, alav_f = "", 0.0, 1

      out_ops.append({
        "id": _id,
        "par": par,
        "side": side_f,
        "entrada": round(entrada_f, 6),
        "atual": 0.0,
        "alvo": 0.0,
        "pnl_pct": 0.0,
        "eta": "--",
        "situacao": "ERRO — ver log",
        "data": data,
        "hora": hora,
        "alav": alav_f
      })
      continue

  atomic_write_json(OUT_PATH, {"updated_brt": updated_brt, "ops": out_ops})


if __name__ == "__main__":
  main()

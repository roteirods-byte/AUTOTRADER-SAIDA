#!/usr/bin/env python3
import json, os, time
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")

P_OPS = os.path.join(DATA_DIR, "saida_ops.json")
P_MON = os.path.join(DATA_DIR, "saida_monitor.json")
P_ERR = os.path.join(DATA_DIR, "saida_worker_err.log")

os.makedirs(DATA_DIR, exist_ok=True)

# BRT fixo (sem depender do sistema)
# Brasil (SP): UTC-3
def brt_now():
    return datetime.utcnow().timestamp() - 3 * 3600

def brt_dt():
    return datetime.utcfromtimestamp(brt_now())

def http_json(url: str, timeout=10):
    req = Request(url, headers={
        "User-Agent": "Mozilla/5.0",
        "Accept": "application/json"
    })
    with urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8", errors="ignore"))

def log_err(op_id: str, e: Exception):
    try:
        ts = datetime.utcnow().isoformat()
        with open(P_ERR, "a", encoding="utf-8") as f:
            f.write(f"\n=== {ts} | {op_id} ===\n{repr(e)}\n")
    except:
        pass

def safe_read_json(p, fallback):
    try:
        if not os.path.exists(p):
            return fallback
        s = open(p, "r", encoding="utf-8").read().strip()
        if not s:
            return fallback
        return json.loads(s)
    except:
        return fallback

def safe_write_json(p, obj):
    tmp = p + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, p)

def num(v):
    try:
        return float(v)
    except:
        return 0.0

def up(v):
    return str(v or "").strip().upper()

# --- PREÇO ATUAL: OKX (prioridade) / Binance (fallback) ---
def fetch_okx_last(inst_id: str) -> float:
    url = f"https://www.okx.com/api/v5/market/ticker?instId={inst_id}"
    d = http_json(url, timeout=10)
    data = d.get("data") or []
    if not data:
        return 0.0
    return num(data[0].get("last"))

def fetch_binance_last(symbol: str) -> float:
    url = f"https://api.binance.com/api/v3/ticker/price?symbol={symbol}"
    d = http_json(url, timeout=10)
    return num(d.get("price"))

def fetch_price(par: str) -> float:
    P = up(par)
    # OKX SWAP
    try:
        px = fetch_okx_last(f"{P}-USDT-SWAP")
        if px > 0:
            return px
    except Exception:
        pass
    # OKX SPOT
    try:
        px = fetch_okx_last(f"{P}-USDT")
        if px > 0:
            return px
    except Exception:
        pass
    # Binance SPOT
    try:
        px = fetch_binance_last(f"{P}USDT")
        if px > 0:
            return px
    except Exception:
        pass
    return 0.0

def ganho_pct(side: str, entrada: float, x: float, alav: float) -> float:
    # retorno em % já com alavancagem
    if entrada <= 0 or x <= 0 or alav <= 0:
        return 0.0
    if side == "LONG":
        return ((x / entrada) - 1.0) * 100.0 * alav
    else:
        # SHORT
        return ((entrada / x) - 1.0) * 100.0 * alav

def situacao(side: str, atual: float, alvo: float) -> str:
    if atual <= 0 or alvo <= 0:
        return "ERRO — sem preço"
    if side == "LONG" and atual >= alvo:
        return "ALVO ATINGIDO"
    if side == "SHORT" and atual <= alvo:
        return "ALVO ATINGIDO"
    return "EM ANDAMENTO"

def main():
    ops_doc = safe_read_json(P_OPS, {"ops": []})
    ops = ops_doc.get("ops") if isinstance(ops_doc, dict) else []
    if not isinstance(ops, list):
        ops = []

    dt = brt_dt()
    data = dt.strftime("%Y-%m-%d")
    hora = dt.strftime("%H:%M")
    updated_brt = dt.strftime("%Y-%m-%d %H:%M")

    out_ops = []

    for op in ops:
        try:
            op_id = str(op.get("id") or "")
            par = up(op.get("par"))
            side = up(op.get("side"))
            entrada = num(op.get("entrada"))
            alvo = num(op.get("alvo"))
            alav = num(op.get("alav"))

            px = fetch_price(par)
            ga = ganho_pct(side, entrada, alvo, alav) if alvo > 0 else 0.0
            gu = ganho_pct(side, entrada, px, alav) if px > 0 else 0.0

            out_ops.append({
                "id": op_id,
                "par": par,
                "side": side,
                "entrada": entrada,
                "alvo": alvo,
                "alav": int(alav) if alav > 0 else 1,
                "atual": px,
                "ganho_alvo_pct": ga,
                "ganho_atual_pct": gu,
                "situacao": situacao(side, px, alvo),
                "data": data,
                "hora": hora
            })
        except Exception as e:
            log_err(op.get("id","?"), e)
            out_ops.append({
                "id": str(op.get("id") or ""),
                "par": up(op.get("par")),
                "side": up(op.get("side")),
                "entrada": num(op.get("entrada")),
                "alvo": num(op.get("alvo")),
                "alav": int(num(op.get("alav")) or 1),
                "atual": 0.0,
                "ganho_alvo_pct": 0.0,
                "ganho_atual_pct": 0.0,
                "situacao": "ERRO — ver log",
                "data": data,
                "hora": hora
            })

    payload = {"updated_brt": updated_brt, "ops": out_ops}
    safe_write_json(P_MON, payload)

if __name__ == "__main__":
    main()

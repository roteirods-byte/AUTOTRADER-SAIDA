#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os, json, math
from datetime import datetime
from zoneinfo import ZoneInfo
import requests

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
OPS_ACTIVE_FILE = os.path.join(DATA_DIR, "ops_active.json")
MONITOR_FILE    = os.path.join(DATA_DIR, "monitor.json")

TIMEOUT = float(os.environ.get("HTTP_TIMEOUT", "8"))

def brt_now_parts():
    now = datetime.now(ZoneInfo("America/Sao_Paulo"))
    return now.strftime("%d/%m/%Y"), now.strftime("%H:%M"), now.strftime("%Y-%m-%d %H:%M")

def safe_read_json(path, fallback):
    try:
        if not os.path.exists(path):
            return fallback
        s = open(path, "r", encoding="utf-8").read().strip()
        if not s:
            return fallback
        return json.loads(s)
    except Exception:
        return fallback

def safe_write_json(path, obj):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)
    os.replace(tmp, path)

def bitget_price(par: str):
    # Bitget: USDT-FUTURES, símbolo tipo ATOMUSDT
    try:
        url = "https://api.bitget.com/api/v2/mix/market/symbol-price"
        r = requests.get(url, params={"productType":"USDT-FUTURES","symbol":f"{par}USDT"}, timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        j = r.json()
        data = j.get("data") or []
        if not data:
            return None
        return float(data[0].get("price"))
    except Exception:
        return None

def okx_price(par: str):
    # OKX: SWAP perpétuo USDT, instId tipo ATOM-USDT-SWAP
    try:
        url = "https://www.okx.com/api/v5/market/ticker"
        r = requests.get(url, params={"instId":f"{par}-USDT-SWAP"}, timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        j = r.json()
        data = j.get("data") or []
        if not data:
            return None
        return float(data[0].get("last"))
    except Exception:
        return None

def gain_percent(side: str, entrada: float, price: float):
    if not entrada or entrada <= 0 or not price or price <= 0:
        return None
    if side == "SHORT":
        return (entrada / price - 1.0) * 100.0
    return (price / entrada - 1.0) * 100.0

def fmt_pct(v):
    if v is None or not math.isfinite(v):
        return None
    return round(v, 2)

def fmt_price(v):
    if v is None or not math.isfinite(v):
        return None
    return round(v, 3)

def main():
    os.makedirs(DATA_DIR, exist_ok=True)

    active = safe_read_json(OPS_ACTIVE_FILE, {"ops": []})
    ops = active.get("ops") or []

    data_atual, hora_atual, updated_brt = brt_now_parts()

    out_ops = []
    for op in ops:
        par = str(op.get("par","")).upper().strip()
        side = str(op.get("side","")).upper().strip()
        entrada = float(op.get("entrada") or 0)
        alvo = float(op.get("alvo") or 0)

        # 2 corretoras: tenta Bitget, se falhar usa OKX
        atual = bitget_price(par)
        if atual is None:
            atual = okx_price(par)

        g_alvo = gain_percent(side, entrada, alvo) if alvo else None
        g_atual = gain_percent(side, entrada, atual) if atual else None

        situacao = "EM ANDAMENTO"
        if g_atual is not None and g_alvo is not None and g_atual >= g_alvo:
            situacao = "ALVO ATINGIDO"

        out = dict(op)
        out["data_atual"]  = data_atual
        out["hora_atual"]  = hora_atual
        out["atual"]       = fmt_price(atual)
        out["ganho_alvo"]  = fmt_pct(g_alvo)
        out["ganho_atual"] = fmt_pct(g_atual)
        out["situacao"]    = situacao
        out_ops.append(out)

    safe_write_json(MONITOR_FILE, {
        "updated_brt": updated_brt,
        "worker_build": os.environ.get("WORKER_BUILD","rebuild_avp_v1"),
        "worker_src": os.path.basename(__file__),
        "ops": out_ops
    })

if __name__ == "__main__":
    main()

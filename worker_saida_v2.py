#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
AUTOTRADER-SAIDA — Worker de monitoramento (SAÍDA V2)

- Lê data/ops_active.json (operações ativas)
- Busca preço atual (Binance Spot como fallback)
- Calcula GANHO/ALVO e GANHO ATUAL
- Escreve data/monitor.json (consumido pelo painel)

Observação: se você já tem um worker mais avançado (2 corretoras etc.),
mantenha a mesma saída/colunas e substitua apenas a parte de preço.
"""

import os, json, math
from datetime import datetime
import requests

DATA_DIR = os.environ.get("DATA_DIR", os.path.join(os.path.dirname(__file__), "data"))
OPS_ACTIVE_FILE = os.path.join(DATA_DIR, "ops_active.json")
MONITOR_FILE = os.path.join(DATA_DIR, "monitor.json")

BINANCE_BASE = os.environ.get("BINANCE_BASE", "https://api.binance.com")
TIMEOUT = float(os.environ.get("HTTP_TIMEOUT", "6"))

def brt_now_parts():
    # Se a VM já está em BRT, fica perfeito.
    now = datetime.now()
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

def binance_price(symbol: str):
    try:
        url = f"{BINANCE_BASE}/api/v3/ticker/price"
        r = requests.get(url, params={"symbol": symbol}, timeout=TIMEOUT)
        if r.status_code != 200:
            return None
        j = r.json()
        return float(j.get("price"))
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

        symbol = f"{par}USDT"
        atual = binance_price(symbol)

        g_alvo = gain_percent(side, entrada, alvo) if alvo else None
        g_atual = gain_percent(side, entrada, atual) if atual else None

        situacao = "EM ANDAMENTO"
        if g_atual is not None and g_alvo is not None and g_atual >= g_alvo:
            situacao = "ALVO ATINGIDO"

        out = dict(op)
        out["data_atual"] = data_atual
        out["hora_atual"] = hora_atual
        out["atual"] = fmt_price(atual)
        out["ganho_alvo"] = fmt_pct(g_alvo)
        out["ganho_atual"] = fmt_pct(g_atual)
        out["situacao"] = situacao
        out_ops.append(out)

    safe_write_json(MONITOR_FILE, {
        "updated_brt": updated_brt,
        "worker_build": os.environ.get("WORKER_BUILD","rebuild_avp_v1"),
        "worker_src": os.path.basename(__file__),
        "ops": out_ops
    })

if __name__ == "__main__":
    main()

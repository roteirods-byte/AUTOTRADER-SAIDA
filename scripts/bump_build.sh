#!/usr/bin/env bash
set -euo pipefail
# Atualiza o arquivo VERSION (Build ID) de forma simples.
# Formato: YYYY-MM-DD_HHMMSSUTC (UTC)
cd "$(dirname "$0")/.."
echo "$(date -u +%Y-%m-%d_%H%M%SUTC)" > VERSION
echo "OK: VERSION=$(cat VERSION)"

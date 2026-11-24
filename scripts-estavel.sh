#!/bin/sh
# Gera a versão estável (porta 5180) a partir de uma tag: sh scripts-estavel.sh v0.6.0
set -e
TAG="${1:?informe a tag, por exemplo v0.6.0}"
ROOT="$(cd "$(dirname "$0")" && pwd)"
TMP="$(mktemp -d)"
git -C "$ROOT" archive "$TAG" | tar -x -C "$TMP"
ln -s "$ROOT/node_modules" "$TMP/node_modules"
(cd "$TMP" && npx vite build --outDir "$ROOT/.estavel" --emptyOutDir)
echo "$TAG" > "$ROOT/.estavel/VERSAO"
rm -rf "$TMP"
echo "Versão estável agora é $TAG. Recarregue http://localhost:5180"

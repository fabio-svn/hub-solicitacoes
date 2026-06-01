#!/usr/bin/env bash
# gerar-pack.sh — monta um arquivo único com o código-fonte do projeto, p/ revisão.
#
# Uso: rodar na RAIZ do repositório (onde fica a pasta artifacts/):
#     bash gerar-pack.sh
# Saída: projeto-hub.md  (no mesmo formato do pack anterior)
#
# Segurança: NUNCA inclui .env nem arquivos de credenciais/chaves.

set -uo pipefail

OUT="projeto-hub.md"

# Extensões que entram no pack (código e config legíveis)
EXTS="ts tsx js jsx mjs cjs html css json toml yaml yml sql sh md webmanifest"

: > "$OUT"

# Varre arquivos, podando pastas pesadas/irrelevantes, ordenado por caminho
find . \
  \( -path '*/node_modules/*' -o -path '*/.git/*' -o -path '*/dist/*' \
     -o -path '*/build/*' -o -path '*/.next/*' -o -path '*/coverage/*' \
     -o -path '*/.cache/*' -o -path '*/.turbo/*' -o -path '*/.vercel/*' \) -prune -o \
  -type f -print0 \
| sort -z \
| while IFS= read -r -d '' f; do
    rel="${f#./}"
    base="$(basename "$f")"
    ext="${f##*.}"

    # nunca incluir: o próprio output, segredos, locks, minificados, mapas
    case "$base" in
      "$OUT")                                   continue ;;
      .env|.env.*)                              continue ;;   # segredos — NUNCA
      *secret*|*credential*|*.pem|*.key|*.p12)  continue ;;
      package-lock.json|pnpm-lock.yaml|yarn.lock) continue ;;
      *.min.js|*.min.css|*.map)                 continue ;;
    esac

    # só as extensões da lista
    keep=0
    for e in $EXTS; do [ "$ext" = "$e" ] && { keep=1; break; }; done
    [ "$keep" -eq 1 ] || continue

    # linguagem para o bloco de código
    case "$ext" in
      ts|tsx)         lang=ts ;;
      js|jsx|mjs|cjs) lang=js ;;
      yml)            lang=yaml ;;
      *)              lang="$ext" ;;
    esac

    {
      printf '## File: %s\n' "$rel"
      printf '```%s\n' "$lang"
      cat "$f"
      printf '\n```\n\n'
    } >> "$OUT"
  done

linhas=$(wc -l < "$OUT" 2>/dev/null || echo "?")
tam=$(du -h "$OUT" 2>/dev/null | cut -f1 || echo "?")
arqs=$(grep -c '^## File:' "$OUT" 2>/dev/null || echo "?")
echo "OK -> $OUT  ($arqs arquivos, $linhas linhas, $tam)"

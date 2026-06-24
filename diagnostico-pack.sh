#!/bin/bash
# Diagnóstico SOMENTE-LEITURA do que o gerar-pack captura vs ignora.
# Rode na raiz do projeto:  bash diagnostico-pack.sh
# Não altera nada — só lista. Mande a saída inteira de volta.

ROOTS=("artifacts/api-server" "lib")

# Mesmos filtros de PASTA do gerar-pack (ruído/binário)
PRUNE=( -path "*/node_modules/*" -o -path "*/.git/*" -o -path "*/.local/*" \
  -o -path "*/.agents/*" -o -path "*/attached_assets/*" -o -path "*/dist/*" \
  -o -path "*/build/*" -o -path "*/.next/*" -o -path "*/.cache/*" \
  -o -path "*/.turbo/*" -o -path "*/coverage/*" -o -path "*/.replit_cache/*" \
  -o -path "*/uploads/*" -o -path "*/tmp/*" -o -path "*/assets/fonts/*" )

echo "================ DIAGNÓSTICO GERAR-PACK ================"

echo
echo "===== A) Extensões presentes nos ROOTS (após excluir pastas-ruído) ====="
echo "      (qualquer extensão aqui que NÃO esteja na lista do gerar-pack é conteúdo que o pack ignora)"
find "${ROOTS[@]}" -type f ! \( "${PRUNE[@]}" \) -printf '%f\n' 2>/dev/null \
  | sed -E 's/.*(\.[^.]+)$/\1/; t; s/.*/(sem extensão)/' | sort | uniq -c | sort -rn

echo
echo "===== B) 30 MAIORES arquivos que HOJE entram no pack (por tamanho) ====="
echo "      (procurar JSON gerado, dumps, ou qualquer coisa grande que infle o pack)"
find "${ROOTS[@]}" -type f ! \( "${PRUNE[@]}" \) \
  \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" \
     -o -name "*.cjs" -o -name "*.html" -o -name "*.css" -o -name "*.json" -o -name "*.md" \
     -o -name "*.sql" -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml" \
     -o -name ".env.example" -o -name "Dockerfile" -o -name "*.dockerfile" -o -name "*.sh" \) \
  ! -name "*.min.js" ! -name "*.min.css" \
  -printf '%s\t%p\n' 2>/dev/null | sort -rn | head -30 \
  | awk -F'\t' '{printf "  %8.1f KB  %s\n", $1/1024, $2}'

echo
echo "===== C) Gerado/vendor que entra no pack (generated/, vendor/, *.min.*) ====="
echo "      (código gerado por ferramenta ou lib de terceiros — candidato a excluir)"
find "${ROOTS[@]}" -type f ! -path "*/node_modules/*" ! -path "*/dist/*" \
  \( -path "*/generated/*" -o -path "*/vendor/*" -o -name "*.min.*" \) \
  -printf '%s\t%p\n' 2>/dev/null | sort -rn \
  | awk -F'\t' '{printf "  %8.1f KB  %s\n", $1/1024, $2}'
[ -z "$(find "${ROOTS[@]}" -type f ! -path '*/node_modules/*' ! -path '*/dist/*' \( -path '*/generated/*' -o -path '*/vendor/*' -o -name '*.min.*' \) -print -quit 2>/dev/null)" ] && echo "  (nenhum)"

echo
echo "===== D) Workspaces existentes (confirma se algo fora dos ROOTS faria sentido empacotar) ====="
find . -maxdepth 3 -name "package.json" ! -path "*/node_modules/*" -printf '%p\n' 2>/dev/null | sort

echo
echo "======================= FIM ======================="

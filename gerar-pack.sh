#!/bin/bash
# Gera um pack único do projeto Hub SVN em markdown.
# Roda na raiz do projeto. Saída: projeto-hub.md no mesmo diretório.
# Inclui o app (artifacts/api-server) E os pacotes compartilhados (lib/*: db schema, zod).
OUTPUT="projeto-hub.md"
ROOTS=("artifacts/api-server" "lib")   # <- agora pega o schema do banco e os validadores
# Pastas/padrões a EXCLUIR (cada um contém ruído ou binários grandes)
EXCLUDES=(
  -path "*/node_modules/*"
  -o -path "*/.git/*"
  -o -path "*/.local/*"
  -o -path "*/.agents/*"
  -o -path "*/attached_assets/*"
  -o -path "*/dist/*"
  -o -path "*/build/*"
  -o -path "*/.next/*"
  -o -path "*/.cache/*"
  -o -path "*/.turbo/*"
  -o -path "*/coverage/*"
  -o -path "*/.replit_cache/*"
  -o -path "*/uploads/*"
  -o -path "*/tmp/*"
  -o -path "*/assets/fonts/*"
  -o -name "package-lock.json"
  -o -name "yarn.lock"
  -o -name "pnpm-lock.yaml"
  -o -name "*.log"
  -o -name "*.lock"
  -o -name ".DS_Store"
)
# Extensões a INCLUIR
INCLUDES=(
  -name "*.ts" -o -name "*.tsx"
  -o -name "*.js" -o -name "*.jsx" -o -name "*.mjs" -o -name "*.cjs"
  -o -name "*.html" -o -name "*.css"
  -o -name "*.json"
  -o -name "*.md"
  -o -name "*.sql"
  -o -name "*.toml" -o -name "*.yaml" -o -name "*.yml"
  -o -name ".env.example"
  -o -name "Dockerfile" -o -name "*.dockerfile"
  -o -name "*.sh"
)
# Limpa output anterior
> "$OUTPUT"
# Cabeçalho do pack
{
  echo "# Pack do Projeto Hub SVN"
  echo ""
  echo "Gerado em: $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "Roots: ${ROOTS[*]}"
  echo ""
  echo "---"
  echo ""
} >> "$OUTPUT"
# Pega cada arquivo e concatena com header
find "${ROOTS[@]}" -type f \
  ! \( "${EXCLUDES[@]}" \) \
  \( "${INCLUDES[@]}" \) \
  -print0 2>/dev/null | sort -z | while IFS= read -r -d '' file; do
  REL="${file#./}"
  SIZE=$(wc -c < "$file" 2>/dev/null || echo 0)
  # Pula arquivos maiores que 500KB (provavelmente binário ou minificado)
  if [ "$SIZE" -gt 512000 ]; then
    echo "Pulando $REL (muito grande: $((SIZE/1024)) KB)" >&2
    continue
  fi
  # Pula arquivos vazios
  if [ "$SIZE" -lt 1 ]; then
    continue
  fi
  {
    echo ""
    echo "## File: $REL"
    echo ""
    echo "\`\`\`"
    cat "$file"
    echo ""
    echo "\`\`\`"
    echo ""
  } >> "$OUTPUT"
done
# Log de saída
FINAL_SIZE=$(wc -c < "$OUTPUT")
echo ""
echo "Pack gerado: $OUTPUT"
echo "Tamanho final: $((FINAL_SIZE / 1024)) KB"
echo ""
#!/usr/bin/env bash
#
# Limpeza dos artefatos de desenvolvimento do Hub:
#   - patches Python (*.py na raiz do workspace)
#   - backups .bak-* que os patches criaram ao lado dos arquivos
#
# Seguro por padrao: faz DRY-RUN (so lista). Para apagar de verdade: --apply
# Antes de apagar, junta tudo num .tar.gz — se precisar de algo depois, esta la.
#
# Uso, a partir de ~/workspace:
#   bash limpar-patches.sh            # lista o que seria removido
#   bash limpar-patches.sh --apply    # arquiva e remove
#
set -euo pipefail
APLICAR=false
[[ "${1:-}" == "--apply" ]] && APLICAR=true

echo "=== Limpeza de artefatos de desenvolvimento ==="
echo

# 1) PATCHES .py na raiz (nao mexe em .py de dentro de src/, que sao codigo real)
echo "── Patches Python na raiz do workspace ──"
mapfile -t PYS < <(find . -maxdepth 1 -name "*.py" -type f 2>/dev/null | sort)
if [[ ${#PYS[@]} -eq 0 ]]; then
  echo "  (nenhum)"
else
  printf '  %s\n' "${PYS[@]#./}"
  echo "  -> ${#PYS[@]} arquivo(s)"
fi
echo

# 2) BACKUPS .bak-* em qualquer lugar do projeto
echo "── Backups .bak-* criados pelos patches ──"
mapfile -t BAKS < <(find . -type f -name "*.bak-*" 2>/dev/null | sort)
if [[ ${#BAKS[@]} -eq 0 ]]; then
  echo "  (nenhum)"
else
  printf '  %s\n' "${BAKS[@]#./}"
  echo "  -> ${#BAKS[@]} arquivo(s)"
fi
echo

# tambem os .bak "puros" e .bak-* antigos (ex.: .bak, .bak-live)
mapfile -t BAKS2 < <(find . -type f \( -name "*.bak" -o -name "*.orig" \) 2>/dev/null | sort)
if [[ ${#BAKS2[@]} -gt 0 ]]; then
  echo "── Outros backups (.bak / .orig) ──"
  printf '  %s\n' "${BAKS2[@]#./}"
  echo "  -> ${#BAKS2[@]} arquivo(s)"
  echo
fi

TOTAL=$(( ${#PYS[@]} + ${#BAKS[@]} + ${#BAKS2[@]} ))
if [[ $TOTAL -eq 0 ]]; then
  echo "Nada a limpar."
  exit 0
fi

if ! $APLICAR; then
  echo "═══════════════════════════════════════════════"
  echo "SIMULACAO — nada foi removido. ($TOTAL arquivo(s))"
  echo "Para arquivar e apagar:  bash limpar-patches.sh --apply"
  exit 0
fi

# --- aplicando: arquiva tudo antes de remover ---
STAMP=$(date +%Y%m%d-%H%M%S)
ARQ="_limpeza-patches-$STAMP.tar.gz"
echo "Arquivando em $ARQ ..."
printf '%s\0' "${PYS[@]}" "${BAKS[@]}" "${BAKS2[@]}" | tar --null -czf "$ARQ" --files-from=- 2>/dev/null
echo "  ok ($(du -h "$ARQ" | cut -f1))"
echo

echo "Removendo..."
for f in "${PYS[@]}" "${BAKS[@]}" "${BAKS2[@]}"; do
  rm -f "$f"
done
echo "  $TOTAL arquivo(s) removido(s)."
echo
echo "Backup em: $ARQ  (apague quando tiver certeza; ou 'tar tzf $ARQ' para inspecionar)"

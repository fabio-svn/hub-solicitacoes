#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# fix-utils-missing.sh — adiciona utils.js antes de shell.js em
# páginas que perderam o include depois do Prompt 12 (remoção de _esc)
# Causa do bug: shell.js agora chama window.esc() do utils.js
# ─────────────────────────────────────────────────────────────────

set -e
cd artifacts/api-server/public

python3 << 'PYEOF'
import os, sys

files = [
  'capital-humano.html',
  'form-ch-aniversariantes.html',
  'form-ch-atualizacao-books.html',
  'form-ch-atualizacao-pessoas.html',
  'form-ch-kit-onboarding.html',
  'form-ch-linha-do-tempo.html',
  'solicitacoes.html',
]

fixed = 0
for fname in files:
    if not os.path.exists(fname):
        print(f"⚠ {fname}: arquivo não encontrado")
        continue
    
    with open(fname) as f:
        c = f.read()
    
    if 'src="utils.js' in c:
        print(f"• {fname}: utils.js já presente, pulando")
        continue
    
    # Tenta com cache busting primeiro
    shell_with_v = '<script src="shell.js?v=20260602"></script>'
    shell_no_v = '<script src="shell.js"></script>'
    
    if shell_with_v in c:
        new_c = c.replace(
            shell_with_v,
            '<script src="utils.js?v=20260602"></script>\n  ' + shell_with_v,
            1  # só a primeira ocorrência
        )
        with open(fname, 'w') as f:
            f.write(new_c)
        print(f"✓ {fname}: utils.js?v=20260602 adicionado")
        fixed += 1
    elif shell_no_v in c:
        new_c = c.replace(
            shell_no_v,
            '<script src="utils.js"></script>\n  ' + shell_no_v,
            1
        )
        with open(fname, 'w') as f:
            f.write(new_c)
        print(f"✓ {fname}: utils.js adicionado (sem versionamento)")
        fixed += 1
    else:
        print(f"✗ {fname}: padrão de shell.js não encontrado — verificar manualmente")

print(f"\n📊 Resultado: {fixed}/{len(files)} arquivos corrigidos")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "Verificação"
echo "═══════════════════════════════════════════════════"
for f in capital-humano.html form-ch-aniversariantes.html form-ch-atualizacao-books.html form-ch-atualizacao-pessoas.html form-ch-kit-onboarding.html form-ch-linha-do-tempo.html solicitacoes.html; do
  if grep -q 'src="utils.js' "$f" 2>/dev/null; then
    echo "  ✓ $f"
  else
    echo "  ✗ $f — utils.js ainda ausente!"
  fi
done

echo ""
echo "✅ Fix aplicado. Recarrega as páginas (Ctrl+Shift+R) e o bug deve sumir."

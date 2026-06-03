#!/bin/bash
# fix-auth-helpers.sh — adiciona helpers auth simples e migra checks verbose
# Substitui: typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin()
# Por:       isCurrentUserAdmin()

set -e
cd artifacts/api-server/public

python3 << 'PYEOF'
import os, re

# ─── Passo 1: Adicionar helpers em auth.js ───
auth_path = 'auth.js'
with open(auth_path) as f: ac = f.read()

helpers = """
// === Helpers globais — uso recomendado em vez de checks verbose ===
// Esses helpers fazem o check 'typeof Auth' internamente, então são
// seguros em qualquer página, mesmo onde auth.js carregou parcial.
window.isCurrentUserAuthed = function() {
  return typeof Auth !== 'undefined' && Auth.isAuthenticated && Auth.isAuthenticated();
};
window.isCurrentUserAdmin = function() {
  return typeof Auth !== 'undefined' && Auth.isAdmin && Auth.isAdmin();
};
window.isCurrentUserStaff = function() {
  return typeof Auth !== 'undefined' && Auth.isStaff && Auth.isStaff();
};
"""

if 'window.isCurrentUserAdmin' in ac:
    print("• auth.js: helpers já presentes, pulando")
else:
    # Adiciona helpers no FIM do arquivo
    ac = ac.rstrip() + '\n' + helpers + '\n'
    with open(auth_path, 'w') as f: f.write(ac)
    print("✓ auth.js: 3 helpers adicionados (isCurrentUserAuthed, isCurrentUserAdmin, isCurrentUserStaff)")

# ─── Passo 2: Migrar checks verbose nos HTMLs ───
patterns = [
    # isAdmin
    (
        r"typeof Auth !== ['\"]undefined['\"] && Auth\.isAdmin && Auth\.isAdmin\(\)",
        "isCurrentUserAdmin()"
    ),
    # isStaff
    (
        r"typeof Auth !== ['\"]undefined['\"] && Auth\.isStaff && Auth\.isStaff\(\)",
        "isCurrentUserStaff()"
    ),
]

# Lista de arquivos a processar
html_files = [f for f in os.listdir('.') if f.endswith('.html')]
total_replacements = 0

for html_file in html_files:
    with open(html_file) as f: hc = f.read()
    original = hc
    
    for pat, repl in patterns:
        new_hc, n = re.subn(pat, repl, hc)
        if n > 0:
            hc = new_hc
            total_replacements += n
    
    if hc != original:
        with open(html_file, 'w') as f: f.write(hc)
        replacements_in_file = sum(len(re.findall(p, original)) for p, _ in patterns)
        print(f"✓ {html_file}: {replacements_in_file} substituições")

# Também processar shell.js, config.js, etc se aplicável
js_files = ['shell.js', 'config.js']
for js_file in js_files:
    if not os.path.exists(js_file): continue
    with open(js_file) as f: jc = f.read()
    original = jc
    for pat, repl in patterns:
        new_jc, n = re.subn(pat, repl, jc)
        if n > 0:
            jc = new_jc
            total_replacements += n
    if jc != original:
        with open(js_file, 'w') as f: f.write(jc)
        print(f"✓ {js_file}")

print(f"\n📊 Total: {total_replacements} substituições")
PYEOF

echo ""
echo "─── Verificação ───"
echo "→ Restantes verbose (esperado 0 ou poucos casos legítimos):"
grep -c "typeof Auth !== 'undefined' && Auth\.isAdmin && Auth\.isAdmin()" *.html *.js 2>/dev/null | grep -v ':0$' || echo "  ✓ tudo migrado"
echo ""
echo "→ Novos helpers usados:"
grep -c "isCurrentUserAdmin()" *.html *.js 2>/dev/null | grep -v ':0$'

echo ""
echo "✅ Helpers aplicados. Hard refresh nas páginas pra confirmar que tudo funciona."

#!/bin/bash
# fix-dead-code.sh — remove código morto dos arquivos admin-templates
# 1. Completa a remoção do live toggle (script anterior falhou por indentação)
# 2. Remove 3 funções declaradas mas nunca chamadas
# 3. Remove regras CSS .live-toggle

set -e
cd artifacts/api-server/public

python3 << 'PYEOF'
import re

# ──────────────────────────────────────────────────
# JS — admin-templates.js
# ──────────────────────────────────────────────────
path = 'admin-templates.js'
with open(path) as f: c = f.read()
original = c
removals = []

# 1) Variável liveEnabled (linha 135)
old_var = '  let liveEnabled = true;\n'
if old_var in c:
    c = c.replace(old_var, '')
    removals.append("variável liveEnabled")

# 2) Função toggleLive completa (indentação 2 espaços)
old_fn = '''  function toggleLive() {
    liveEnabled = !liveEnabled;
    const btn = document.getElementById('liveToggleBtn');
    btn.classList.toggle('on', liveEnabled);
    btn.textContent = liveEnabled ? '● Live' : '○ Live';
    const manualBtn = document.getElementById('manualPreviewBtn');
    if (manualBtn) manualBtn.style.display = liveEnabled ? 'none' : '';

    if (liveEnabled) {
      scheduleLivePreview(0);
    } else {
      document.getElementById('previewImg').style.display = 'none';
      document.getElementById('canvasWrap').classList.remove('live-preview-active');
    }
  }
'''
if old_fn in c:
    c = c.replace(old_fn, '')
    removals.append("função toggleLive")

# 3) Condicional !liveEnabled em scheduleLivePreview
old_cond = '''  function scheduleLivePreview(delay = 700) {
    if (!liveEnabled) return;
    if (previewDebounce) clearTimeout(previewDebounce);'''
new_cond = '''  function scheduleLivePreview(delay = 700) {
    if (previewDebounce) clearTimeout(previewDebounce);'''
if old_cond in c:
    c = c.replace(old_cond, new_cond)
    removals.append("if (!liveEnabled) em scheduleLivePreview")

# 4) Função duplicateTemplateFromList (não usada)
# Encontrar por regex pra pegar o corpo completo
match = re.search(
    r'  async function duplicateTemplateFromList\([^)]*\) \{[\s\S]*?\n  \}\n',
    c
)
if match:
    c = c.replace(match.group(0), '')
    removals.append("função duplicateTemplateFromList (não usada)")

# 5) Função showCenterIndicator (não usada)
match = re.search(
    r'  function showCenterIndicator\([^)]*\) \{[\s\S]*?\n  \}\n',
    c
)
if match:
    c = c.replace(match.group(0), '')
    removals.append("função showCenterIndicator (não usada)")

# 6) Função updDocBgType (não usada)
match = re.search(
    r'  function updDocBgType\([^)]*\) \{[\s\S]*?\n  \}\n',
    c
)
if match:
    c = c.replace(match.group(0), '')
    removals.append("função updDocBgType (não usada)")

if c != original:
    with open(path, 'w') as f: f.write(c)
    print(f"✓ JS: {len(removals)} removoções aplicadas:")
    for r in removals:
        print(f"   - {r}")
else:
    print("⚠ JS: nada removido")

# ──────────────────────────────────────────────────
# CSS — admin-templates.css
# ──────────────────────────────────────────────────
path = 'admin-templates.css'
with open(path) as f: c = f.read()
original = c
css_removed = []

# Regras .live-toggle (verificar indentação 2 espaços)
old1 = '  .live-toggle { font-size: 0.72rem; color: #aaa; cursor: pointer; padding: 4px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); background: transparent; }\n'
if old1 in c:
    c = c.replace(old1, '')
    css_removed.append(".live-toggle")

old2 = '  .live-toggle.on { color: #c8a96e; border-color: rgba(200,169,110,0.3); background: rgba(200,169,110,0.1); }\n'
if old2 in c:
    c = c.replace(old2, '')
    css_removed.append(".live-toggle.on")

if c != original:
    with open(path, 'w') as f: f.write(c)
    print(f"\n✓ CSS: {len(css_removed)} regras removidas:")
    for r in css_removed:
        print(f"   - {r}")
else:
    print("\n⚠ CSS: nada removido")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "Verificação final"
echo "═══════════════════════════════════════════════════"
echo "→ 'liveEnabled' restantes (esperado: 0):"
grep -c "liveEnabled" admin-templates.js || echo "0"
echo ""
echo "→ 'toggleLive' restantes (esperado: 0):"
grep -c "toggleLive" admin-templates.js || echo "0"
echo ""
echo "→ Funções removidas:"
for fn in duplicateTemplateFromList showCenterIndicator updDocBgType toggleLive; do
  cnt=$(grep -c "function $fn" admin-templates.js 2>/dev/null || echo 0)
  echo "   $fn: $cnt declarações"
done
echo ""
echo "→ '.live-toggle' restantes (esperado: 0):"
grep -c "\.live-toggle" admin-templates.css || echo "0"
echo ""
echo "→ Total de linhas no JS depois:"
wc -l admin-templates.js
echo ""
echo "✅ Limpeza concluída. Hard refresh + testar."

#!/bin/bash
# remove-live-toggle.sh — remove o botão de toggle do Live Preview
# Live Preview agora é SEMPRE ON (comportamento default já era esse).
# Mexe em: admin-templates.html, admin-templates.js, admin-templates.css

set -e
cd artifacts/api-server/public

python3 << 'PYEOF'
import os

# ──────────────────────────────────────────────────
# 1) HTML — remover os 2 botões
# ──────────────────────────────────────────────────
path = 'admin-templates.html'
with open(path) as f: c = f.read()
original = c

# Botão liveToggleBtn
btn1 = '<button class="live-toggle on" id="liveToggleBtn" onclick="toggleLive()" title="Live preview automático">● Live</button>'
if btn1 in c:
    c = c.replace(btn1, '')
    print("✓ HTML: botão liveToggleBtn removido")

# Botão manualPreviewBtn
btn2 = '<button id="manualPreviewBtn" onclick="doLivePreview()" style="display:none;padding:5px 10px;font-size:0.78rem;border-radius:6px;border:1px solid rgba(34,27,25,0.12);background:rgba(34,27,25,0.05);color:var(--carbon-black);cursor:pointer;font-family:\'Nunito Sans\',sans-serif">Atualizar preview</button>'
if btn2 in c:
    c = c.replace(btn2, '')
    print("✓ HTML: botão manualPreviewBtn removido")

# Limpa espaços/linhas vazias remanescentes
import re
c = re.sub(r'\n[ \t]*\n[ \t]*\n', '\n\n', c)  # múltiplas linhas vazias → 1

if c != original:
    with open(path, 'w') as f: f.write(c)
else:
    print("⚠ HTML: nenhuma mudança aplicada")

# ──────────────────────────────────────────────────
# 2) JS — remover variável + função + condicional
# ──────────────────────────────────────────────────
path = 'admin-templates.js'
with open(path) as f: c = f.read()
original = c

# Variável liveEnabled
old_var = '    let liveEnabled = true;\n'
if old_var in c:
    c = c.replace(old_var, '')
    print("✓ JS: variável liveEnabled removida")

# Função toggleLive inteira
old_fn = '''    function toggleLive() {
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
    print("✓ JS: função toggleLive removida")
else:
    print("⚠ JS: função toggleLive não encontrada (verificar indentação)")

# Condicional em scheduleLivePreview
old_cond = '''    function scheduleLivePreview(delay = 700) {
      if (!liveEnabled) return;
      if (previewDebounce) clearTimeout(previewDebounce);'''
new_cond = '''    function scheduleLivePreview(delay = 700) {
      if (previewDebounce) clearTimeout(previewDebounce);'''
if old_cond in c:
    c = c.replace(old_cond, new_cond)
    print("✓ JS: condicional !liveEnabled removido de scheduleLivePreview")
else:
    print("⚠ JS: condicional não encontrado")

if c != original:
    with open(path, 'w') as f: f.write(c)

# ──────────────────────────────────────────────────
# 3) CSS — remover regras .live-toggle
# ──────────────────────────────────────────────────
path = 'admin-templates.css'
with open(path) as f: c = f.read()
original = c

old_rule1 = '    .live-toggle { font-size: 0.72rem; color: #aaa; cursor: pointer; padding: 4px 8px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.1); background: transparent; }\n'
if old_rule1 in c:
    c = c.replace(old_rule1, '')
    print("✓ CSS: regra .live-toggle removida")
elif '.live-toggle ' in c:
    print("⚠ CSS: .live-toggle existe mas com indentação diferente — remover manualmente")

old_rule2 = '    .live-toggle.on { color: #c8a96e; border-color: rgba(200,169,110,0.3); background: rgba(200,169,110,0.1); }\n'
if old_rule2 in c:
    c = c.replace(old_rule2, '')
    print("✓ CSS: regra .live-toggle.on removida")

if c != original:
    with open(path, 'w') as f: f.write(c)
PYEOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "Verificação — referências restantes"
echo "═══════════════════════════════════════════════════"
echo "→ 'liveEnabled' restantes (deve ser 0):"
grep -c "liveEnabled" admin-templates.js admin-templates.html admin-templates.css 2>/dev/null | grep -v ':0$' || echo "  ✓ todas removidas"
echo ""
echo "→ 'toggleLive' restantes (deve ser 0):"
grep -c "toggleLive" admin-templates.js admin-templates.html admin-templates.css 2>/dev/null | grep -v ':0$' || echo "  ✓ todas removidas"
echo ""
echo "→ 'liveToggleBtn' / 'manualPreviewBtn' restantes (deve ser 0):"
grep -cE "liveToggleBtn|manualPreviewBtn" admin-templates.js admin-templates.html admin-templates.css 2>/dev/null | grep -v ':0$' || echo "  ✓ todas removidas"
echo ""
echo "→ 'scheduleLivePreview' (deve continuar existindo, é a função):"
grep -c "scheduleLivePreview" admin-templates.js

echo ""
echo "✅ Remoção concluída. Hard refresh na página /admin-templates"
echo "   Live Preview agora roda sempre que houver edição."

#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# shell-fixes-13.sh — aplica os fixes shell-friendly do Prompt 13
# Executa: F (todos os 7 catches) + B.2 (notifications.ts)
# Tempo: ~30 segundos. Custo: $0 (não usa Agent).
# ─────────────────────────────────────────────────────────────────

set -e  # para em qualquer erro

cd artifacts/api-server

echo "═══════════════════════════════════════════════════"
echo "F) console.error em 7 catches críticos"
echo "═══════════════════════════════════════════════════"

# ── F.1: admin-assets.html linha ~709 ──
python3 << 'PYEOF'
import sys
path = 'public/admin-assets.html'
with open(path, 'r') as f: c = f.read()
old = """      } catch { showToast(`${file.name}: erro de rede.`, 'error'); }"""
new = """      } catch (err) { console.error('[admin-assets/upload]', file.name, err); showToast(`${file.name}: erro de rede.`, 'error'); }"""
if old in c:
  c = c.replace(old, new)
  with open(path, 'w') as f: f.write(c)
  print("✓ F.1 admin-assets.html")
else:
  print("✗ F.1 admin-assets.html — pattern NÃO encontrado")
PYEOF

# ── F.2: admin-templates.html linha ~5135 ──
python3 << 'PYEOF'
path = 'public/admin-templates.html'
with open(path, 'r') as f: c = f.read()
old = "      } catch(e) { showToast('Erro de rede.', 'error'); }"
new = "      } catch (e) { console.error('[admin-templates/upload]', e); showToast('Erro de rede.', 'error'); }"
if old in c:
  c = c.replace(old, new)
  with open(path, 'w') as f: f.write(c)
  print("✓ F.2 admin-templates.html")
else:
  print("✗ F.2 admin-templates.html — pattern NÃO encontrado")
PYEOF

# ── F.3 a F.6: admin-usuarios.html (4 catches) ──
python3 << 'PYEOF'
path = 'public/admin-usuarios.html'
with open(path, 'r') as f: c = f.read()

# As 4 chamadas têm o mesmo pattern textual, mas estão em contextos diferentes.
# Substituímos uma de cada vez com um marcador único pra distinguir.
# Como o pattern é IDÊNTICO, vamos usar replace COM COUNT pra substituir 1 por vez,
# adicionando contextos diferentes baseado em qual aparece em cada posição.

old = "      } catch { showToast('Erro de conexão', 'error'); }"

# Lista de labels na ordem que aparecem (linhas 5424, 5456, 5536, 5579)
labels = [
  'admin-usuarios/impersonate',
  'admin-usuarios/role',
  'admin-usuarios/clickup-id',
  'admin-usuarios/atribuicoes',
]

count = c.count(old)
if count != 4:
  print(f"✗ F.3-F.6 admin-usuarios.html — esperava 4 ocorrências, achei {count}")
else:
  for label in labels:
    new = f"      }} catch (err) {{ console.error('[{label}]', err); showToast('Erro de conexão', 'error'); }}"
    c = c.replace(old, new, 1)  # substitui só a PRIMEIRA ocorrência
  with open(path, 'w') as f: f.write(c)
  print("✓ F.3 a F.6 admin-usuarios.html (4 catches)")
PYEOF

# ── F.7: auth.js linha ~5941 ──
python3 << 'PYEOF'
path = 'public/auth.js'
with open(path, 'r') as f: c = f.read()
old = "  } catch { alert('Erro de conexão.'); }"
new = "  } catch (err) { console.error('[auth/impersonate]', err); alert('Erro de conexão.'); }"
if old in c:
  c = c.replace(old, new)
  with open(path, 'w') as f: f.write(c)
  print("✓ F.7 auth.js")
else:
  print("✗ F.7 auth.js — pattern NÃO encontrado")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "B.2) notifications.ts — usar FORM_SCHEMAS"
echo "═══════════════════════════════════════════════════"

python3 << 'PYEOF'
path = 'src/services/notifications.ts'
with open(path, 'r') as f: c = f.read()

# B.2 parte 1: trocar import
old_import = 'import { REQUEST_TYPE_LABELS } from "../routes/clickup";'
new_import = 'import { FORM_SCHEMAS } from "../config/form-schemas";'
imp_ok = old_import in c
if imp_ok:
  c = c.replace(old_import, new_import)

# B.2 parte 2: trocar uso
old_use = 'const tipoLabel = REQUEST_TYPE_LABELS[tipo] || tipo;'
new_use = 'const tipoLabel = FORM_SCHEMAS[tipo]?.label || tipo;'
use_ok = old_use in c
if use_ok:
  c = c.replace(old_use, new_use)

if imp_ok and use_ok:
  with open(path, 'w') as f: f.write(c)
  print("✓ B.2 notifications.ts (import + uso)")
else:
  print(f"✗ B.2 notifications.ts — import_ok={imp_ok} use_ok={use_ok}")
PYEOF

echo ""
echo "═══════════════════════════════════════════════════"
echo "Verificação"
echo "═══════════════════════════════════════════════════"

# Verifica se os console.error foram inseridos
echo ""
echo "→ console.error inseridos (esperado: 7):"
grep -c "console.error('\[admin-assets/upload\]'" public/admin-assets.html
grep -c "console.error('\[admin-templates/upload\]'" public/admin-templates.html
grep -c "console.error('\[admin-usuarios/" public/admin-usuarios.html
grep -c "console.error('\[auth/impersonate\]'" public/auth.js

echo ""
echo "→ B.2: REQUEST_TYPE_LABELS removido de notifications.ts (esperado: 0):"
grep -c "REQUEST_TYPE_LABELS" src/services/notifications.ts || echo "0 (OK!)"

echo ""
echo "→ B.2: FORM_SCHEMAS adicionado a notifications.ts (esperado: 2):"
grep -c "FORM_SCHEMAS" src/services/notifications.ts

echo ""
echo "✅ Shell fixes concluídos."
echo ""
echo "Próximo passo: A, B.1, B.3, B.4, C precisam de Agent ou editor manual."
echo "                Veja o Prompt 13 completo pras instruções."

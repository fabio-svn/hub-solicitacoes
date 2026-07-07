#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Painel JSON editavel: textarea + botao "Aplicar".

  * <pre> read-only vira <textarea> editavel.
  * Botao "Aplicar" valida o JSON (objeto + layers[] + canvas w/h) e carrega no
    editor via reRender (redimensiona o canvas se mudar). Entra no undo; NAO
    persiste no banco (isso continua no "Salvar Config").
  * Mensagem de erro/sucesso abaixo.

Alvos: public/admin-templates.html + public/admin-templates.js
Auto-detecta. Idempotente, backup .bak-jsonedit.
"""
import io, os, sys

def _resolve(rel):
    for base in ("artifacts/api-server", "."):
        c = os.path.normpath(os.path.join(base, rel))
        if os.path.exists(c):
            return c
    return None

HT = _resolve("public/admin-templates.html")
JS = _resolve("public/admin-templates.js")

def apply_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        sys.exit("ABORTADO [%s]: ancora encontrada %d vezes (esperado 1)." % (label, n))
    return src.replace(old, new, 1)

# ── HTML: pre -> textarea + Aplicar + msg ──
HT_OLD = """        <div id="jsonPanelContent" style="display:none;padding:14px 14px 18px" class="panel-scroll">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">
            <div class="props-label" style="margin:0">JSON do template</div>
            <button id="btnCopiarJson" class="row-btn" onclick="copiarTemplateJson()" style="padding:5px 12px">Copiar</button>
          </div>
          <pre id="jsonPanelPre" style="margin:0;padding:12px;background:var(--carbon-black,#221B19);color:#8fdc9f;border-radius:8px;font-size:12px;line-height:1.55;white-space:pre-wrap;word-break:break-word;overflow:auto"></pre>
        </div>"""

HT_NEW = """        <div id="jsonPanelContent" style="display:none;padding:14px 14px 18px" class="panel-scroll">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">
            <div class="props-label" style="margin:0">JSON do template</div>
            <div style="display:flex;gap:6px">
              <button id="btnCopiarJson" class="row-btn" onclick="copiarTemplateJson()" style="padding:5px 12px">Copiar</button>
              <button id="btnAplicarJson" class="row-btn" onclick="aplicarTemplateJson()" style="padding:5px 12px;border-color:var(--ruby-red);color:var(--ruby-red)">Aplicar</button>
            </div>
          </div>
          <textarea id="jsonPanelText" spellcheck="false" style="width:100%;box-sizing:border-box;min-height:420px;resize:vertical;margin:0;padding:12px;background:var(--carbon-black,#221B19);color:#8fdc9f;border:1px solid var(--border-warm,#3a2f2c);border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.55;overflow:auto"></textarea>
          <div id="jsonPanelMsg" style="margin-top:8px;font-size:12px;min-height:16px"></div>
        </div>"""

# ── JS: renderJsonPanel -> textarea ──
RJ_OLD = """  function renderJsonPanel() {
    const pre = document.getElementById('jsonPanelPre');
    if (pre && currentTemplate) pre.textContent = JSON.stringify(currentTemplate, null, 2);
  }"""
RJ_NEW = """  function renderJsonPanel() {
    const ta = document.getElementById('jsonPanelText');
    if (ta && currentTemplate) ta.value = JSON.stringify(currentTemplate, null, 2);
    const msg = document.getElementById('jsonPanelMsg');
    if (msg) msg.textContent = '';
  }"""

# ── JS: adiciona aplicarTemplateJson apos copiarTemplateJson ──
AP_OLD = """    } else {
      showToast('Copia nao suportada neste navegador', 'error');
    }
  }"""
AP_NEW = """    } else {
      showToast('Copia nao suportada neste navegador', 'error');
    }
  }
  function aplicarTemplateJson() {
    const ta = document.getElementById('jsonPanelText');
    const msg = document.getElementById('jsonPanelMsg');
    if (!ta) return;
    function fail(t) { if (msg) { msg.textContent = t; msg.style.color = 'var(--ruby-red, #AC3631)'; } }
    let parsed;
    try { parsed = JSON.parse(ta.value); }
    catch (e) { fail('JSON invalido: ' + e.message); return; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) { fail('JSON precisa ser um objeto de template.'); return; }
    if (!Array.isArray(parsed.layers)) { fail('Faltou o array "layers".'); return; }
    if (!parsed.canvas || typeof parsed.canvas.width !== 'number' || typeof parsed.canvas.height !== 'number') { fail('Faltou "canvas" com width/height numericos.'); return; }
    currentTemplate = Object.assign({}, currentTemplate, parsed);
    selectedIds.clear();
    selectedLayerId = null;
    markDirty();
    pushHistory();
    reRender();
    renderJsonPanel();
    if (msg) { msg.textContent = 'Aplicado no editor. Use "Salvar Config" para persistir.'; msg.style.color = 'var(--svn-success, #22c55e)'; }
  }"""


def main():
    if HT is None or JS is None:
        sys.exit("ABORTADO: admin-templates.html e/ou .js nao encontrados.")

    ht = io.open(HT, encoding="utf-8").read()
    if 'id="jsonPanelText"' in ht:
        print("[html] JA APLICADO — textarea presente.")
    elif HT_OLD not in ht:
        print("[html] ATENCAO — ancora do painel JSON nao casou (aplique patch-bloco2a/json-pad antes).")
    else:
        bp = HT + ".bak-jsonedit"
        if not os.path.exists(bp): io.open(bp, "w", encoding="utf-8").write(ht)
        ht = apply_once(ht, HT_OLD, HT_NEW, "html")
        io.open(HT, "w", encoding="utf-8").write(ht)
        print("[html] OK — textarea + Aplicar + msg (backup: %s.bak-jsonedit)" % HT)

    js = io.open(JS, encoding="utf-8").read()
    if "function aplicarTemplateJson" in js:
        print("[js] JA APLICADO — aplicarTemplateJson presente.")
    else:
        bp = JS + ".bak-jsonedit"
        if not os.path.exists(bp): io.open(bp, "w", encoding="utf-8").write(js)
        js = apply_once(js, RJ_OLD, RJ_NEW, "renderJsonPanel")
        js = apply_once(js, AP_OLD, AP_NEW, "aplicarTemplateJson")
        io.open(JS, "w", encoding="utf-8").write(js)
        print("[js] OK — renderJsonPanel (textarea) + aplicarTemplateJson (backup: %s.bak-jsonedit)" % JS)

    print("\nConcluido. Stop -> Run no Replit do Hub.")


if __name__ == "__main__":
    main()

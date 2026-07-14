#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[1] CORRIGE o Auto-fit max (que zerava) e o torna AUTOMATICO.
    Bug: o onchange inline referenciava a variavel 'layer', que nao existe no escopo
    global onde o onclick/onchange roda -> ReferenceError -> o valor nunca era salvo
    e voltava a 0 no re-render. (Erro meu no patch anterior.)
    Correcao: funcao updAutoFit(id, campo, valor) que busca a layer via getLayer().
    Automatico: um botao liga/desliga o auto-fit e ja preenche min/max sozinho
    (min = 65% e max = 150% do tamanho atual), sem o usuario precisar adivinhar.
    Os campos continuam editaveis para ajuste fino.

[2] CORRIGE o botao de previa (olho) na lista de templates.
    Ele so mostrava a imagem de FUNDO — nunca renderizava o template.
    Agora usa o mesmo motor do editor: busca o template, busca os dados de exemplo
    (sample-data/:tipo) e renderiza de verdade via POST /art-templates/preview.

Alvo: public/admin-templates.js. Idempotente, backup .bak-afprev.
"""
import io, os, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
E=_r(["artifacts/api-server/public/admin-templates.js","public/admin-templates.js"])
if E is None: sys.exit("admin-templates.js nao encontrado")
s=io.open(E,encoding="utf-8").read()
ORIG=s

# ─────────── [1] Auto-fit ───────────
if "function updAutoFit" in s:
    print("[auto-fit] JA APLICADO.")
else:
    # 1a) painel: substitui o bloco antigo (que so aparecia se auto_fit ja existia)
    import re
    pat = re.compile(
        r"\$\{layer\.auto_fit\?`\s*\n"
        r"\s*<div class=\"props-label\"[^>]*>Auto-fit min</div>\s*\n"
        r"\s*<input class=\"props-input\" type=\"number\" value=\"\$\{layer\.auto_fit\.min_font_size\}\"[^>]*>\s*\n"
        r"(?:\s*<div class=\"props-label\"[^>]*>Auto-fit max[^<]*</div>\s*\n"
        r"\s*<input class=\"props-input\" type=\"number\"[^>]*>\s*\n)?"
        r"\s*`:''\}"
    )
    if len(pat.findall(s)) != 1:
        sys.exit("ABORTADO [auto-fit painel]: ancora encontrada %d vez(es)" % len(pat.findall(s)))
    novo = """<div class="props-label" style="margin-top:10px;display:flex;align-items:center;justify-content:space-between">
          <span>Ajustar tamanho ao espaço</span>
          <button type="button" class="align-btn${layer.auto_fit?' active':''}" style="padding:2px 10px;font-size:.7rem"
                  onclick="toggleAutoFit('${id}')">${layer.auto_fit?'Ligado':'Desligado'}</button>
        </div>
        ${layer.auto_fit?`
        <div style="font-size:.7rem;opacity:.7;margin-bottom:6px;line-height:1.35">
          Texto longo encolhe até o mínimo; texto curto cresce até o máximo.
        </div>
        <div class="props-grid-2">
          <div>
            <div class="props-label">Mínimo</div>
            <input class="props-input" type="number" min="1" value="${layer.auto_fit.min_font_size||0}"
                   onchange="updAutoFit('${id}','min_font_size',+this.value)">
          </div>
          <div>
            <div class="props-label">Máximo</div>
            <input class="props-input" type="number" min="0" value="${layer.auto_fit.max_font_size||0}"
                   onchange="updAutoFit('${id}','max_font_size',+this.value)">
          </div>
        </div>
        `:''}"""
    s = pat.sub(lambda m: novo, s, count=1)

    # 1b) funcoes (ancoradas em updLayerN, como as demais)
    ANC = "  function updLayerN(id, key, value) { updLayer(id, key, parseFloat(value) || 0); }"
    if s.count(ANC) != 1:
        sys.exit("ABORTADO [auto-fit fn]: ancora updLayerN %d vez(es)" % s.count(ANC))
    s = s.replace(ANC, ANC + """

  // ── Auto-fit (encolhe/cresce a fonte para caber na caixa) ──
  // Ligar ja preenche min/max com valores sensatos, derivados do tamanho atual:
  // o usuario nao precisa adivinhar numero nenhum.
  function toggleAutoFit(id) {
    const layer = getLayer(id);
    if (!layer) return;
    if (layer.auto_fit) {
      delete layer.auto_fit;
    } else {
      const base = layer.font_size || 16;
      layer.auto_fit = {
        enabled: true,
        min_font_size: Math.max(8, Math.round(base * 0.65)),
        max_font_size: Math.round(base * 1.5),
      };
    }
    markDirty();
    debouncedPushHistory();
    renderCanvas();
    renderProps();
    scheduleLivePreview(NORMAL_DEBOUNCE);
  }
  function updAutoFit(id, campo, valor) {
    const layer = getLayer(id);
    if (!layer || !layer.auto_fit) return;
    const base = layer.font_size || 16;
    const af = Object.assign(
      { enabled: true, min_font_size: Math.round(base * 0.65), max_font_size: 0 },
      layer.auto_fit
    );
    af[campo] = valor;
    if (!af.min_font_size) af.min_font_size = Math.max(8, Math.round(base * 0.65));
    layer.auto_fit = af;
    markDirty();
    debouncedPushHistory();
    renderCanvas();
    scheduleLivePreview(NORMAL_DEBOUNCE);
  }""", 1)
    print("[auto-fit] OK — bug do 'layer' corrigido + liga/desliga automatico")

# ─────────── [2] Previa da lista ───────────
if "sample-data/${t.tipo" in s or "renderPreviewReal" in s:
    print("[previa] JA APLICADO.")
else:
    OLD_PREV = """  async function abrirPreviewModal(id) {
    const overlay = document.getElementById('previewModalOverlay');
    const content = document.getElementById('previewModalContent');
    const title = document.getElementById('previewModalTitle');
    content.innerHTML = '<span style="opacity:0.5;font-size:0.9rem">Carregando…</span>';
    Modal.open('previewModalOverlay');
    try {
      const res = await fetch(`/api/admin/art-templates/${id}`);
      if (!res.ok) throw new Error('Erro');
      const t = await res.json();
      title.textContent = t.name;
      const bgUrl = t.config?.bg?.url || t.config?.background_image_url;
      if (bgUrl) {
        content.innerHTML = `<img src="${bgUrl}" style="max-width:100%;max-height:70vh;border-radius:var(--radius-sm);display:block">`;
      } else {
        content.innerHTML = `<div style="padding:40px;opacity:0.5;font-size:0.9rem;text-align:center">Nenhum background configurado ainda.<br>Abra o editor para pré-visualizar o template.</div>`;
      }
    } catch {
      content.innerHTML = '<span style="opacity:0.5;font-size:0.9rem;padding:24px">Erro ao carregar preview.</span>';
    }
  }"""
    NEW_PREV = """  // Previa REAL do template: renderiza no servidor com os dados de exemplo do tipo,
  // igual ao live preview do editor. (Antes isso so mostrava a imagem de fundo.)
  let previewModalUrl = null;
  async function abrirPreviewModal(id) {
    const content = document.getElementById('previewModalContent');
    const title = document.getElementById('previewModalTitle');
    content.innerHTML = '<span style="opacity:0.5;font-size:0.9rem">Renderizando prévia…</span>';
    Modal.open('previewModalOverlay');
    try {
      const res = await fetch(`/api/admin/art-templates/${id}`);
      if (!res.ok) throw new Error('Não foi possível carregar o template.');
      const t = await res.json();
      title.textContent = t.name;

      // dados de exemplo do tipo (mesmo endpoint que o editor usa)
      let dados = {};
      try {
        const rs = await fetch(`/api/admin/art-templates/sample-data/${t.tipo}`);
        if (rs.ok) dados = await rs.json();
      } catch { /* sem dados de exemplo: renderiza com os placeholders vazios */ }

      // preenche os campos de variante (plataforma, etc.) com a 1a opção
      const cfg = t.config || {};
      for (const layer of (cfg.layers || [])) {
        const vs = layer?.source?.variant_source;
        if (layer.type === 'image' && layer.source?.type === 'variant' && vs && !dados[vs]) {
          dados[vs] = Object.keys(layer.source.variants || {})[0] || '';
        }
      }

      const rp = await fetch('/api/admin/art-templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: cfg, data: dados }),
      });
      if (!rp.ok) throw new Error('Falha ao renderizar a prévia.');
      const blob = await rp.blob();

      if (previewModalUrl) URL.revokeObjectURL(previewModalUrl);
      previewModalUrl = URL.createObjectURL(blob);
      content.innerHTML = `<img src="${previewModalUrl}" alt="Prévia de ${esc(t.name)}" ` +
        `style="max-width:100%;max-height:70vh;border-radius:var(--radius-sm);display:block;margin:0 auto">`;
    } catch (err) {
      content.innerHTML = `<div style="padding:32px;opacity:.6;font-size:.9rem;text-align:center">` +
        `${esc(err.message || 'Erro ao carregar a prévia.')}</div>`;
    }
  }"""
    if s.count(OLD_PREV) != 1:
        sys.exit("ABORTADO [previa]: ancora %d vez(es)" % s.count(OLD_PREV))
    s = s.replace(OLD_PREV, NEW_PREV, 1)
    print("[previa] OK — renderiza o template com dados de exemplo")

bp=E+".bak-afprev"
if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(ORIG)
io.open(E,"w",encoding="utf-8").write(s)
print("\nStop -> Run + bash check.sh")

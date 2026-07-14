#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
A previa da lista de templates falha em silencio: nao da para saber SE o clique
chega na funcao, se o fetch falha, ou se o render devolve erro.
Este patch faz a funcao dizer exatamente onde parou (status HTTP + mensagem do
servidor) e loga no console. Assim o proximo clique ja mostra a causa.

Alvo: public/admin-templates.js. Idempotente, backup .bak-prevdbg.
"""
import io, os, re, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
E=_r(["artifacts/api-server/public/admin-templates.js","public/admin-templates.js"])
if E is None: sys.exit("admin-templates.js nao encontrado")
s=io.open(E,encoding="utf-8").read()
if "[preview]" in s:
    print("JA APLICADO."); sys.exit()

pat = re.compile(r"  (?:let previewModalUrl = null;\s*\n  )?async function abrirPreviewModal\(id\) \{[\s\S]*?\n  \}\n", re.M)
achados = pat.findall(s)
if len(achados) != 1:
    sys.exit("ABORTADO: abrirPreviewModal encontrada %d vez(es)" % len(achados))

NOVO = '''  let previewModalUrl = null;
  async function abrirPreviewModal(id) {
    console.log('[preview] clique no olho — template', id);
    const content = document.getElementById('previewModalContent');
    const title = document.getElementById('previewModalTitle');
    if (!content) { alert('Modal de prévia não encontrado na página.'); return; }

    content.innerHTML = '<span style="opacity:.5;font-size:.9rem">Renderizando prévia…</span>';
    if (typeof Modal === 'undefined' || !Modal.open) {
      content.innerHTML = '<span style="opacity:.6">Modal indisponível.</span>';
      console.error('[preview] window.Modal não existe');
      return;
    }
    Modal.open('previewModalOverlay');

    const falhar = (msg, extra) => {
      console.error('[preview]', msg, extra || '');
      content.innerHTML = '<div style="padding:32px;text-align:center;font-size:.85rem;line-height:1.5">' +
        '<div style="color:var(--ruby-red);font-weight:600;margin-bottom:6px">Não foi possível gerar a prévia</div>' +
        '<div style="opacity:.65">' + String(msg) + '</div></div>';
    };

    try {
      // 1) template
      const r1 = await fetch('/api/admin/art-templates/' + id, { credentials: 'include' });
      console.log('[preview] GET template ->', r1.status);
      if (!r1.ok) return falhar('Erro ' + r1.status + ' ao buscar o template.');
      const t = await r1.json();
      if (title) title.textContent = t.name || 'Prévia';

      const cfg = t.config;
      if (!cfg || !Array.isArray(cfg.layers)) return falhar('Este template ainda não tem layers configuradas.');

      // 2) dados de exemplo do tipo
      let dados = {};
      try {
        const r2 = await fetch('/api/admin/art-templates/sample-data/' + t.tipo, { credentials: 'include' });
        console.log('[preview] GET sample-data ->', r2.status);
        if (r2.ok) dados = await r2.json();
      } catch (e) { console.warn('[preview] sample-data falhou, seguindo sem dados', e); }

      // campos de variante (plataforma etc.): usa a 1a opcao para a logo aparecer
      for (const layer of cfg.layers) {
        const vs = layer && layer.source && layer.source.variant_source;
        if (layer.type === 'image' && layer.source?.type === 'variant' && vs && !dados[vs]) {
          dados[vs] = Object.keys(layer.source.variants || {})[0] || '';
        }
      }

      // 3) render
      const r3 = await fetch('/api/admin/art-templates/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ config: cfg, data: dados }),
      });
      console.log('[preview] POST render ->', r3.status);
      if (!r3.ok) {
        let det = '';
        try { const j = await r3.json(); det = j.error || ''; } catch {}
        return falhar('O servidor não conseguiu renderizar (erro ' + r3.status + '). ' + det);
      }

      const blob = await r3.blob();
      if (!blob || !blob.size) return falhar('O servidor devolveu uma imagem vazia.');

      if (previewModalUrl) URL.revokeObjectURL(previewModalUrl);
      previewModalUrl = URL.createObjectURL(blob);
      content.innerHTML = '<img src="' + previewModalUrl + '" alt="Prévia" ' +
        'style="max-width:100%;max-height:70vh;border-radius:var(--radius-sm);display:block;margin:0 auto">';
      console.log('[preview] ok —', Math.round(blob.size / 1024), 'KB');
    } catch (err) {
      falhar(err && err.message ? err.message : 'Erro inesperado.', err);
    }
  }
'''
s = pat.sub(lambda m: NOVO, s, count=1)
bp=E+".bak-prevdbg"
if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(io.open(E,encoding="utf-8").read())
io.open(E,"w",encoding="utf-8").write(s)
print("OK — a previa agora informa exatamente onde parou (e loga no console).")

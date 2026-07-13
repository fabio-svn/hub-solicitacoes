#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Drop shadow para layers do tipo IMAGE (as fotos circulares dos palestrantes).

Ideia central: a imagem e recortada numa forma CONHECIDA (circulo ou retangulo).
Entao a sombra dela e a sombra DESSA FORMA — nao e preciso borrar a imagem.
Desenhamos a forma preenchida + borrada ATRAS da imagem (um composite a mais).
Barato e exato.

Nova propriedade opcional em ImageLayer (mesma forma da do shape):
  shadow: { color, blur, offset_x, offset_y, opacity }
Sem 'shadow', nada muda (nenhum composite extra).

Alvos: types/art-template.ts, services/template-renderer.ts, public/admin-templates.js
Idempotente, backups .bak-fotoshadow.
"""
import io, os, re, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
T=_r(["artifacts/api-server/src/types/art-template.ts","src/types/art-template.ts"])
R=_r(["artifacts/api-server/src/services/template-renderer.ts","src/services/template-renderer.ts"])
E=_r(["artifacts/api-server/public/admin-templates.js","public/admin-templates.js"])
if not all([T,R,E]): sys.exit("arquivos nao encontrados")

# ───────── 1) TIPO: ImageLayer.shadow ─────────
t=io.open(T,encoding="utf-8").read()
_m = re.search(r"export type ImageLayer = LayerBase & \{[\s\S]*?\n\};", t)
if _m is None:
    sys.exit("ABORTADO: bloco ImageLayer nao encontrado")
if "shadow?:" in _m.group(0):     # olha SO dentro do ImageLayer
    print("[types] JA APLICADO.")
else:
    pat = re.compile(r"(export type ImageLayer = LayerBase & \{[\s\S]*?border\?\s*:\s*\{\s*\n\s*width:\s*number;\s*\n\s*color:\s*string;\s*\n\s*\};\s*\n)(\};)")
    if len(pat.findall(t)) != 1:
        sys.exit("ABORTADO [types ImageLayer]: ancora %d vez(es)" % len(pat.findall(t)))
    novo = (r"\1  /** Sombra projetada da forma que recorta a imagem. Ausente = sem sombra. */\n"
            r"  shadow?: {\n"
            r"    color?: string;\n"
            r"    blur?: number;       // 0 = sem sombra\n"
            r"    offset_x?: number;\n"
            r"    offset_y?: number;\n"
            r"    opacity?: number;    // 0..1 (default 0.35)\n"
            r"  };\n\2")
    t = pat.sub(novo, t, count=1)
    bp=T+".bak-fotoshadow"
    if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(io.open(T,encoding="utf-8").read())
    io.open(T,"w",encoding="utf-8").write(t)
    print("[types] OK — ImageLayer.shadow")

# ───────── 2) RENDERER: sombra ANTES do composite da imagem ─────────
r=io.open(R,encoding="utf-8").read()
if "ish-" in r:
    print("[renderer] JA APLICADO.")
else:
    # ancora: o push do composite da imagem (antes do bloco de border)
    pat = re.compile(r"(\n)(\s*)composites\.push\(composite\);(\s*\n\s*const border = layer\.border;)")
    if len(pat.findall(r)) != 1:
        sys.exit("ABORTADO [renderer push]: ancora %d vez(es)" % len(pat.findall(r)))

    bloco = '''
  // ── Sombra da foto ──────────────────────────────────────────────
  // A imagem ja foi recortada numa forma conhecida (circulo ou retangulo), entao a
  // sombra e a sombra DESSA forma: desenhamos a forma preenchida e borrada ATRAS da
  // imagem. Nao e preciso borrar a imagem em si.
  const imgSh = layer.shadow;
  const iBlur = Math.max(0, Number(imgSh?.blur ?? 0));
  if (imgSh && iBlur > 0) {
    const iDx = Number(imgSh.offset_x ?? 0);
    const iDy = Number(imgSh.offset_y ?? 0);
    const iCor = imgSh.color || '#000000';
    const iOp = Math.min(1, Math.max(0, Number(imgSh.opacity ?? 0.35)));
    const iPad = Math.ceil(iBlur * 2 + Math.max(Math.abs(iDx), Math.abs(iDy)));

    // area expandida (a sombra vaza para fora da forma)
    const iOx = _cx - iPad;
    const iOy = _cy - iPad;
    const iW = safeW + 2 * iPad;
    const iH = safeH + 2 * iPad;
    const iCropL = iOx < 0 ? Math.min(-iOx, iW) : 0;
    const iCropT = iOy < 0 ? Math.min(-iOy, iH) : 0;
    const iVisW = Math.min(iW - iCropL, bgWidth  - Math.max(iOx, 0));
    const iVisH = Math.min(iH - iCropT, bgHeight - Math.max(iOy, 0));

    if (iVisW > 0 && iVisH > 0) {
      const forma = isCircle
        ? `<circle cx="${iPad + safeW / 2}" cy="${iPad + safeH / 2}" r="${Math.min(safeW, safeH) / 2}" fill="${iCor}" fill-opacity="${iOp}"/>`
        : `<rect x="${iPad}" y="${iPad}" width="${safeW}" height="${safeH}" fill="${iCor}" fill-opacity="${iOp}"/>`;
      const fid = `ish-${layer.id}`;
      const shSvg =
        `<svg width="${iVisW}" height="${iVisH}" xmlns="http://www.w3.org/2000/svg">` +
        `<defs><filter id="${fid}" x="-50%" y="-50%" width="200%" height="200%">` +
        `<feGaussianBlur stdDeviation="${iBlur / 2}" result="b"/>` +
        `<feOffset in="b" dx="${iDx}" dy="${iDy}"/>` +
        `</filter></defs>` +
        `<g transform="translate(${-iCropL},${-iCropT})"><g filter="url(#${fid})">${forma}</g></g>` +
        `</svg>`;
      // entra ANTES da imagem no array -> fica atras dela
      composites.push({
        input: Buffer.from(shSvg),
        left: Math.round(Math.max(iOx, 0)),
        top: Math.round(Math.max(iOy, 0)),
      });
    }
  }

'''
    r = pat.sub(lambda m: m.group(1) + bloco + m.group(2) + "composites.push(composite);" + m.group(3), r, count=1)
    bp=R+".bak-fotoshadow"
    if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(io.open(R,encoding="utf-8").read())
    io.open(R,"w",encoding="utf-8").write(r)
    print("[renderer] OK — sombra da forma desenhada atras da imagem")

# ───────── 3) EDITOR: painel + preview ─────────
e=io.open(E,encoding="utf-8").read()
if "updImgShadow" in e:
    print("[editor] JA APLICADO.")
else:
    ORIG = e
    # 3a) painel: logo apos o bloco de Borda da image layer
    ancora_border = """          <div><div class="props-label">Cor</div>${renderColorPickerWithSwatches(`border-color-${id}`, layer.border?.color||'#ffffff', `updLayerBorderColor('${id}',this.value)`)}</div>
        </div>
      </div>"""
    if e.count(ancora_border) != 1:
        sys.exit("ABORTADO [editor painel image]: %d" % e.count(ancora_border))
    novo_painel = ancora_border + """
      <div class="props-section">
        <div class="props-label">Sombra (drop shadow)</div>
        <div class="props-label" style="margin-top:6px;font-size:.72rem;opacity:.75">Desfoque (px) — 0 desliga</div>
        <input class="props-input" type="number" min="0" value="${(layer.shadow&&layer.shadow.blur)||0}" onchange="updImgShadow('${id}','blur',+this.value)">
        <div style="display:flex;gap:8px;margin-top:8px">
          <div style="flex:1">
            <div class="props-label" style="font-size:.72rem;opacity:.75">Desloc. X</div>
            <input class="props-input" type="number" value="${(layer.shadow&&layer.shadow.offset_x)||0}" onchange="updImgShadow('${id}','offset_x',+this.value)">
          </div>
          <div style="flex:1">
            <div class="props-label" style="font-size:.72rem;opacity:.75">Desloc. Y</div>
            <input class="props-input" type="number" value="${(layer.shadow&&layer.shadow.offset_y)||0}" onchange="updImgShadow('${id}','offset_y',+this.value)">
          </div>
        </div>
        <div class="props-label" style="margin-top:8px;font-size:.72rem;opacity:.75">Opacidade (0 a 1)</div>
        <input class="props-input" type="number" min="0" max="1" step="0.05" value="${(layer.shadow&&layer.shadow.opacity!=null)?layer.shadow.opacity:0.35}" onchange="updImgShadow('${id}','opacity',+this.value)">
        <div class="props-label" style="margin-top:8px;font-size:.72rem;opacity:.75">Cor da sombra</div>
        ${renderColorPickerWithSwatches(`ishcolor-${id}`, (layer.shadow&&layer.shadow.color)||'#000000', `updImgShadow('${id}','color',this.value)`)}
      </div>"""
    e = e.replace(ancora_border, novo_painel, 1)

    # 3b) funcao updImgShadow (reusa updShadow se existir; senao define equivalente)
    anc_fn = "  function updLayerN(id, key, value) { updLayer(id, key, parseFloat(value) || 0); }"
    if e.count(anc_fn) != 1:
        sys.exit("ABORTADO [editor updLayerN]: %d" % e.count(anc_fn))
    e = e.replace(anc_fn, anc_fn + """

  // Sombra de layers 'image' (a foto circular). Mesma forma da sombra de shape.
  function updImgShadow(id, campo, valor) {
    const layer = getLayer(id);
    if (!layer) return;
    const s = Object.assign({ color: '#000000', blur: 0, offset_x: 0, offset_y: 0, opacity: 0.35 }, layer.shadow || {});
    s[campo] = valor;
    if (!s.blur) delete layer.shadow;
    else layer.shadow = s;
    markDirty();
    debouncedPushHistory();
    renderCanvas();
    scheduleLivePreview(NORMAL_DEBOUNCE);
  }""", 1)

    # 3c) preview: drop-shadow no wrapper da imagem
    anc_prev = "imgWrap.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;display:flex;align-items:center;justify-content:center;';"
    if e.count(anc_prev) != 1:
        sys.exit("ABORTADO [editor preview image]: %d" % e.count(anc_prev))
    novo_prev = """let _icss = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;display:flex;align-items:center;justify-content:center;';
        const _ish = layer.shadow;
        if (_ish && (_ish.blur || 0) > 0) {
          const _io = (_ish.opacity == null ? 0.35 : _ish.opacity);
          const _irgba = (typeof _hexToRgba === 'function') ? _hexToRgba(_ish.color || '#000000', _io) : 'rgba(0,0,0,' + _io + ')';
          _icss += ';filter:drop-shadow(' + ((_ish.offset_x||0)*SCALE) + 'px ' + ((_ish.offset_y||0)*SCALE) + 'px ' + ((_ish.blur||0)*SCALE) + 'px ' + _irgba + ')';
        }
        imgWrap.style.cssText = _icss;"""
    e = e.replace(anc_prev, novo_prev, 1)

    bp=E+".bak-fotoshadow"
    if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(ORIG)
    io.open(E,"w",encoding="utf-8").write(e)
    print("[editor] OK — sombra na layer de imagem")

print("\nStop -> Run + bash check.sh")

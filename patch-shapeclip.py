#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Dois ajustes finos:

  [1] renderShape (template-renderer.ts): recorta o excedente fora do canvas
      (desenha no tamanho pretendido + viewport na regiao visivel), igual ao
      renderImage. Antes fazia cap (encolhia/distorcia o canto com border_radius).

  [2] resize move (admin-templates.js): remove a chamada redundante de
      classList.remove('live-preview-active') no move (o start ja faz).

Alvos: src/services/template-renderer.ts + public/admin-templates.js
Auto-detecta. Idempotente, backup .bak-shapeclip.
"""
import io, os, sys

def _resolve(rel):
    for base in ("artifacts/api-server", "."):
        c = os.path.normpath(os.path.join(base, rel))
        if os.path.exists(c):
            return c
    return None

TR = _resolve("src/services/template-renderer.ts")
JS = _resolve("public/admin-templates.js")

def apply_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        sys.exit("ABORTADO [%s]: ancora encontrada %d vezes (esperado 1)." % (label, n))
    return src.replace(old, new, 1)

# [1] renderShape edge-clip
SHP_OLD = r"""  const safeW = Math.min(layer.w, bgWidth - layer.x);
  const safeH = Math.min(layer.h, bgHeight - layer.y);
  if (safeW <= 0 || safeH <= 0) return;

  const fill = layer.fill || 'none';
  const stroke = layer.stroke || 'none';
  const strokeWidth = layer.stroke_width || 0;
  const inset = strokeWidth / 2;

  let shapeEl: string;
  if (layer.shape === 'ellipse') {
    const cx = safeW / 2;
    const cy = safeH / 2;
    const rx = Math.max(0, (safeW / 2) - inset);
    const ry = Math.max(0, (safeH / 2) - inset);
    shapeEl = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  } else {
    const x = inset;
    const y = inset;
    const w = Math.max(0, safeW - strokeWidth);
    const h = Math.max(0, safeH - strokeWidth);
    const rx = Math.min(layer.border_radius || 0, w / 2, h / 2);
    shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }

  const svg = `<svg width="${safeW}" height="${safeH}" xmlns="http://www.w3.org/2000/svg">${shapeEl}</svg>`;
  composites.push({
    input: Buffer.from(svg), // SVG cru: rasterizado no composite final
    left: Math.round(layer.x),
    top: Math.round(layer.y),
  });"""

SHP_NEW = r"""  // desenha no tamanho pretendido e recorta o excedente fora do canvas (igual renderImage)
  const fullW = layer.w;
  const fullH = layer.h;
  const cropLeft = layer.x < 0 ? Math.min(-layer.x, fullW) : 0;
  const cropTop  = layer.y < 0 ? Math.min(-layer.y, fullH) : 0;
  const visW = Math.min(fullW - cropLeft, bgWidth  - Math.max(layer.x, 0));
  const visH = Math.min(fullH - cropTop,  bgHeight - Math.max(layer.y, 0));
  if (visW <= 0 || visH <= 0) return;

  const fill = layer.fill || 'none';
  const stroke = layer.stroke || 'none';
  const strokeWidth = layer.stroke_width || 0;
  const inset = strokeWidth / 2;

  let shapeEl: string;
  if (layer.shape === 'ellipse') {
    const cx = fullW / 2;
    const cy = fullH / 2;
    const rx = Math.max(0, (fullW / 2) - inset);
    const ry = Math.max(0, (fullH / 2) - inset);
    shapeEl = `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  } else {
    const x = inset;
    const y = inset;
    const w = Math.max(0, fullW - strokeWidth);
    const h = Math.max(0, fullH - strokeWidth);
    const rx = Math.min(layer.border_radius || 0, w / 2, h / 2);
    shapeEl = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" ry="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;
  }

  // viewport = regiao visivel; o translate desloca a forma para RECORTAR (nao encolher)
  const svg = `<svg width="${visW}" height="${visH}" xmlns="http://www.w3.org/2000/svg"><g transform="translate(${-cropLeft},${-cropTop})">${shapeEl}</g></svg>`;
  composites.push({
    input: Buffer.from(svg), // SVG cru: rasterizado no composite final
    left: Math.round(Math.max(layer.x, 0)),
    top: Math.round(Math.max(layer.y, 0)),
  });"""

# [2] resize move: remove a remocao redundante
RZ_OLD = r"""          move(event) {
            document.getElementById('canvasWrap')?.classList.remove('live-preview-active');
            const shift = event.shiftKey || _keyState.shift;"""
RZ_NEW = r"""          move(event) {
            const shift = event.shiftKey || _keyState.shift;"""


def main():
    if TR is None or JS is None:
        sys.exit("ABORTADO: template-renderer.ts e/ou admin-templates.js nao encontrados.")

    tr = io.open(TR, encoding="utf-8").read()
    if "const fullW = layer.w;" in tr:
        print("[TR] JA APLICADO — renderShape edge-clip presente.")
    elif SHP_OLD not in tr:
        print("[TR] ATENCAO — ancora do renderShape nao casou (verifique manualmente).")
    else:
        bp = TR + ".bak-shapeclip"
        if not os.path.exists(bp):
            io.open(bp, "w", encoding="utf-8").write(tr)
        tr = apply_once(tr, SHP_OLD, SHP_NEW, "renderShape")
        io.open(TR, "w", encoding="utf-8").write(tr)
        print("[TR] OK — renderShape recorta na borda (backup: %s.bak-shapeclip)" % TR)

    js = io.open(JS, encoding="utf-8").read()
    if RZ_OLD not in js:
        print("[JS] JA APLICADO — remocao redundante do resize ja saiu.")
    else:
        bp = JS + ".bak-shapeclip"
        if not os.path.exists(bp):
            io.open(bp, "w", encoding="utf-8").write(js)
        js = apply_once(js, RZ_OLD, RZ_NEW, "resize dedup")
        io.open(JS, "w", encoding="utf-8").write(js)
        print("[JS] OK — remocao redundante do resize move removida (backup: %s.bak-shapeclip)" % JS)

    print("\nConcluido. Stop -> Run no Replit do Hub.")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Fontes premium no front (WYSIWYG no preview do editor).

  [app.ts] serve a pasta assets/fonts em /fonts (mesma origem, sem CORS),
           ANTES do catch-all (senao viraria index.html).
  [admin-templates.css] declara @font-face para as 13 familias de AVAILABLE_FONTS,
           mapeando o nome exato (ex: "Roobert PRO TRIAL Light") -> arquivo em /fonts.

Depois disso o canvas do editor usa a fonte real (metrica correta) em vez do
sans-serif de fallback — o preview passa a bater com a arte gerada.

Alvos: src/app.ts + public/admin-templates.css
Auto-detecta. Idempotente, backup .bak-fonts.

Obs de licenca: Ivy Journal e Roobert "TRIAL" sao comerciais/trial — servir
publicamente pode violar a licenca. Isso e decisao sua; tecnicamente funciona.
"""
import io, os, sys

def _resolve(rel):
    for base in ("artifacts/api-server", "."):
        c = os.path.normpath(os.path.join(base, rel))
        if os.path.exists(c):
            return c
    return None

APP = _resolve("src/app.ts")
CSS = _resolve("public/admin-templates.css")

def apply_once(src, old, new, label):
    n = src.count(old)
    if n != 1:
        sys.exit("ABORTADO [%s]: ancora encontrada %d vezes (esperado 1)." % (label, n))
    return src.replace(old, new, 1)

# [1] app.ts — rota estatica /fonts antes do catch-all
APP_OLD = """}));

app.get("/{*catchAll}", (_req, res) => {"""
APP_NEW = """}));

const fontsDir = path.resolve(__dirname, "../assets/fonts");
app.use('/fonts', express.static(fontsDir, {
  setHeaders: (res) => {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  },
}));

app.get("/{*catchAll}", (_req, res) => {"""

# [2] admin-templates.css — @font-face das 13 familias
CSS_ANCHOR = "*, *::before, *::after { box-sizing: border-box; }"
FONTS = [
    ("Taviraj Light",              "Taviraj-Light.woff2",           "woff2"),
    ("Nunito Sans Light",          "NunitoSans-Light.woff2",        "woff2"),
    ("Ivy Journal Thin",           "IvyJournal-Thin.ttf",           "truetype"),
    ("Ivy Journal Light",          "IvyJournal-Light.ttf",          "truetype"),
    ("Ivy Journal Regular",        "IvyJournal-Regular.ttf",        "truetype"),
    ("Ivy Journal SemiBold",       "IvyJournal-SemiBold.ttf",       "truetype"),
    ("Ivy Journal Bold",           "IvyJournal-Bold.ttf",           "truetype"),
    ("Roobert PRO TRIAL Light",    "RoobertPROTRIAL-Light.otf",     "opentype"),
    ("Roobert PRO TRIAL Regular",  "RoobertPROTRIAL-Regular.otf",   "opentype"),
    ("Roobert PRO TRIAL Medium",   "RoobertPROTRIAL-Medium.otf",    "opentype"),
    ("Roobert PRO TRIAL SemiBold", "RoobertPROTRIAL-SemiBold.otf",  "opentype"),
    ("Roobert PRO TRIAL Bold",     "RoobertPROTRIAL-Bold.otf",      "opentype"),
    ("Roobert PRO TRIAL Heavy",    "RoobertPROTRIAL-Heavy.otf",     "opentype"),
]

def _fontface_block():
    lines = ["/* Fontes premium servidas de /fonts (assets/fonts) - WYSIWYG no preview do editor */"]
    for family, file, fmt in FONTS:
        lines.append(
            "@font-face { font-family: '%s'; src: url('/fonts/%s') format('%s'); font-display: swap; }"
            % (family, file, fmt)
        )
    return "\n".join(lines)


def main():
    if APP is None or CSS is None:
        sys.exit("ABORTADO: src/app.ts e/ou public/admin-templates.css nao encontrados.")

    app = io.open(APP, encoding="utf-8").read()
    if "../assets/fonts" in app:
        print("[app] JA APLICADO — rota /fonts presente.")
    elif APP_OLD not in app:
        print("[app] ATENCAO — ancora do static/catch-all nao casou (verifique manualmente).")
    else:
        bp = APP + ".bak-fonts"
        if not os.path.exists(bp):
            io.open(bp, "w", encoding="utf-8").write(app)
        app = apply_once(app, APP_OLD, APP_NEW, "app fonts route")
        io.open(APP, "w", encoding="utf-8").write(app)
        print("[app] OK — /fonts servindo assets/fonts (backup: %s.bak-fonts)" % APP)

    css = io.open(CSS, encoding="utf-8").read()
    if "Fontes premium servidas de /fonts" in css:
        print("[css] JA APLICADO — @font-face presente.")
    elif CSS_ANCHOR not in css:
        print("[css] ATENCAO — ancora do box-sizing nao casou (verifique manualmente).")
    else:
        bp = CSS + ".bak-fonts"
        if not os.path.exists(bp):
            io.open(bp, "w", encoding="utf-8").write(css)
        css = apply_once(css, CSS_ANCHOR, _fontface_block() + "\n\n" + CSS_ANCHOR, "css fontface")
        io.open(CSS, "w", encoding="utf-8").write(css)
        print("[css] OK — 13 @font-face declaradas (backup: %s.bak-fonts)" % CSS)

    print("\nConcluido. Stop -> Run no Replit do Hub. Confira em /fonts/Taviraj-Light.woff2 se abre.")


if __name__ == "__main__":
    main()

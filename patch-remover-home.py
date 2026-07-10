#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Remove a "Home" (index.html):
  * shell.js: tira o item Home do dropdown do header E da sidebar.
  * app.ts: "/", "/index.html" e rotas desconhecidas passam a redirecionar
    para /solicitacoes.html (a nova landing). O login ja apontava pra la.

Alvos: public/shell.js + src/app.ts. Idempotente, backups .bak-home.
"""
import io, os, sys

def _resolve(cands):
    for c in cands:
        p = os.path.normpath(c)
        if os.path.exists(p): return p
    return None

SHELL = _resolve(["artifacts/api-server/public/shell.js", "public/shell.js"])
APP   = _resolve(["artifacts/api-server/src/app.ts", "src/app.ts"])


def remove_dropdown_home(src):
    marker = '<a href="/index.html" class="app-dropdown-item">'
    i = src.index(marker)
    line_start = src.rfind("\n", 0, i) + 1
    end = src.index("</a>", i) + len("</a>")
    if end < len(src) and src[end] == "\n":
        end += 1
    return src[:line_start] + src[end:]


def remove_sidebar_home(src):
    r = src.index("route: 'home',")
    brace = src.rfind("{", 0, r)
    obj_start = src.rfind("\n", 0, brace) + 1
    obj_end = src.index("},", r) + len("},")
    if obj_end < len(src) and src[obj_end] == "\n":
        obj_end += 1
    return src[:obj_start] + src[obj_end:]


def main():
    if SHELL is None or APP is None:
        sys.exit("ABORTADO: shell.js e/ou app.ts nao encontrados.")

    # ---- shell.js ----
    s = io.open(SHELL, encoding="utf-8").read()
    if '<a href="/index.html" class="app-dropdown-item">' not in s and "route: 'home'," not in s:
        print("[shell] JA APLICADO.")
    else:
        bp = SHELL + ".bak-home"
        if not os.path.exists(bp): io.open(bp, "w", encoding="utf-8").write(s)
        if '<a href="/index.html" class="app-dropdown-item">' in s:
            s = remove_dropdown_home(s)
        if "route: 'home'," in s:
            s = remove_sidebar_home(s)
        io.open(SHELL, "w", encoding="utf-8").write(s)
        print("[shell] OK — Home removida do dropdown e da sidebar (backup .bak-home)")

    # ---- app.ts ----
    a = io.open(APP, encoding="utf-8").read()
    if 'res.redirect("/solicitacoes.html")' in a and 'app.get(["/", "/index.html"]' in a:
        print("[app] JA APLICADO.")
    else:
        bp = APP + ".bak-home"
        if not os.path.exists(bp): io.open(bp, "w", encoding="utf-8").write(a)
        # (1) redirect de "/" e "/index.html" ANTES do static
        old1 = "app.use(express.static(publicDir, {"
        new1 = ('// "Home" (index.html) descontinuada — a landing e a pagina de solicitacoes.\n'
                'app.get(["/", "/index.html"], (_req, res) => res.redirect("/solicitacoes.html"));\n'
                'app.use(express.static(publicDir, {')
        if a.count(old1) != 1:
            sys.exit("ABORTADO [app static]: ancora %d vezes." % a.count(old1))
        a = a.replace(old1, new1, 1)
        # (2) catch-all passa a redirecionar
        old2 = 'res.sendFile(path.join(publicDir, "index.html"));'
        new2 = 'res.redirect("/solicitacoes.html");'
        if a.count(old2) != 1:
            sys.exit("ABORTADO [app catch-all]: ancora %d vezes." % a.count(old2))
        a = a.replace(old2, new2, 1)
        io.open(APP, "w", encoding="utf-8").write(a)
        print("[app] OK — landing = /solicitacoes.html (backup .bak-home)")

    print("\nStop -> Run no Replit do Hub.")


if __name__ == "__main__":
    main()

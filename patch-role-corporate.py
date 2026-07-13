#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Registra a role "corporate" e monta a area Corporate:
  * routes/index.ts  -> monta corporateRouter
  * public/shell.js  -> item de menu "Convites" (roles: corporate, admin)
  * public/admin.html-> role Corporate no dropdown, labels e cores da tabela de usuarios

Requer routes/corporate.ts ja colocado em src/routes/.
Idempotente, backups .bak-corporate.
"""
import io, os, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
IDX=_r(["artifacts/api-server/src/routes/index.ts","src/routes/index.ts"])
SHELL=_r(["artifacts/api-server/public/shell.js","public/shell.js"])
ADMIN=_r(["artifacts/api-server/public/admin-usuarios.html","public/admin-usuarios.html"])
if not all([IDX,SHELL,ADMIN]): sys.exit("arquivos nao encontrados")

def once(s, old, new, label):
    if s.count(old)!=1: sys.exit("ABORTADO [%s]: ancora %d vezes"%(label, s.count(old)))
    return s.replace(old,new,1)

# ── 1) routes/index.ts ────────────────────────────────────────────
idx=io.open(IDX,encoding="utf-8").read()
if './corporate' in idx:
    print("[index.ts] JA APLICADO.")
else:
    idx2=once(idx,
        'import adminStatsRouter from "./admin-stats";',
        'import adminStatsRouter from "./admin-stats";\nimport corporateRouter from "./corporate";',
        "index import")
    idx2=once(idx2,
        'router.use(adminStatsRouter);',
        'router.use(adminStatsRouter);\nrouter.use(corporateRouter);',
        "index mount")
    bp=IDX+".bak-corporate"
    if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(idx)
    io.open(IDX,"w",encoding="utf-8").write(idx2)
    print("[index.ts] OK — corporateRouter montado")

# ── 2) shell.js: item de menu ─────────────────────────────────────
sh=io.open(SHELL,encoding="utf-8").read()
if "'convite-corporate'" in sh or 'convite-corporate' in sh:
    print("[shell.js] JA APLICADO.")
else:
    ANCHOR = """      {
        route: 'capital-humano',"""
    NEW = """      {
        route: 'convite-corporate',
        href: '/convite-corporate.html',
        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 6L2 7"/></svg>',
        label: 'Convites',
        roles: ['admin', 'corporate'],
      },
      {
        route: 'capital-humano',"""
    sh2=once(sh, ANCHOR, NEW, "shell nav")
    bp=SHELL+".bak-corporate"
    if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(sh)
    io.open(SHELL,"w",encoding="utf-8").write(sh2)
    print("[shell.js] OK — item 'Convites' adicionado")

# ── 3) admin.html: role no dropdown + labels/cores ────────────────
ad=io.open(ADMIN,encoding="utf-8").read()
if "corporate: 'Corporate'" in ad:
    print("[admin-usuarios.html] JA APLICADO.")
else:
    ad2=ad
    # labels
    ad2=once(ad2,
        """    const ROLE_LABELS = {
      capital_humano: 'Capital Humano',""",
        """    const ROLE_LABELS = {
      capital_humano: 'Capital Humano',
      corporate: 'Corporate',""",
        "ROLE_LABELS")
    # cores
    ad2=once(ad2,
        """    const ROLE_COLORS = {
      capital_humano: 'rgba(99,102,241,0.1);color:#4f46e5',""",
        """    const ROLE_COLORS = {
      capital_humano: 'rgba(99,102,241,0.1);color:#4f46e5',
      corporate: 'rgba(111,135,123,0.12);color:var(--sage-green)',""",
        "ROLE_COLORS")
    # ordem de agrupamento
    ad2=once(ad2,
        "const ROLE_ORDER = ['admin', 'gestor', 'capital_humano'];",
        "const ROLE_ORDER = ['admin', 'gestor', 'capital_humano', 'corporate'];",
        "ROLE_ORDER")
    # selects de role (2 ocorrencias: filtro + edicao inline)
    n_sel = ad2.count('<option value="capital_humano">Capital Humano</option>')
    if n_sel == 0: sys.exit("ABORTADO: option capital_humano nao encontrada")
    ad2 = ad2.replace(
        '<option value="capital_humano">Capital Humano</option>',
        '<option value="capital_humano">Capital Humano</option>\n                <option value="corporate">Corporate</option>',
    )
    bp=ADMIN+".bak-corporate"
    if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(ad)
    io.open(ADMIN,"w",encoding="utf-8").write(ad2)
    print("[admin-usuarios.html] OK — role Corporate (%d select(s), labels, cores, ordem)"%n_sel)

print("\nColoque convite-corporate.html/.js em public/ e rode: bash check.sh")

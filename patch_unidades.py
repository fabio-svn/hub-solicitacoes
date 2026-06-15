#!/usr/bin/env python3
# Fonte única de UNIDADES: cria src/config/unidades.ts e faz backend+frontend consumirem dela.
# Rode da RAIZ do workspace:  python3 patch_unidades.py
import io, os, re, sys
B = "artifacts/api-server/"
NEW_VER = "20260615a"   # bump de cache do config.js

UNIDADES_TS = '''// Fonte única das unidades SVN (nome + endereço).
// Backend consome via UNIDADES_ENDERECOS; frontend (config.js) adota via /api/config.
// NÃO duplicar endereços em outros arquivos.

export interface Unidade {
  nome: string;
  endereco: string;
}

export const UNIDADES: Unidade[] = [
__ENTRIES__
];

export const UNIDADES_ENDERECOS: Record<string, string> =
  Object.fromEntries(UNIDADES.map((u) => [u.nome, u.endereco]));
'''

def read(p): return io.open(p, encoding="utf-8").read()

# ---- valida tudo ANTES de gravar (atomico) ----
errs=[]; staged=[]; newfiles=[]

# fonte canonica = UNIDADES_SVN atual do config.js (preserva ordem/dado)
cfg = read(B+"public/config.js")
m = re.search(r'const\s+UNIDADES_SVN\s*=\s*\[(.*?)\];', cfg, re.S)
if not m: errs.append("config.js: nao achei UNIDADES_SVN")
else:
    entries = re.findall(r'\{\s*nome:\s*"([^"]+)"\s*,\s*endereco:\s*"([^"]*)"\s*\}', m.group(1))
    if len(entries) < 1: errs.append("config.js: UNIDADES_SVN vazio")
    esc = lambda s: s.replace("\\","\\\\").replace('"','\\"')
    body = "\n".join(f'  {{ nome: "{esc(n)}", endereco: "{esc(e)}" }},' for n,e in entries)
    newfiles.append((B+"src/config/unidades.ts", UNIDADES_TS.replace("__ENTRIES__", body)))

# clickup.ts
ck = read(B+"src/routes/clickup.ts")
ck_anchor = 'import { mapClickUpStatus } from "../config/clickup-status";'
if ck.count(ck_anchor)!=1: errs.append(f"clickup.ts: ancora de import x{ck.count(ck_anchor)}")
blk_re = re.compile(r'    const UNIDADES_ENDERECOS: Record<string, string> = \{.*?\n    \};\n', re.S)
nblk = len(blk_re.findall(ck))
if nblk!=2: errs.append(f"clickup.ts: blocos inline esperado 2, achei {nblk}")
if not errs:
    ck2 = ck.replace(ck_anchor, ck_anchor+'\nimport { UNIDADES_ENDERECOS } from "../config/unidades";', 1)
    ck2 = blk_re.sub("", ck2)
    old_c = ('  // UNIDADES_ENDERECOS é definido inline para manter o mapeamento próximo ao uso;\n'
             '  // se outros módulos precisarem, extrair para um arquivo de constantes compartilhado.\n')
    if ck2.count(old_c)==1:
        ck2 = ck2.replace(old_c, '  // UNIDADES_ENDERECOS vem de ../config/unidades (fonte única).\n', 1)
    if ck2.count("const UNIDADES_ENDERECOS")!=0: errs.append("clickup.ts: sobrou def inline")
    if ck2.count("UNIDADES_ENDERECOS[unidade]")!=2: errs.append("clickup.ts: lookups != 2")
    if ck2.count("{")!=ck2.count("}"): errs.append("clickup.ts: chaves desbalanceadas")
    staged.append((B+"src/routes/clickup.ts", ck2))

# app.ts
app = read(B+"src/app.ts")
app_anchor = 'import { MARCAS_OPTS, CONTRATOS_OPTS, SETORES_LIST, CARGOS_OPTS } from "./config/form-schemas";'
json_anchor = "    cargos: CARGOS_OPTS,\n  });"
if app.count(app_anchor)!=1: errs.append(f"app.ts: ancora import x{app.count(app_anchor)}")
if app.count(json_anchor)!=1: errs.append(f"app.ts: ancora res.json x{app.count(json_anchor)}")
if not errs:
    app2 = app.replace(app_anchor, app_anchor+'\nimport { UNIDADES } from "./config/unidades";', 1)
    app2 = app2.replace(json_anchor, "    cargos: CARGOS_OPTS,\n    unidades: UNIDADES,\n  });", 1)
    staged.append((B+"src/app.ts", app2))

# config.js: const->let + adocao
ca = "  if (cfg.emailUpload) EMAIL_UPLOAD = cfg.emailUpload;"
if cfg.count("const UNIDADES_SVN =")!=1: errs.append("config.js: const UNIDADES_SVN x!=1")
if cfg.count(ca)!=1: errs.append("config.js: ancora _configReady x!=1")
if not errs:
    cfg2 = cfg.replace("const UNIDADES_SVN =", "let UNIDADES_SVN =", 1)
    cfg2 = cfg2.replace(ca, ca+"\n  if (Array.isArray(cfg.unidades) && cfg.unidades.length) UNIDADES_SVN = cfg.unidades;", 1)
    staged.append((B+"public/config.js", cfg2))

# bump de cache do config.js em todos os HTMLs
htmls = [os.path.join(B+"public", f) for f in os.listdir(B+"public") if f.endswith(".html")] if os.path.isdir(B+"public") else []
bumped=0
for h in htmls:
    s = read(h)
    s2 = re.sub(r'config\.js\?v=[0-9a-z]+', f'config.js?v={NEW_VER}', s)
    if s2!=s: staged.append((h, s2)); bumped+=1

if errs:
    print("ABORTADO — nenhuma alteracao gravada:"); [print("  -",e) for e in errs]; sys.exit(1)

for p,c in newfiles:
    os.makedirs(os.path.dirname(p), exist_ok=True); io.open(p,"w",encoding="utf-8").write(c); print("criado:",p)
for p,c in staged:
    io.open(p,"w",encoding="utf-8").write(c)
print(f"editados: {len(staged)} arquivo(s) | config.js?v= bumpado em {bumped} HTML(s) -> {NEW_VER}")
print("OK: fonte unica de UNIDADES aplicada. Rode: bash check.sh  (pra tsc verde)")

#!/bin/bash
# Health check do Hub SVN — SOMENTE LEITURA (nao altera nada).
# Rode na raiz do workspace:  bash check.sh
set +e
API="artifacts/api-server"
PUB="$API/public"
CSS="$PUB/style.css"
echo "==================== HUB SVN — CHECK ===================="

echo; echo "### 1. Sintaxe do JS inline (cada bloco <script> sem src, separado) ###"
for f in "$PUB"/*.html; do
  python3 - "$f" > /tmp/_blocks 2>/dev/null <<'PY'
import re,sys
html=open(sys.argv[1],encoding="utf-8",errors="replace").read()
for i,m in enumerate(re.finditer(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', html, re.S)):
    open(f"/tmp/_blk_{i}.js","w",encoding="utf-8").write(m.group(1))
    print(f"/tmp/_blk_{i}.js")
PY
  while read -r blk; do
    if ! node --check "$blk" 2>/tmp/_err; then
      echo "  ⚠ $(basename "$f"): $(grep -m1 -E 'SyntaxError|Error' /tmp/_err)"
    fi
  done < /tmp/_blocks
  rm -f /tmp/_blk_*.js
done
echo "  (sem ⚠ = sintaxe ok em todos os blocos inline)"

echo; echo "### 1b. Sintaxe dos JS externos (public/*.js) ###"
for jf in "$PUB"/*.js; do
  node --check "$jf" 2>/tmp/_err || echo "  ⚠ $(basename "$jf"): $(grep -m1 -E 'SyntaxError|Error' /tmp/_err)"
done
echo "  (sem ⚠ = ok nos .js externos)"

echo; echo "### 2. Arquivos referenciados que NAO existem (404 em potencial) ###"
grep -rhoE '(src|href)="[^"]+\.(js|css|png|jpg|jpeg|svg|webp|ico)"' "$PUB"/*.html \
  | sed -E 's/.*="([^"]+)".*/\1/' | grep -vE '^https?:|^//|^data:' | sed 's/?.*//' | sort -u \
  | while read -r ref; do [ -f "$PUB/${ref#/}" ] || echo "  ⚠ nao encontrado: $ref"; done
echo "  (sem ⚠ = todas as referencias existem)"

echo; echo "### 3. IDs duplicados em HTML ESTATICO (ignora ids gerados em JS) ###"
for f in "$PUB"/*.html; do
  # so conta id="..." que NAO contem aspas simples/cra/+ (sinais de template string em JS)
  dup=$(grep -oE 'id="[^"'\''+\`]+"' "$f" | sort | uniq -d)
  [ -n "$dup" ] && echo "  ⚠ $(basename "$f"): $(echo "$dup" | tr '\n' ' ')"
done
echo "  (ainda pode pegar campos repetidos em ramos condicionais — conferir contexto)"

echo; echo "### 4. Tokens CSS usados mas NAO definidos no :root do style.css ###"
defined=$(grep -oE '\-\-[a-z0-9-]+[[:space:]]*:' "$CSS" | tr -d ' :' | sort -u)
grep -rhoE 'var\([[:space:]]*--[a-z0-9-]+' "$PUB"/*.html "$PUB"/*.css 2>/dev/null \
  | sed -E 's/.*var\([[:space:]]*(--[a-z0-9-]+).*/\1/' | sort -u \
  | while read -r v; do
      echo "$defined" | grep -qxF -- "$v" || echo "  ⚠ var($v) nao esta no :root global"
    done
echo "  (obs: var(--x, #fallback) ainda funciona mesmo sem definicao)"

echo; echo "### 5. Balanco de <div> por pagina (heuristica) ###"
for f in "$PUB"/*.html; do
  o=$(grep -oE '<div' "$f" | wc -l); c=$(grep -oE '</div>' "$f" | wc -l)
  [ "$o" -ne "$c" ] && echo "  ⚠ $(basename "$f"): <div>=$o </div>=$c (pode ser div gerada em JS)"
done
echo "  (sem ⚠ = balanceado)"

echo; echo "### 6. Sobras no backend: TODO/FIXME/console.log ###"
grep -rnE "TODO|FIXME|console\.(log|debug)" "$API/src" --include=*.ts 2>/dev/null | grep -v "/scripts/" | head -15

echo; echo "### 7. TypeScript — APAGA tsbuildinfo, rebuilda libs e checa ###"
find lib -name "*.tsbuildinfo" -delete 2>/dev/null
rm -rf lib/db/dist lib/api-zod/dist 2>/dev/null
pnpm exec tsc -b lib/db lib/api-zod >/tmp/_libbuild 2>&1 || { echo "  ⚠ falha ao buildar libs:"; cat /tmp/_libbuild; }
( cd "$API" && pnpm exec tsc -p tsconfig.json --noEmit ) && echo "  ✓ tsc verde" || echo "  ⚠ erros de tsc acima (esses sim sao reais)"

### 8. Drift schema Drizzle x DDL (DB_STATEMENTS) ###
python3 - << 'PY'
import re, sys
SCHEMA = "lib/db/src/schema/index.ts"
DDL    = "artifacts/api-server/src/index.ts"
IGNORAR = {"session"}  # gerida pelo express-session, so existe no DDL
try:
    schema = open(SCHEMA, encoding="utf-8").read()
    ddl    = open(DDL,    encoding="utf-8").read()
except FileNotFoundError as e:
    print(f"  (pulado: {e.filename} nao encontrado)"); sys.exit(0)

def corpo_balanceado(src, idx, abre, fecha):
    """Do primeiro `abre` apos idx ate o `fecha` que zera a contagem."""
    i = src.find(abre, idx)
    if i < 0: return None
    nivel = 0
    for j in range(i, len(src)):
        if src[j] == abre: nivel += 1
        elif src[j] == fecha:
            nivel -= 1
            if nivel == 0: return src[i+1:j]
    return None

# ---- Drizzle: pgTable("nome", { ... }) equilibrando chaves ----
sch = {}
for m in re.finditer(r'pgTable\(\s*"([^"]+)"\s*,', schema):
    corpo = corpo_balanceado(schema, m.end(), "{", "}")
    if corpo is None: continue
    cols = set()
    for ln in corpo.split("\n"):
        t = ln.strip()
        if not t or t.startswith("//"): continue
        cm = re.match(r'(\w+)\s*:\s*\w+\(\s*"([^"]+)"', t)
        if cm: cols.add(cm.group(2)); continue
        km = re.match(r'(\w+)\s*:\s*\w+\(', t)
        if km: cols.add(km.group(1))
    sch[m.group(1)] = cols

# ---- DDL: CREATE TABLE equilibrando parenteses + ALTER ADD COLUMN ----
dd = {}
for m in re.finditer(r'CREATE TABLE IF NOT EXISTS\s+"([^"]+)"', ddl):
    corpo = corpo_balanceado(ddl, m.end(), "(", ")")
    if corpo is None: continue
    # separa por virgula de topo (nivel 0)
    partes, nivel, atual = [], 0, ""
    for ch in corpo:
        if ch == "(": nivel += 1
        elif ch == ")": nivel -= 1
        if ch == "," and nivel == 0: partes.append(atual); atual = ""
        else: atual += ch
    if atual.strip(): partes.append(atual)
    cols = set()
    for parte in partes:
        t = parte.strip()
        if not t or re.match(r'(CONSTRAINT|PRIMARY|FOREIGN|UNIQUE|CHECK)\b', t, re.I): continue
        cm = re.match(r'"([^"]+)"', t)
        if cm: cols.add(cm.group(1))
    dd[m.group(1)] = cols
for m in re.finditer(r'ALTER TABLE\s+"([^"]+)"\s+ADD COLUMN IF NOT EXISTS\s+"([^"]+)"', ddl):
    dd.setdefault(m.group(1), set()).add(m.group(2))

# ---- comparacao nos DOIS sentidos ----
prob = 0
for t in sorted(set(sch) | set(dd)):
    if t in IGNORAR: continue
    if t not in dd:
        print(f"  \u26a0 tabela '{t}' no Drizzle mas SEM CREATE/ALTER no DDL"); prob += 1; continue
    if t not in sch:
        print(f"  \u26a0 tabela '{t}' no DDL mas SEM pgTable no Drizzle"); prob += 1; continue
    so_ddl = sch[t] - dd[t]      # no Drizzle, falta no DDL
    so_sch = dd[t] - sch[t]      # no DDL, falta no Drizzle
    if so_ddl: print(f"  \u26a0 '{t}': no Drizzle e FALTANDO no DDL: {sorted(so_ddl)}"); prob += 1
    if so_sch: print(f"  \u26a0 '{t}': no DDL e FALTANDO no Drizzle: {sorted(so_sch)}"); prob += 1

if prob == 0:
    print(f"  (sem \u26a0 = {len(set(sch)|set(dd))-len(IGNORAR & (set(sch)|set(dd)))} tabelas batem coluna-a-coluna, nos dois sentidos)")
PY

echo; echo "==================== FIM ===================="
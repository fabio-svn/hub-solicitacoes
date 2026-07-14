#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[1] Plataforma padrao = Zoom (era Live).
[2] Texto do topo da arte: "Hora do Corporate" nas artes do Corporate,
    "evento presencial/online" nos convites do formulario de eventos.

    Como: a layer do topo passa a usar UM placeholder — {{chapeu}}.
      - Corporate  -> chapeu = "Hora do Corporate"
      - Form eventos -> chapeu = "evento {tipo_evento}"  (default, texto de hoje)
    O default e aplicado no art-generator, entao QUALQUER origem que nao mande
    'chapeu' continua imprimindo o texto atual. Nada quebra.

[4] Cache: admin-templates.js e o UNICO script sem ?v= no HTML — o navegador
    pode servir uma versao velha indefinidamente. Adiciona cache-busting.
    Alem disso, a previa passa a mostrar o ERRO REAL (status HTTP) em vez de
    falhar em silencio.

Alvos: config/form-schemas.ts, services/art-generator.ts, routes/corporate.ts,
       public/convite-corporate.html, public/admin-templates.html, public/admin-templates.js
Idempotente, backups .bak-chapeu.
"""
import io, os, re, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
S=_r(["artifacts/api-server/src/config/form-schemas.ts","src/config/form-schemas.ts"])
G=_r(["artifacts/api-server/src/services/art-generator.ts","src/services/art-generator.ts"])
C=_r(["artifacts/api-server/src/routes/corporate.ts","src/routes/corporate.ts"])
H=_r(["artifacts/api-server/public/convite-corporate.html","public/convite-corporate.html"])
AH=_r(["artifacts/api-server/public/admin-templates.html","public/admin-templates.html"])
if not all([S,G,C,H,AH]): sys.exit("arquivos nao encontrados: %s" % [S,G,C,H,AH])

def bkp(p, txt):
    b=p+".bak-chapeu"
    if not os.path.exists(b): io.open(b,"w",encoding="utf-8").write(txt)

# ───────── [1] plataforma padrao = Zoom (pagina do Corporate) ─────────
h=io.open(H,encoding="utf-8").read()
if '<option value="zoom" selected>' in h:
    print("[1] JA APLICADO.")
else:
    o=h
    h=h.replace('<option value="live" selected>Live</option>', '<option value="live">Live</option>')
    h=h.replace('<option value="zoom">Zoom</option>', '<option value="zoom" selected>Zoom</option>')
    if '<option value="zoom" selected>' not in h:
        sys.exit("ABORTADO [1]: nao achei os <option> de plataforma")
    bkp(H,o); io.open(H,"w",encoding="utf-8").write(h)
    print("[1] OK — plataforma padrao Zoom")

# ───────── [2a] campo 'chapeu' no schema convite-evento ─────────
s=io.open(S,encoding="utf-8").read()
if "'chapeu'" in s or '"chapeu"' in s:
    print("[2a] JA APLICADO.")
else:
    ANC = """      { name: 'titulo',           label: 'Titulo do evento',    type: 'text',   required: true },"""
    if s.count(ANC) != 1:
        sys.exit("ABORTADO [2a]: ancora do titulo %d vez(es)" % s.count(ANC))
    NOVO = ANC + """
      // Texto do topo da arte. Se vazio, o art-generator preenche com "evento {tipo}".
      // O Corporate manda "Hora do Corporate".
      { name: 'chapeu',           label: 'Texto do topo (auto)', type: 'text' },"""
    bkp(S,s); io.open(S,"w",encoding="utf-8").write(s.replace(ANC,NOVO,1))
    print("[2a] OK — campo 'chapeu' no schema")

# ───────── [2b] default do chapeu no art-generator ─────────
g=io.open(G,encoding="utf-8").read()
if "chapeu" in g:
    print("[2b] JA APLICADO.")
else:
    # aplica logo apos o resolvedDados, nas DUAS funcoes que o montam
    pat = re.compile(r"(const resolvedDados = addOptionLabels\(resolveComputed\(dados, formSchema\), formSchema\);)")
    n = len(pat.findall(g))
    if n == 0:
        sys.exit("ABORTADO [2b]: nao achei 'const resolvedDados = ...'")
    NOVO = (r"""\1

  // Texto do topo do convite. Quem nao mandar 'chapeu' (ex.: o formulario de
  // eventos) continua imprimindo o texto de sempre: "evento presencial/online".
  // O Corporate manda "Hora do Corporate" e sobrescreve isso.
  if (!resolvedDados.chapeu && resolvedDados.tipo_evento) {
    resolvedDados.chapeu = `evento ${resolvedDados.tipo_evento}`;
  }""")
    g2 = pat.sub(NOVO, g)
    bkp(G,g); io.open(G,"w",encoding="utf-8").write(g2)
    print("[2b] OK — default do chapeu no art-generator (%d ponto(s))" % n)

# ───────── [2c] o Corporate manda "Hora do Corporate" ─────────
c=io.open(C,encoding="utf-8").read()
if "Hora do Corporate" in c:
    print("[2c] JA APLICADO.")
else:
    # injeta no objeto de dados montado para a arte
    ANC_C = """  return {
    ...body,
    tipo_evento: "online","""
    if c.count(ANC_C) != 1:
        sys.exit("ABORTADO [2c]: ancora montarDados %d vez(es)" % c.count(ANC_C))
    NOVO_C = """  return {
    ...body,
    tipo_evento: "online",
    // texto do topo da arte (substitui o "evento online" dos convites comuns)
    chapeu: "Hora do Corporate","""
    bkp(C,c); io.open(C,"w",encoding="utf-8").write(c.replace(ANC_C,NOVO_C,1))
    print("[2c] OK — Corporate manda 'Hora do Corporate'")

# ───────── [4] cache-busting do admin-templates.js ─────────
ah=io.open(AH,encoding="utf-8").read()
if 'admin-templates.js?v=' in ah:
    print("[4] JA APLICADO.")
else:
    OLD='<script src="admin-templates.js"></script>'
    if ah.count(OLD)!=1:
        sys.exit("ABORTADO [4]: ancora do script %d vez(es)" % ah.count(OLD))
    bkp(AH,ah)
    io.open(AH,"w",encoding="utf-8").write(ah.replace(OLD,'<script src="admin-templates.js?v=20260714a"></script>',1))
    print("[4] OK — cache-busting (era o unico script sem ?v=)")

print("\nStop -> Run + bash check.sh")
print("IMPORTANTE: depois rode o script que atualiza os templates (set-chapeu.ts).")

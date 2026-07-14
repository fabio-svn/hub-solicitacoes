#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
[1] Etapa "Concluído" na validacao de assessores.
    A infra JA existia (a tabela tem publicado_por/publicado_em e o front ja tinha o
    status 'publicado') — so nunca foi ligada. Agora o backend aceita a decisao
    "publicado" (somente a partir de "aprovado") e o front ganha o botao.

[2] Codigo do assessor: prefixo "A" fixo, campo aceita so digitos -> sai "A12345".

[3] O resumo do pedido passa a mostrar o status DA PAGINA (nao o do ClickUp)
    nos tipos de assessor: novo fluxo no config.js + GET /solicitacoes/:id
    devolvendo o status de assessor_publicacoes.

Idempotente, backups .bak-assfluxo.
"""
import io, os, re, sys, glob

def _r(cs):
    for c in cs:
        p = os.path.normpath(c)
        if os.path.exists(p):
            return p
    return None

CFG = _r(["artifacts/api-server/public/config.js", "public/config.js"])
VAL = _r(["artifacts/api-server/public/validacao-assessores.html", "public/validacao-assessores.html"])
FPA = _r(["artifacts/api-server/public/form-pagina-assessores.html", "public/form-pagina-assessores.html"])
FCF = _r(["artifacts/api-server/public/form-convite-fp.html", "public/form-convite-fp.html"])

ROTAS = glob.glob("artifacts/api-server/src/routes/*.ts") + glob.glob("src/routes/*.ts")
def acha(trecho):
    for p in ROTAS:
        if trecho in io.open(p, encoding="utf-8").read():
            return p
    return None
APR = acha('assessor-aprovacoes/:id/decisao')
SOL = acha('router.get("/solicitacoes/:id"')

falta = [n for n, v in [("config.js", CFG), ("validacao-assessores.html", VAL),
                        ("form-pagina-assessores.html", FPA), ("form-convite-fp.html", FCF),
                        ("rota da decisao", APR), ("rota solicitacoes/:id", SOL)] if not v]
if falta:
    sys.exit("nao encontrei: " + ", ".join(falta))

def salvar(p, antes, depois, tag):
    b = p + ".bak-assfluxo"
    if not os.path.exists(b):
        io.open(b, "w", encoding="utf-8").write(antes)
    io.open(p, "w", encoding="utf-8").write(depois)
    print(tag)

# ══════════ [3a] config.js: fluxo proprio dos tipos de assessor ══════════
c = io.open(CFG, encoding="utf-8").read()
if '"pagina-assessores-dados"' in c:
    print("[3a] JA APLICADO.")
else:
    ANC = "const FLUXOS_ETAPAS = {\n"
    if c.count(ANC) != 1:
        sys.exit("ABORTADO [3a]: ancora FLUXOS_ETAPAS")
    ETAPAS = (
        '  { id: "aguardando-validacao", label: "Aguardando validação", visivel: true  },\n'
        '    { id: "aprovado",             label: "Aprovado",             visivel: true  },\n'
        '    { id: "publicado",            label: "Concluído",            visivel: true  },\n'
        '    { id: "ajustes-solicitados",  label: "Ajustes solicitados",  visivel: false },\n'
        '    { id: "reprovado",            label: "Reprovado",            visivel: false },\n'
    )
    NOVO = (
        "const FLUXOS_ETAPAS = {\n"
        "  // Paginas de assessor nao seguem o ClickUp: quem manda e a validacao do RH\n"
        "  // e a publicacao do marketing (tabela assessor_publicacoes).\n"
        '  "pagina-assessores-dados": [\n  ' + ETAPAS + "  ],\n"
        '  "pagina-assessores-atualizacao": [\n  ' + ETAPAS + "  ],\n"
    )
    salvar(CFG, c, c.replace(ANC, NOVO, 1), "[3a] OK — fluxo proprio das paginas de assessor")

# ══════════ [1a] backend: decisao "publicado" ══════════
a = io.open(APR, encoding="utf-8").read()
if 'publicado: "publicado"' in a:
    print("[1a] JA APLICADO.")
else:
    OLD = '    const MAP: Record<string, string> = { aprovado: "aprovado", ajustes: "ajustes-solicitados", reprovado: "reprovado" };'
    if a.count(OLD) != 1:
        sys.exit("ABORTADO [1a]: ancora do MAP")
    NEW = '    const MAP: Record<string, string> = { aprovado: "aprovado", ajustes: "ajustes-solicitados", reprovado: "reprovado", publicado: "publicado" };'
    a2 = a.replace(OLD, NEW, 1)

    OLD2 = '    if (novoStatus === "ajustes-solicitados") setFields.ciclo = (pub?.ciclo || 1) + 1;'
    if a2.count(OLD2) != 1:
        sys.exit("ABORTADO [1a]: ancora do ciclo")
    NEW2 = OLD2 + """

    // "Concluído" = publicado no site. So faz sentido depois de aprovado e nao e uma
    // decisao de validacao: nao mexe em decidido_por/decidido_em nem nos ajustes.
    if (novoStatus === "publicado") {
      if (!pub || pub.status !== "aprovado") {
        res.status(400).json({ error: "Só é possível concluir um perfil que está aprovado." });
        return;
      }
      delete setFields.decidido_por;
      delete setFields.decidido_em;
      delete setFields.ajustes;
      setFields.observacao = pub.observacao ?? null;
      setFields.publicado_por = u?.id ?? null;
      setFields.publicado_em = new Date();
    }"""
    a2 = a2.replace(OLD2, NEW2, 1)
    salvar(APR, a, a2, "[1a] OK — backend aceita a conclusao")

# ══════════ [3b] GET /solicitacoes/:id -> status da pagina ══════════
s = io.open(SOL, encoding="utf-8").read()
if "statusPagina" in s:
    print("[3b] JA APLICADO.")
else:
    OLD = "    const arquivos = await db.select().from(arquivosTable).where(eq(arquivosTable.solicitacao_id, id));"
    if s.count(OLD) < 1:
        sys.exit("ABORTADO [3b]: ancora dos arquivos")
    NEW = OLD + """

    // Paginas de assessor: o status que vale e o da validacao/publicacao, nao o do
    // ClickUp. Sobrescreve para o resumo do pedido nao mostrar uma etapa que nao existe.
    let statusPagina: string | null = null;
    if (["pagina-assessores-dados", "pagina-assessores-atualizacao"].includes(solicitacao.tipo_solicitacao)) {
      try {
        const [pubRow] = await db
          .select({ status: assessorPublicacoesTable.status })
          .from(assessorPublicacoesTable)
          .where(eq(assessorPublicacoesTable.solicitacao_id, id));
        statusPagina = pubRow?.status ?? "aguardando-validacao";
        (solicitacao as any).status = statusPagina;
      } catch { /* sem registro: mantem o status atual */ }
    }"""
    s2 = s.replace(OLD, NEW, 1)
    if "assessorPublicacoesTable" not in s2[: s2.find("\n\n", 200)] and "assessorPublicacoesTable" not in s2.split("async")[0]:
        m = re.search(r'import \{([^}]*)\} from "@workspace/db";', s2)
        if m and "assessorPublicacoesTable" not in m.group(1):
            novo_import = 'import {%s, assessorPublicacoesTable } from "@workspace/db";' % m.group(1).rstrip().rstrip(",")
            s2 = s2.replace(m.group(0), novo_import, 1)
    salvar(SOL, s, s2, "[3b] OK — resumo usa o status da pagina")

# ══════════ [1b] front: funil + botao concluir ══════════
v = io.open(VAL, encoding="utf-8").read()
if "Marcar como concluído" in v:
    print("[1b] JA APLICADO.")
else:
    v0 = v
    v = v.replace(
        "'publicado':            { label: 'Publicado',            bg: '#e5e7eb', fg: '#374151', accent: '#374151' },",
        "'publicado':            { label: 'Concluído',            bg: '#dcfce7', fg: '#14532d', accent: '#14532d' },")

    OLD_F = "    const FUNIL = ['todos', 'aguardando-validacao', 'ajustes-solicitados', 'aprovado', 'reprovado'];"
    if v.count(OLD_F) != 1:
        sys.exit("ABORTADO [1b]: ancora do FUNIL")
    v = v.replace(OLD_F,
        "    const FUNIL = ['todos', 'aguardando-validacao', 'ajustes-solicitados', 'aprovado', 'publicado', 'reprovado'];", 1)

    OLD_R = """      } else {
        rodape = '<div class="va-actions"><span class="sub" style="font-size:0.8rem;color:var(--ink-50)">Perfil já ' + (STATUS[resumo.status] ? STATUS[resumo.status].label.toLowerCase() : resumo.status) + '.</span></div>';
      }"""
    if v.count(OLD_R) != 1:
        sys.exit("ABORTADO [1b]: ancora do rodape")
    BTN = "'<button class=\"btn btn-primary\" onclick=\"decidir(&#39;publicado&#39;)\">Marcar como concluído</button>' +"
    NEW_R = """      } else if (resumo.status === 'aprovado') {
        // Aprovado = liberado para o marketing publicar. Concluído = já está no ar.
        rodape =
          '<div class="va-actions" style="align-items:center">' +
            '<span class="sub" style="font-size:0.8rem;color:var(--ink-50);margin-right:auto">Aprovado para publicação. Marque como concluído assim que a página estiver no ar.</span>' +
            """ + BTN + """
          '</div><div id="vaMsg" style="margin-top:10px;font-size:0.82rem"></div>';
      } else {
        rodape = '<div class="va-actions"><span class="sub" style="font-size:0.8rem;color:var(--ink-50)">Perfil já ' + (STATUS[resumo.status] ? STATUS[resumo.status].label.toLowerCase() : resumo.status) + '.</span></div>';
      }"""
    v = v.replace(OLD_R, NEW_R, 1)
    salvar(VAL, v0, v, "[1b] OK — botao 'Marcar como concluido' + funil")

# ══════════ [2] codigo do assessor: prefixo A, so digitos ══════════
CSS = """
    /* Codigo do assessor: o "A" e fixo; o usuario digita so os numeros */
    .cod-assessor { display: flex; align-items: stretch; }
    .cod-assessor-prefixo {
      display: flex; align-items: center; padding: 0 12px;
      border: 1px solid var(--border-light); border-right: 0;
      border-radius: var(--radius-md) 0 0 var(--radius-md);
      background: var(--icon-bg); color: var(--ink-60);
      font-weight: 600; font-size: 0.9rem;
    }
    .cod-assessor input { border-radius: 0 var(--radius-md) var(--radius-md) 0 !important; flex: 1; min-width: 0; }
  </style>"""

_ASPA = chr(34)
ONINPUT = 'oninput=' + _ASPA + "this.value = this.value.replace(/" + chr(92) + "D/g, '')" + _ASPA

def campo(html, antigo, required):
    if "cod-assessor" in html:
        return html
    if html.count(antigo) != 1:
        sys.exit("ABORTADO [2]: ancora do input nao encontrada")
    novo = (
        '<div class="cod-assessor">\n'
        '            <span class="cod-assessor-prefixo" aria-hidden="true">A</span>\n'
        '            <input type="text" id="codigoAssessor" inputmode="numeric" autocomplete="off"\n'
        '                   placeholder="12345" maxlength="10"' + (' required' if required else '') + '\n'
        '                   ' + ONINPUT + '>\n'
        '          </div>'
    )
    html = html.replace(antigo, novo, 1)
    if "</style>" in html:
        html = html.replace("  </style>", CSS, 1)
    return html

f1 = io.open(FPA, encoding="utf-8").read()
n1 = campo(f1, '<input type="text" id="codigoAssessor" placeholder="Código do assessor">', False)
if n1 != f1:
    salvar(FPA, f1, n1, "[2a] OK — form-pagina-assessores")
else:
    print("[2a] JA APLICADO.")

f2 = io.open(FCF, encoding="utf-8").read()
n2 = campo(f2, '<input type="text" id="codigoAssessor" placeholder="Ex: 12345" required>', True)
if n2 != f2:
    salvar(FCF, f2, n2, "[2b] OK — form-convite-fp")
else:
    print("[2b] JA APLICADO.")

print("\nStop -> Run + bash check.sh")
print("ATENCAO: falta prefixar o 'A' no ENVIO — ver patch-codigo-a.py")

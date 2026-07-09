#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Refactor dos endpoints de validacao de assessores (forms.ts).

  * Lista le de SOLICITACOES (tipos dados + atualizacao) com JOIN em
    assessor_publicacoes -> aparece TUDO (inclusive antigos, sem backfill).
  * Categoria: 'pagina' (dados + quer_pagina=sim), 'sem-pagina' (dados + nao),
    'atualizacao' (tipo atualizacao).
  * Detalhe e decisao passam a ser por SOLICITACAO_ID.
  * Decisao faz UPSERT da linha de aprovacao (cria se nao existe). 'sem-pagina'
    nao passa por aprovacao (so leitura). Remove o PATCH de edicao inline (nao usado).

Alvo: artifacts/api-server/src/routes/forms.ts. Idempotente, backup .bak-refactor.
"""
import io, os, sys

def _resolve(cands):
    for c in cands:
        p = os.path.normpath(c)
        if os.path.exists(p): return p
    return None

FORMS = _resolve(["artifacts/api-server/src/routes/forms.ts", "src/routes/forms.ts"])

START = "// ============ Página de Assessores — validação (Capital Humano) ============"
END_BEFORE = '\n\nrouter.put("/cartao-aprovacoes/:solicitacaoId", requireAuth'

NEW = '''// ============ Página de Assessores — validação (Capital Humano) ============
const ASSESSOR_ROLES = ["capital_humano", "gestor", "admin"];
const ASSESSOR_TIPOS = ["pagina-assessores-dados", "pagina-assessores-atualizacao"];

function assessorCategoria(sol: any, dados: any): string {
  if (sol.tipo_solicitacao === "pagina-assessores-atualizacao") return "atualizacao";
  return String(dados?.quer_pagina || "").toLowerCase() === "sim" ? "pagina" : "sem-pagina";
}
function assessorLinha(sol: any, pub: any) {
  const dados: any = (pub?.dados_publicacao || sol.dados) || {};
  const categoria = assessorCategoria(sol, dados);
  const status = pub ? pub.status : (categoria === "sem-pagina" ? "registrado" : "aguardando-validacao");
  return {
    solicitacao_id: sol.id,
    categoria,
    nome: (pub?.nome) || dados.nome_completo || dados.nome || "",
    codigo_assessor: (pub?.codigo_assessor) || dados.codigo_assessor || "",
    unidade: (pub?.unidade) || dados.unidade || "",
    contrato_social: (pub?.contrato_social) || dados.contrato_social || "",
    foto_url: (pub?.foto_url) || dados.foto_perfil || dados.fotoPerfil || "",
    status,
    ciclo: pub?.ciclo || 1,
    observacao: pub?.observacao ?? "",
    criado_em: sol.created_at,
    decidido_em: pub?.decidido_em ?? null,
  };
}

router.get("/assessor-aprovacoes", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (!ASSESSOR_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }
    const sols = await db.select().from(solicitacoesTable)
      .where(inArray(solicitacoesTable.tipo_solicitacao, ASSESSOR_TIPOS))
      .orderBy(desc(solicitacoesTable.created_at));
    const ids = sols.map(s => s.id);
    const pubs = ids.length
      ? await db.select().from(assessorPublicacoesTable).where(inArray(assessorPublicacoesTable.solicitacao_id, ids))
      : [];
    const mapa = new Map(pubs.map(p => [p.solicitacao_id, p]));
    const linhas = sols.map(s => assessorLinha(s, mapa.get(s.id)));
    res.json({ linhas });
  } catch (err) {
    logger.error({ err }, "Erro listando assessor-aprovacoes");
    res.status(500).json({ error: "Erro ao listar" });
  }
});

router.get("/assessor-aprovacoes/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (!ASSESSOR_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    if (!sol || !ASSESSOR_TIPOS.includes(sol.tipo_solicitacao)) { res.status(404).json({ error: "Não encontrado" }); return; }
    const [pub] = await db.select().from(assessorPublicacoesTable).where(eq(assessorPublicacoesTable.solicitacao_id, id));
    const dados: any = (pub?.dados_publicacao || sol.dados) || {};
    res.json({ resumo: assessorLinha(sol, pub), publicacao: pub || null, dados, original: sol.dados || {} });
  } catch (err) {
    logger.error({ err }, "Erro no detalhe de assessor-aprovacao");
    res.status(500).json({ error: "Erro ao buscar" });
  }
});

router.post("/assessor-aprovacoes/:id/decisao", requireAuth, async (req, res): Promise<void> => {
  try {
    const role = req.session.user!.role;
    if (!ASSESSOR_ROLES.includes(role)) { res.status(403).json({ error: "Sem permissão" }); return; }
    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const b = req.body || {};
    const MAP: Record<string, string> = { aprovado: "aprovado", ajustes: "ajustes-solicitados", reprovado: "reprovado" };
    const novoStatus = MAP[String(b.decisao || "")];
    if (!novoStatus) { res.status(400).json({ error: "Decisão inválida" }); return; }
    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    if (!sol || !ASSESSOR_TIPOS.includes(sol.tipo_solicitacao)) { res.status(404).json({ error: "Não encontrado" }); return; }
    const dados: any = sol.dados || {};
    if (assessorCategoria(sol, dados) === "sem-pagina") { res.status(400).json({ error: "Registro sem página não passa por aprovação." }); return; }

    const [pub] = await db.select().from(assessorPublicacoesTable).where(eq(assessorPublicacoesTable.solicitacao_id, id));
    const ajustes = Array.isArray(b.ajustes)
      ? b.ajustes.filter((a: any) => a && a.campo).map((a: any) => ({ campo: String(a.campo), comentario: String(a.comentario || "") }))
      : null;
    const [u] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, req.session.user!.email));
    const setFields: Record<string, unknown> = {
      status: novoStatus,
      observacao: typeof b.observacao === "string" ? b.observacao : (pub?.observacao ?? null),
      ajustes: novoStatus === "ajustes-solicitados" ? ajustes : null,
      decidido_por: u?.id ?? null,
      decidido_em: new Date(),
      atualizado_em: new Date(),
    };
    if (novoStatus === "ajustes-solicitados") setFields.ciclo = (pub?.ciclo || 1) + 1;

    if (pub) {
      await db.update(assessorPublicacoesTable).set(setFields).where(eq(assessorPublicacoesTable.solicitacao_id, id));
    } else {
      const dp: any = dados;
      await db.insert(assessorPublicacoesTable).values({
        solicitacao_id: id,
        nome: String(dp.nome_completo || dp.nome || "") || null,
        codigo_assessor: String(dp.codigo_assessor || "") || null,
        unidade: String(dp.unidade || "") || null,
        contrato_social: String(dp.contrato_social || "") || null,
        foto_url: String(dp.foto_perfil || dp.fotoPerfil || "") || null,
        dados_publicacao: dp,
        ...(setFields as any),
        ciclo: (setFields.ciclo as number) || 1,
      }).onConflictDoNothing({ target: assessorPublicacoesTable.solicitacao_id });
    }
    res.json({ ok: true, status: novoStatus });
  } catch (err) {
    logger.error({ err }, "Erro na decisão de assessor");
    res.status(500).json({ error: "Erro ao registrar decisão" });
  }
});'''


def main():
    if FORMS is None:
        sys.exit("ABORTADO: forms.ts nao encontrado.")
    src = io.open(FORMS, encoding="utf-8").read()
    if "ASSESSOR_TIPOS" in src:
        print("JA APLICADO — refactor presente.")
        return
    if START not in src or END_BEFORE not in src:
        sys.exit("ABORTADO: marcadores do bloco de assessor nao encontrados.")
    start = src.index(START)
    end = src.index(END_BEFORE, start)
    bp = FORMS + ".bak-refactor"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = src[:start] + NEW + src[end:]
    io.open(FORMS, "w", encoding="utf-8").write(src)
    print("OK — endpoints reescritos (backup: %s.bak-refactor)" % FORMS)
    print("Stop -> Run no Replit do Hub.")


if __name__ == "__main__":
    main()

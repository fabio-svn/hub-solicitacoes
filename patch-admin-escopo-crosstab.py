#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Painel Admin /admin/stats:
  (1) ESCOPO global: ?escopo=todos|solicitacoes|automacoes -> filtra TODAS as
      métricas (total, %, pizza, ranking, cruzada) por automação vs solicitação real,
      usando TIPOS_AUTOMACAO_SET (ja importado no forms.ts).
  (2) Tabela CRUZADA porTipoStatus (GROUP BY tipo, status) -> permite cruzar
      tipo x status no front (ex.: quantas Artes estão Concluído).

Requer os patches anteriores aplicados (dias-cheios + ranking + intervalo).
Alvo: forms.ts. Idempotente, backup .bak-escopo.
"""
import io, os, sys

def _resolve(cands):
    for c in cands:
        p = os.path.normpath(c)
        if os.path.exists(p): return p
    return None

FORMS = _resolve(["artifacts/api-server/src/routes/forms.ts", "src/routes/forms.ts"])

def once(src, old, new, label):
    if src.count(old) != 1:
        sys.exit("ABORTADO [%s]: ancora %d vezes (esperado 1)." % (label, src.count(old)))
    return src.replace(old, new, 1)

E1_OLD = '''    const naoImportada = sql`(${solicitacoesTable.dados} ->> '_importado_planilha') IS NULL`;
    const noPeriodo = and(
      sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`,
      sql`${solicitacoesTable.created_at} < ${fimHoje.toISOString()}`,
      naoImportada
    );'''
E1_NEW = '''    const naoImportada = sql`(${solicitacoesTable.dados} ->> '_importado_planilha') IS NULL`;
    // Escopo: todos | solicitacoes (exclui automações) | automacoes (só automações)
    const escopoParam = String(req.query.escopo || "todos");
    const autoTipos = Array.from(TIPOS_AUTOMACAO_SET) as string[];
    const inAuto = inArray(solicitacoesTable.tipo_solicitacao, autoTipos);
    const escopoCond = escopoParam === "automacoes"
      ? inAuto
      : escopoParam === "solicitacoes"
      ? sql`NOT (${inAuto})`
      : undefined;
    const noPeriodo = and(
      sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`,
      sql`${solicitacoesTable.created_at} < ${fimHoje.toISOString()}`,
      naoImportada,
      ...(escopoCond ? [escopoCond] : [])
    );'''

E2_OLD = '''      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAnterior.toISOString()}`,
        sql`${solicitacoesTable.created_at} < ${periodoAtual.toISOString()}`,
        naoImportada
      ));'''
E2_NEW = '''      .where(and(
        sql`${solicitacoesTable.created_at} >= ${periodoAnterior.toISOString()}`,
        sql`${solicitacoesTable.created_at} < ${periodoAtual.toISOString()}`,
        naoImportada,
        ...(escopoCond ? [escopoCond] : [])
      ));'''

E3_OLD = '''    const totalAtual = Number(atual.count);
    const totalAnterior = Number(anterior.count);'''
E3_NEW = '''    const porTipoStatusRows = await db.select({
      tipo: solicitacoesTable.tipo_solicitacao,
      status: solicitacoesTable.status,
      count: sql<number>`count(*)`,
    })
      .from(solicitacoesTable)
      .where(noPeriodo)
      .groupBy(solicitacoesTable.tipo_solicitacao, solicitacoesTable.status);

    const totalAtual = Number(atual.count);
    const totalAnterior = Number(anterior.count);'''

E4_OLD = '''      topSolicitantes: topSolicitantesRows.map(r => ({ nome: r.nome || r.email, count: Number(r.count) })),
      dias,'''
E4_NEW = '''      topSolicitantes: topSolicitantesRows.map(r => ({ nome: r.nome || r.email, count: Number(r.count) })),
      porTipoStatus: porTipoStatusRows.map(r => ({ tipo: r.tipo, status: r.status, count: Number(r.count) })),
      dias,'''


def main():
    if FORMS is None:
        sys.exit("ABORTADO: forms.ts nao encontrado.")
    src = io.open(FORMS, encoding="utf-8").read()
    if "escopoParam" in src and "porTipoStatusRows" in src:
        print("JA APLICADO.")
        return
    if "topSolicitantesRows" not in src or "rangeValido" not in src:
        sys.exit("ABORTADO: aplique os patches anteriores (ranking + intervalo) ANTES deste.")
    bp = FORMS + ".bak-escopo"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = once(src, E1_OLD, E1_NEW, "escopo+noPeriodo")
    src = once(src, E2_OLD, E2_NEW, "anterior")
    src = once(src, E3_OLD, E3_NEW, "crosstab")
    src = once(src, E4_OLD, E4_NEW, "resposta")
    io.open(FORMS, "w", encoding="utf-8").write(src)
    print("OK — escopo + porTipoStatus (backup: %s.bak-escopo)" % FORMS)


if __name__ == "__main__":
    main()

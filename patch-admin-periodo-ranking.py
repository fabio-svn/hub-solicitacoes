#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Painel Admin /admin/stats:
  (1) Período conta apenas DIAS CHEIOS — a janela termina no inicio de hoje
      (exclui o dia corrente). Ex.: sexta, 7 dias = sexta passada 00:00 -> quinta 23:59.
  (2) Novo ranking: topSolicitantes (quem mais solicitou no periodo), via join com users.

Alvo: artifacts/api-server/src/routes/forms.ts. Idempotente, backup .bak-adminstats.
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

# (1) periodo em dias cheios
A_OLD = '''    const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias), 10) || 7));
    const now = new Date();
    const periodoAtual = new Date(now.getTime() - dias * 86400000);
    const periodoAnterior = new Date(periodoAtual.getTime() - dias * 86400000);
    // registros importados da planilha histórica de cartões não entram nos contadores
    const naoImportada = sql`(${solicitacoesTable.dados} ->> '_importado_planilha') IS NULL`;
    const noPeriodo = and(sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`, naoImportada);'''
A_NEW = '''    const dias = Math.min(365, Math.max(1, parseInt(String(req.query.dias), 10) || 7));
    const now = new Date();
    // Períodos contam apenas DIAS CHEIOS: a janela termina no início de hoje (exclui o dia corrente).
    const fimHoje = new Date(now); fimHoje.setHours(0, 0, 0, 0);
    const periodoAtual = new Date(fimHoje.getTime() - dias * 86400000);
    const periodoAnterior = new Date(periodoAtual.getTime() - dias * 86400000);
    // registros importados da planilha histórica de cartões não entram nos contadores
    const naoImportada = sql`(${solicitacoesTable.dados} ->> '_importado_planilha') IS NULL`;
    const noPeriodo = and(
      sql`${solicitacoesTable.created_at} >= ${periodoAtual.toISOString()}`,
      sql`${solicitacoesTable.created_at} < ${fimHoje.toISOString()}`,
      naoImportada
    );'''

# (2) query topSolicitantes (inserida antes de totalAtual)
B_OLD = '''    const totalAtual = Number(atual.count);
    const totalAnterior = Number(anterior.count);'''
B_NEW = '''    const topSolicitantesRows = await db.select({
      nome: usersTable.name,
      email: solicitacoesTable.user_email,
      count: sql<number>`count(*)`,
    })
      .from(solicitacoesTable)
      .leftJoin(usersTable, eq(usersTable.email, solicitacoesTable.user_email))
      .where(noPeriodo)
      .groupBy(usersTable.name, solicitacoesTable.user_email)
      .orderBy(desc(sql`count(*)`))
      .limit(8);

    const totalAtual = Number(atual.count);
    const totalAnterior = Number(anterior.count);'''

# (2b) campo na resposta
C_OLD = '''      mediaNotas: mediaNotas.media ? Number(mediaNotas.media).toFixed(1) : null,
      dias,
    });'''
C_NEW = '''      mediaNotas: mediaNotas.media ? Number(mediaNotas.media).toFixed(1) : null,
      topSolicitantes: topSolicitantesRows.map(r => ({ nome: r.nome || r.email, count: Number(r.count) })),
      dias,
    });'''


def main():
    if FORMS is None:
        sys.exit("ABORTADO: forms.ts nao encontrado.")
    src = io.open(FORMS, encoding="utf-8").read()
    if "fimHoje" in src and "topSolicitantesRows" in src:
        print("JA APLICADO.")
        return
    bp = FORMS + ".bak-adminstats"
    if not os.path.exists(bp):
        io.open(bp, "w", encoding="utf-8").write(src)
    src = once(src, A_OLD, A_NEW, "periodo")
    src = once(src, B_OLD, B_NEW, "topSolicitantes query")
    src = once(src, C_OLD, C_NEW, "resposta")
    io.open(FORMS, "w", encoding="utf-8").write(src)
    print("OK — período em dias cheios + topSolicitantes (backup: %s.bak-adminstats)" % FORMS)


if __name__ == "__main__":
    main()

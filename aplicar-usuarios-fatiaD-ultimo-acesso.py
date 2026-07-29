#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hub SVN — Usuarios, Fatia D: ultimo acesso (BACKEND).

Registra e exibe o ultimo acesso de cada usuario:

  1. SCHEMA (lib/db): nova coluna last_login (timestamp, pode ser nulo).
  2. AUTH (auth.ts): a cada login (Microsoft callback), grava last_login = agora
     — tanto no primeiro acesso (insert) quanto nos seguintes (update).
  3. FRONT (admin-usuarios.html): coluna "Ultimo acesso" na tabela, com formato
     amigavel ("Hoje HH:MM", "Ontem HH:MM", data curta) e "nunca acessou" (em
     italico discreto) para quem ainda nao logou desde esta mudanca.

IMPORTANTE — passos manuais (por causa do schema/banco):

  A) MIGRACAO DO BANCO: a coluna precisa existir no Postgres. Rode uma vez:
       ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login timestamp;
     (pelo psql/console do banco, ou via `drizzle-kit push` se voce usa.)

  B) BUILD: como mexe no schema (lib/db) e no backend (auth.ts), precisa:
       rm -rf lib/db/dist lib/db/tsconfig.tsbuildinfo
       cd artifacts/api-server && pnpm run build
     (limpar o tsbuildinfo garante que o @workspace/db reexporta a coluna nova.)

  O endpoint /api/admin/users ja faz `select().from(usersTable)` (todos os
  campos), entao o last_login vem no retorno automaticamente — sem mexer nele.

Historico: so registra acessos A PARTIR de agora; quem nao logar depois aparece
como "nunca acessou" ate acessar (nao ha historico retroativo).

Ordem segura: (1) rode a migracao A; (2) rode este patch; (3) rode o build B.

Como rodar (Replit): Stop -> Shell ->
  ALTER TABLE ...  (passo A, no banco)
  python3 aplicar-usuarios-fatiaD-ultimo-acesso.py
  rm -rf lib/db/dist lib/db/tsconfig.tsbuildinfo && cd artifacts/api-server && pnpm run build
  (volte a raiz) e Run. Recarregue (Ctrl+Shift+R).
"""
import json, os, shutil, sys
EDITS = json.loads(r"""
[
  {
    "tipo": "editar",
    "arquivo": "lib/db/src/schema/index.ts",
    "desc": "Coluna last_login no schema",
    "marca": "last_login: timestamp(\"last_login\")",
    "old": "  clickup_user_id: varchar(\"clickup_user_id\", { length: 100 }),\n  created_at: timestamp(\"created_at\").defaultNow().notNull(),\n});",
    "new": "  clickup_user_id: varchar(\"clickup_user_id\", { length: 100 }),\n  created_at: timestamp(\"created_at\").defaultNow().notNull(),\n  last_login: timestamp(\"last_login\"),\n});"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/src/routes/auth.ts",
    "desc": "Grava last_login no login",
    "marca": "last_login: new Date()",
    "old": "    if (existing.length === 0) {\n      await db.insert(usersTable).values({ email, name, role: \"colaborador\" });\n    } else {\n      role = existing[0].role || \"colaborador\";\n      if (existing[0].name !== name) {\n        await db.update(usersTable).set({ name }).where(eq(usersTable.email, email));\n      }\n    }",
    "new": "    if (existing.length === 0) {\n      await db.insert(usersTable).values({ email, name, role: \"colaborador\", last_login: new Date() });\n    } else {\n      role = existing[0].role || \"colaborador\";\n      // last_login sempre atualiza; o nome so quando muda.\n      const patch: Record<string, unknown> = { last_login: new Date() };\n      if (existing[0].name !== name) patch.name = name;\n      await db.update(usersTable).set(patch).where(eq(usersTable.email, email));\n    }"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/admin-usuarios.html",
    "desc": "Coluna Último acesso no UCOLS",
    "marca": "ULTIMO-ACESSO-COL",
    "old": "      { f: 'created_at', label: 'Cadastro', w: 130, sort: true },\n      { f: '_acoes', label: 'Ações', w: 200, sort: false, center: true },",
    "new": "      { f: 'created_at', label: 'Cadastro', w: 130, sort: true },\n      { f: 'last_login', label: 'Último acesso', w: 150, sort: true },  /* ULTIMO-ACESSO-COL */\n      { f: '_acoes', label: 'Ações', w: 200, sort: false, center: true },"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/admin-usuarios.html",
    "desc": "Célula de último acesso",
    "marca": "ULTIMO-ACESSO-CELULA",
    "old": "          <td style=\"padding:10px 14px\">\n            <span style=\"font-size:0.8rem;opacity:0.6\">${dt}</span>\n          </td>\n          <td style=\"padding:10px 14px;text-align:center\" class=\"col-acoes\">",
    "new": "          <td style=\"padding:10px 14px\">\n            <span style=\"font-size:0.8rem;opacity:0.6\">${dt}</span>\n          </td>\n          <!-- ULTIMO-ACESSO-CELULA: formata o last_login (ou \"nunca acessou\"). -->\n          <td style=\"padding:10px 14px\">\n            <span style=\"font-size:0.8rem;${u.last_login ? 'opacity:0.6' : 'opacity:0.4;font-style:italic'}\">${fmtUltimoAcesso(u.last_login)}</span>\n          </td>\n          <td style=\"padding:10px 14px;text-align:center\" class=\"col-acoes\">"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/admin-usuarios.html",
    "desc": "Helper de formatação do último acesso",
    "marca": "function fmtUltimoAcesso",
    "old": "    function uSortCmp(a, b) {\n      const f = uSort.field;",
    "new": "    // ULTIMO-ACESSO-FMT: \"Hoje HH:MM\", \"Ontem HH:MM\", data curta, ou \"nunca acessou\".\n    function fmtUltimoAcesso(v) {\n      if (!v) return 'nunca acessou';\n      const d = new Date(v);\n      if (isNaN(d.getTime())) return '—';\n      const agora = new Date();\n      const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());\n      const dia = new Date(d.getFullYear(), d.getMonth(), d.getDate());\n      const difDias = Math.round((hoje - dia) / 86400000);\n      const hhmm = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });\n      if (difDias === 0) return 'Hoje, ' + hhmm;\n      if (difDias === 1) return 'Ontem, ' + hhmm;\n      return d.toLocaleDateString('pt-BR');\n    }\n    function uSortCmp(a, b) {\n      const f = uSort.field;\n      if (f === 'last_login') return ((new Date(a.last_login || 0)) - (new Date(b.last_login || 0))) * uSort.dir;"
  },
  {
    "tipo": "editar_all",
    "arquivo": "artifacts/api-server/public/admin-usuarios.html",
    "desc": "Colspan 4->5 (carregando)",
    "marca": "__nomark__",
    "old": "<tr><td colspan=\"4\" style=\"padding:24px;text-align:center;opacity:0.4\">Carregando...</td></tr>",
    "new": "<tr><td colspan=\"5\" style=\"padding:24px;text-align:center;opacity:0.4\">Carregando...</td></tr>"
  },
  {
    "tipo": "editar_all",
    "arquivo": "artifacts/api-server/public/admin-usuarios.html",
    "desc": "Colspan 4->5 (erro)",
    "marca": "__nomark__",
    "old": "<tr><td colspan=\"4\" style=\"padding:24px;text-align:center;color:var(--ruby-red)\">Erro ao carregar usuários.</td></tr>",
    "new": "<tr><td colspan=\"5\" style=\"padding:24px;text-align:center;color:var(--ruby-red)\">Erro ao carregar usuários.</td></tr>"
  },
  {
    "tipo": "editar_all",
    "arquivo": "artifacts/api-server/public/admin-usuarios.html",
    "desc": "Colspan 4->5 (vazio)",
    "marca": "__nomark__",
    "old": "<tr><td colspan=\"4\" style=\"padding:24px;text-align:center;opacity:0.4\">Nenhum usuário encontrado.</td></tr>",
    "new": "<tr><td colspan=\"5\" style=\"padding:24px;text-align:center;opacity:0.4\">Nenhum usuário encontrado.</td></tr>"
  }
]
""")

def main():
    if not os.path.isdir('artifacts/api-server') or not os.path.isdir('lib/db'):
        print('ERRO: rode a partir da raiz do repositorio (que tem artifacts/ e lib/).')
        sys.exit(1)
    conteudos,pend,feitos,erros={},[],[],[]
    for e in EDITS:
        p=e['arquivo']
        if p not in conteudos:
            if not os.path.isfile(p): erros.append(f"inexistente: {p}"); continue
            conteudos[p]=open(p,encoding='utf-8').read()
        t=conteudos[p]
        if e.get('tipo')=='editar_all':
            if e['old'] not in t: feitos.append(e['desc']); continue
            pend.append((p,e)); continue
        if e['marca'] in t: feitos.append(e['desc']); continue
        n=t.count(e['old'])
        if n==0: erros.append(f"[{e['desc']}] ancora nao encontrada em {p}")
        elif n>1: erros.append(f"[{e['desc']}] ancora {n}x em {p}")
        else: pend.append((p,e))
    print('='*60,'\nVERIFICACAO\n','='*60,sep='')
    for d in feitos: print('  = ja',d)
    for _,e in pend: print('  + ',e['desc'])
    for m in erros: print('  !',m)
    if erros: print('\nNada escrito.'); sys.exit(1)
    if not pend: print('\nTudo ja aplicado.'); return
    escrever={}
    for p,e in pend:
        base=escrever.get(p,conteudos[p])
        novo=base.replace(e['old'],e['new']) if e.get('tipo')=='editar_all' else base.replace(e['old'],e['new'],1)
        if novo==base: print('  ! nada mudou',e['desc']); sys.exit(1)
        escrever[p]=novo
    for p in sorted(escrever):
        bak=p+'.bak'
        if not os.path.exists(bak): shutil.copy2(p,bak)
        open(p,'w',encoding='utf-8').write(escrever[p]); print('  escrito',p)
    print('\n>>> NAO ESQUECA: (A) ALTER TABLE no banco e (B) o build. Veja o cabecalho.')

if __name__=='__main__': main()

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hub SVN — Tombamento: restaura o estado ao recarregar (nome da planilha + fotos).

Dois bugs ao atualizar a pagina de um tombamento existente:

  1. NOME DA PLANILHA sumia — o badge mostrava so a contagem de linhas. O nome
     (planilha_nome) ja vinha do banco, mas o abrirWorkspace nao o usava. Agora
     o badge volta a mostrar "arquivo.xlsx · N linha(s)".

  2. PAINEL DE FOTOS / revisao zerava — a revisao so existia no DOM apos um
     upload; ao recarregar, sumia (embora o zip esteja persistido no R2). Agora:
       - o endpoint match-fotos, quando chamado SEM upload, reprocessa o zip ja
         persistido (cache -> R2) — mesmo padrao do gerar-cartoes;
       - o abrirWorkspace, quando ha fotos_zip_key, chama esse reprocessamento e
         reconstroi a revisao automaticamente.

Nao ha schema novo (reusa fotos_zip_key e planilha_nome, que ja existem). Mexe no
backend, entao PRECISA BUILD; sem migracao.

Passos (Replit): Stop -> Shell ->
  python3 aplicar-tombamento-restaurar-estado.py
  cd artifacts/api-server && pnpm run build
  (volte a raiz) Run. Recarregue (Ctrl+Shift+R).
"""
import json, os, shutil, sys
EDITS = json.loads(r"""
[
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/src/routes/admin.ts",
    "desc": "match-fotos reprocessa do R2",
    "marca": "MATCH-REPROCESSA-R2",
    "old": "    const file = (req as { file?: { buffer: Buffer } }).file;\n    if (!file) { res.status(400).json({ error: \"Envie o .zip de fotos no campo 'fotos'.\" }); return; }\n    let fotosZip: JSZip;\n    try { fotosZip = await JSZip.loadAsync(file.buffer); }\n    catch { res.status(400).json({ error: \"Não foi possível ler o .zip de fotos. Confira o arquivo.\" }); return; }\n    tombZipCacheSet(id, file.buffer);\n    // PERSISTE-FOTOS-R2: sobe o ZIP ao R2 e guarda a key no tombamento, para\n    // conferir/retomar em outra sessao (o cache sozinho expira em 30 min).\n    const fotosKey = await tombFotosR2Upload(id, file.buffer);\n    if (fotosKey) {\n      await db.update(tombamentosTable)\n        .set({ fotos_zip_key: fotosKey, updated_at: new Date() })\n        .where(eq(tombamentosTable.id, id));\n    }",
    "new": "    // MATCH-REPROCESSA-R2: com upload, usa o arquivo enviado (e persiste). SEM\n    // upload, reprocessa o zip ja persistido (cache -> R2) — permite restaurar a\n    // revisao ao reabrir/recarregar o workspace sem reenviar o zip.\n    const file = (req as { file?: { buffer: Buffer } }).file;\n    let srcBuf: Buffer | null = file ? file.buffer : tombZipCacheGet(id);\n    if (!srcBuf && tomb.fotos_zip_key) srcBuf = await tombFotosR2Download(String(tomb.fotos_zip_key));\n    if (!srcBuf) { res.status(400).json({ error: \"Envie o .zip de fotos no campo 'fotos'.\", semFotos: true }); return; }\n    let fotosZip: JSZip;\n    try { fotosZip = await JSZip.loadAsync(srcBuf); }\n    catch { res.status(400).json({ error: \"Não foi possível ler o .zip de fotos. Confira o arquivo.\" }); return; }\n    // so re-sobe ao R2 quando veio um upload novo (reprocessar do R2 nao precisa).\n    if (file) {\n      tombZipCacheSet(id, file.buffer);\n      const fotosKey = await tombFotosR2Upload(id, file.buffer);\n      if (fotosKey) {\n        await db.update(tombamentosTable)\n          .set({ fotos_zip_key: fotosKey, updated_at: new Date() })\n          .where(eq(tombamentosTable.id, id));\n      }\n    }"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/admin-tombamentos.html",
    "desc": "Nome da planilha ao recarregar",
    "marca": "PLANILHA-NOME-RESTORE",
    "old": "      if (tomb.linhas && tomb.linhas.length) {\n        renderTabela(tomb.linhas);\n        atualizarEstadoPlanilha(true, tomb.linhas.length + ' linha(s)');\n      } else {",
    "new": "      if (tomb.linhas && tomb.linhas.length) {\n        renderTabela(tomb.linhas);\n        // PLANILHA-NOME-RESTORE: usa o nome guardado (planilha_nome) ao recarregar,\n        // nao so a contagem de linhas — o nome sumia ao atualizar a pagina.\n        var _meta = (tomb.planilha_nome ? tomb.planilha_nome + ' · ' : '') + tomb.linhas.length + ' linha(s)';\n        atualizarEstadoPlanilha(true, _meta);\n      } else {"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/admin-tombamentos.html",
    "desc": "Restaura revisão de fotos ao abrir",
    "marca": "REVISAO-RESTORE",
    "old": "      // fotos: se o tombamento ja tem ZIP persistido, sinaliza no botao\n      atualizarEstadoFotos(!!tomb.fotos_zip_key);\n      atualizarBotaoBaixar(); // AO-ABRIR: link de baixar planilha, se houver arquivo guardado\n    }",
    "new": "      // fotos: se o tombamento ja tem ZIP persistido, sinaliza no botao\n      atualizarEstadoFotos(!!tomb.fotos_zip_key);\n      atualizarBotaoBaixar(); // AO-ABRIR: link de baixar planilha, se houver arquivo guardado\n      // REVISAO-RESTORE: se ha zip de fotos persistido, reconstroi a revisao a\n      // partir dele (reprocessa no backend a partir do R2) — sem isto, o painel\n      // de fotos zerava ao recarregar a pagina.\n      if (tomb.fotos_zip_key && tomb.linhas && tomb.linhas.length) {\n        restaurarRevisaoFotos();\n      }\n    }\n\n    // restaurarRevisaoFotos: pede ao backend para reprocessar o zip ja persistido\n    // (match-fotos sem upload) e re-renderiza a revisao. Silencioso em caso de\n    // falha — o usuario ainda pode reenviar o zip manualmente.\n    async function restaurarRevisaoFotos() {\n      if (!currentTomb) return;\n      try {\n        const res = await fetch('/api/admin/tombamentos/' + currentTomb.id + '/match-fotos', { method: 'POST' });\n        if (!res.ok) return;\n        const data = await res.json().catch(function () { return {}; });\n        if (data && Array.isArray(data.pessoas)) {\n          cartoesFotos = data.fotos || [];\n          renderRevisao(data);\n        }\n      } catch (_) { /* silencioso */ }\n    }"
  }
]
""")

def main():
    if not os.path.isdir('artifacts/api-server'):
        print('ERRO: rode a partir da raiz.'); sys.exit(1)
    conteudos,pend,feitos,erros={},[],[],[]
    for e in EDITS:
        p=e['arquivo']
        if p not in conteudos:
            if not os.path.isfile(p): erros.append(f"inexistente: {p}"); continue
            conteudos[p]=open(p,encoding='utf-8').read()
        t=conteudos[p]
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
        base=escrever.get(p,conteudos[p]); novo=base.replace(e['old'],e['new'],1)
        if novo==base: print('  ! nada mudou',e['desc']); sys.exit(1)
        escrever[p]=novo
    for p in sorted(escrever):
        bak=p+'.bak'
        if not os.path.exists(bak): shutil.copy2(p,bak)
        open(p,'w',encoding='utf-8').write(escrever[p]); print('  escrito',p)
    print('\n>>> PRECISA BUILD: cd artifacts/api-server && pnpm run build')

if __name__=='__main__': main()

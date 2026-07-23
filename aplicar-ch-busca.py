#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Hub SVN — pendencias das levas 1 e 2.

  1. Apaga public/403.html (nenhuma rota a serve)
  2. Apaga public/form-ch-kit-onboarding.html (o card virou link para a Store)
  3. Categoria "Capital Humano" na home e na busca, visivel so para quem tem o
     papel capital_humano ou admin, via um campo `roles` nas categorias

O tipo ch-kit-onboarding continua registrado no backend (LABELS_EXTRA,
VALID_TIPOS, TIPOS_COM_CLICKUP) de proposito: solicitacoes antigas desse tipo
ainda precisam do rotulo para nao aparecerem como slug cru.

Como rodar (Replit): Stop -> Shell -> python3 aplicar-ch-busca.py
  Depois: cd artifacts/api-server && pnpm run build -> Run
"""
import json
import os
import shutil
import sys

LIXO = 'artifacts/api-server/.lixo-ch'

EDITS = json.loads(r"""
[
  {
    "tipo": "apagar",
    "arquivo": "artifacts/api-server/public/403.html",
    "desc": "Apagar 403.html (nenhuma rota a serve; so o 404 esta ligado no app.ts)"
  },
  {
    "tipo": "apagar",
    "arquivo": "artifacts/api-server/public/form-ch-kit-onboarding.html",
    "desc": "Apagar form-ch-kit-onboarding.html (o card do CH agora aponta para a Store)"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/config.js",
    "desc": "Categoria do Capital Humano + filtro por papel",
    "marca": "CATEGORIAS-POR-ROLE",
    "old": "  {\n    categoria: \"Outros\",\n    layout: \"single\",\n    itens: [\n      { id: \"outro\", label: \"Outro\", icon: \"icon-edit\", ativo: true },\n    ]\n  },\n];\n",
    "new": "  {\n    categoria: \"Outros\",\n    layout: \"single\",\n    itens: [\n      { id: \"outro\", label: \"Outro\", icon: \"icon-edit\", ativo: true },\n    ]\n  },\n  {\n    // Os formularios do CH ja eram restritos por papel dentro de cada pagina,\n    // mas ficavam fora daqui — entao nao apareciam nem na home nem no Ctrl+K,\n    // so pela capital-humano.html. Com `roles`, aparecem para quem pode.\n    // Os rotulos batem com o LABELS_EXTRA do backend.\n    categoria: \"Capital Humano\",\n    roles: [\"admin\", \"capital_humano\"],\n    itens: [\n      { id: \"ch-atualizacao-pessoas\", label: \"Atualização de Pessoas nos Sites\", icon: \"icon-refresh\", ativo: true },\n      { id: \"ch-atualizacao-books\", label: \"Atualização de Books\", icon: \"icon-newspaper\", ativo: true },\n      { id: \"ch-linha-do-tempo\", label: \"Linha do Tempo\", icon: \"icon-calendar\", ativo: true },\n      { id: \"ch-aniversariantes\", label: \"Aniversariantes do Mês\", icon: \"icon-party-popper\", ativo: true },\n    ]\n  },\n];\n\n/* CATEGORIAS-POR-ROLE: use SEMPRE esta funcao no lugar de CATEGORIAS_SOLICITACAO\n   ao montar algo que o usuario ve (cards da home, busca do Ctrl+K). Categorias\n   sem `roles` valem para todo mundo; com `roles`, so para quem tem o papel.\n\n   Isto e conforto de interface, nao seguranca: quem souber a URL continua\n   chegando na pagina, e quem barra e o guard de papel dentro do formulario mais\n   a validacao do backend. Nao use como unica trava para nada sensivel. */\nfunction categoriasVisiveis() {\n  var role = (typeof Auth !== 'undefined' && typeof Auth.getUserRole === 'function')\n    ? Auth.getUserRole()\n    : null;\n  return CATEGORIAS_SOLICITACAO.filter(function (cat) {\n    if (!Array.isArray(cat.roles)) return true;\n    return cat.roles.indexOf(role) !== -1;\n  });\n}\n"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/config.js",
    "desc": "Rotas dos 4 formularios do CH",
    "marca": "\"ch-atualizacao-pessoas\": \"form-ch-",
    "old": "  \"materiais-impressos\":   \"form-materiais-impressos.html\",\n};",
    "new": "  \"materiais-impressos\":   \"form-materiais-impressos.html\",\n  \"ch-atualizacao-pessoas\": \"form-ch-atualizacao-pessoas.html\",\n  \"ch-atualizacao-books\":   \"form-ch-atualizacao-books.html\",\n  \"ch-linha-do-tempo\":      \"form-ch-linha-do-tempo.html\",\n  \"ch-aniversariantes\":     \"form-ch-aniversariantes.html\",\n};"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/solicitacoes.html",
    "desc": "Home passa a montar os cards pela lista filtrada",
    "marca": "categoriasVisiveis().forEach",
    "old": "      CATEGORIAS_SOLICITACAO.forEach(cat => {",
    "new": "      categoriasVisiveis().forEach(cat => {"
  },
  {
    "tipo": "editar",
    "arquivo": "artifacts/api-server/public/shell.js",
    "desc": "Busca (Ctrl+K) passa a usar a lista filtrada",
    "marca": "categoriasVisiveis().forEach",
    "old": "    if (typeof CATEGORIAS_SOLICITACAO === 'undefined') return [];\n    var out = [];\n    CATEGORIAS_SOLICITACAO.forEach(function (cat) {",
    "new": "    if (typeof categoriasVisiveis !== 'function') return [];\n    var out = [];\n    categoriasVisiveis().forEach(function (cat) {"
  }
]
""")

def main():
    if not os.path.isdir('artifacts/api-server'):
        print('ERRO: rode a partir da raiz do repositorio.')
        sys.exit(1)

    conteudos, pendentes, apagar, feitos, erros = {}, [], [], [], []

    for e in EDITS:
        if e['tipo'] == 'apagar':
            if os.path.exists(e['arquivo']):
                apagar.append(e)
            else:
                feitos.append(e['desc'])
            continue

        caminho = e['arquivo']
        if caminho not in conteudos:
            if not os.path.isfile(caminho):
                erros.append(f"[{e['desc']}] arquivo inexistente: {caminho}")
                continue
            conteudos[caminho] = open(caminho, encoding='utf-8').read()
        texto = conteudos[caminho]
        if e['marca'] in texto:
            feitos.append(e['desc'])
            continue
        n = texto.count(e['old'])
        if n == 0:
            pista = e['old'].strip().splitlines()[0][:70]
            erros.append(f"[{e['desc']}] ancora nao encontrada em {caminho}")
            erros.append(f"      primeira linha da ancora: {pista}")
            erros.append(f"      essa linha existe no arquivo? {'sim' if pista in texto else 'nao'}")
        elif n > 1:
            erros.append(f"[{e['desc']}] ancora aparece {n}x em {caminho} (esperado 1)")
        else:
            pendentes.append((caminho, e))

    print('=' * 70)
    print('VERIFICACAO')
    print('=' * 70)
    for d in feitos:
        print(f'  = ja aplicado  {d}')
    for e in apagar:
        print(f'  - apagar       {e["desc"]}')
    for _, e in pendentes:
        print(f'  + a aplicar    {e["desc"]}')
    for m in erros:
        print(f'  ! {m}')

    if erros:
        print('\nNada foi escrito. Corrija os itens acima e rode de novo.')
        sys.exit(1)
    if not (pendentes or apagar):
        print('\nTudo ja estava aplicado. Nenhuma escrita necessaria.')
        return

    escrever = {}
    for caminho, e in pendentes:
        base = escrever.get(caminho, conteudos[caminho])
        novo = base.replace(e['old'], e['new'], 1)
        if novo == base:
            print(f"  ! [{e['desc']}] a ancora deixou de casar depois de outra edicao. Nada foi escrito.")
            sys.exit(1)
        escrever[caminho] = novo

    print('\n' + '=' * 70)
    print('ESCRITA')
    print('=' * 70)
    if apagar:
        os.makedirs(LIXO, exist_ok=True)
        for e in apagar:
            shutil.move(e['arquivo'], os.path.join(LIXO, os.path.basename(e['arquivo'])))
            print(f'  movido  {e["arquivo"]} -> {LIXO}/')
    for caminho in sorted(escrever):
        bak = caminho + '.bak'
        if not os.path.exists(bak):
            shutil.copy2(caminho, bak)
        open(caminho, 'w', encoding='utf-8').write(escrever[caminho])
        print(f'  escrito {caminho}')

    print('\nAgora: cd artifacts/api-server && pnpm run build  (e Run para reiniciar)')


if __name__ == '__main__':
    main()

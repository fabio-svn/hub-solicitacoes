#!/usr/bin/env python3
"""
Correcao: adiciona o campo '_variante_convite' com as 12 opcoes ({num}-{formato})
para o EDITOR de templates listar no dropdown de criacao.
Sem isso, o dropdown de variante fica vazio (a Parte A trocou o variant_field
mas nao criou o campo com opcoes).
Rode na raiz do HUB.
"""
import os, sys, shutil, glob

SCHEMA = None
for cand in ("artifacts/api-server/src/config/form-schemas.ts","src/config/form-schemas.ts"):
    if os.path.exists(cand): SCHEMA = cand; break
if not SCHEMA:
    hits = glob.glob("**/config/form-schemas.ts", recursive=True)
    if hits: SCHEMA = hits[0]
if not SCHEMA: sys.exit("ERRO: form-schemas.ts nao encontrado.")

s = open(SCHEMA).read()

if "'_variante_convite'" in s and "name: '_variante_convite'" in s:
    sys.exit("JA APLICADO: campo _variante_convite ja existe.")

# Gerar as 12 opcoes: {num}-{formato}
formatos = [("stories", "Stories (1080×1920)"), ("feed", "Feed (1080×1350)"), ("quadrado", "Quadrado (600×500)")]
opcoes = []
for num in ["1", "2", "3", "4"]:
    for fmt, fmt_label in formatos:
        opcoes.append(f"{{ value: '{num}-{fmt}', label: '{num} palestrante(s) — {fmt_label}' }}")
opcoes_str = ",\n          ".join(opcoes)

# Inserir o campo _variante_convite logo apos o campo num_palestrantes.
# Ancora: o fim do campo num_palestrantes (com a opcao 4 ja adicionada na etapa anterior).
anchor = "        options: [ { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' } ] },"
if anchor not in s:
    # tentar sem a opcao 4 (caso ordem de aplicacao diferente)
    anchor = "        options: [ { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' } ] },"
    if anchor not in s:
        sys.exit("ERRO: campo num_palestrantes nao encontrado para inserir _variante_convite depois.")

novo_campo = anchor + f'''
      {{ name: '_variante_convite', label: 'Variante (auto)', type: 'select',
        options: [
          {opcoes_str}
        ] }},'''

s = s.replace(anchor, novo_campo, 1)

shutil.copy(SCHEMA, SCHEMA + ".bak-variantes")
open(SCHEMA, "w").write(s)
print("OK: campo '_variante_convite' com 12 opcoes adicionado.")
print("  O editor de templates agora lista as 12 variantes no dropdown de criacao.")
print("  Opcoes: 1-stories, 1-feed, 1-quadrado, 2-stories ... 4-quadrado")
print("Backup: form-schemas.ts.bak-variantes")

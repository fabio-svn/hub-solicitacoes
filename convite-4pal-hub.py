#!/usr/bin/env python3
"""
Convite 4 palestrantes — parte HUB: adiciona opcao '4' no dropdown + campos do palestrante 4.
Rode na raiz do HUB (onde esta artifacts/api-server/src/config/form-schemas.ts).
"""
import os, sys, shutil, glob

# localizar form-schemas.ts
SCHEMA = None
for cand in ("artifacts/api-server/src/config/form-schemas.ts", "src/config/form-schemas.ts"):
    if os.path.exists(cand):
        SCHEMA = cand; break
if not SCHEMA:
    hits = glob.glob("**/config/form-schemas.ts", recursive=True)
    if hits: SCHEMA = hits[0]
if not SCHEMA:
    sys.exit("ERRO: form-schemas.ts nao encontrado.")

s = open(SCHEMA).read()

# 1) dropdown num_palestrantes: adicionar opcao 4
old_opts = "options: [ { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' } ] },"
new_opts = "options: [ { value: '1', label: '1' }, { value: '2', label: '2' }, { value: '3', label: '3' }, { value: '4', label: '4' } ] },"
if new_opts in s:
    print("  (opcao 4 ja existe no dropdown)")
elif old_opts in s:
    s = s.replace(old_opts, new_opts, 1)
    print("  OK: opcao '4' adicionada ao dropdown num_palestrantes")
else:
    print("  AVISO: dropdown num_palestrantes nao encontrado no formato esperado")

# 2) campos do palestrante 4 (apos os do palestrante 3)
old_fields = """      { name: 'palestrante_3_nome',  label: 'Palestrante 3 - Nome',  type: 'text' },
      { name: 'palestrante_3_cargo', label: 'Palestrante 3 - Cargo', type: 'text' },
      { name: 'palestrante_3_foto',  label: 'Palestrante 3 - Foto',  type: 'file' },
    ],"""
new_fields = """      { name: 'palestrante_3_nome',  label: 'Palestrante 3 - Nome',  type: 'text' },
      { name: 'palestrante_3_cargo', label: 'Palestrante 3 - Cargo', type: 'text' },
      { name: 'palestrante_3_foto',  label: 'Palestrante 3 - Foto',  type: 'file' },
      { name: 'palestrante_4_nome',  label: 'Palestrante 4 - Nome',  type: 'text' },
      { name: 'palestrante_4_cargo', label: 'Palestrante 4 - Cargo', type: 'text' },
      { name: 'palestrante_4_foto',  label: 'Palestrante 4 - Foto',  type: 'file' },
    ],"""
if "palestrante_4_nome" in s:
    print("  (campos do palestrante 4 ja existem)")
elif old_fields in s:
    s = s.replace(old_fields, new_fields, 1)
    print("  OK: campos palestrante_4 (nome/cargo/foto) adicionados")
else:
    sys.exit("ERRO: campos do palestrante 3 nao encontrados (para inserir o 4 apos).")

shutil.copy(SCHEMA, SCHEMA + ".bak-convite4")
open(SCHEMA, "w").write(s)
print(f"OK (HUB): schema convite-evento atualizado para 4 palestrantes em {SCHEMA}.")
print("Backup: form-schemas.ts.bak-convite4")

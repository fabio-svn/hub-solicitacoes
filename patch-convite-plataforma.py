#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Convite de evento — suporte a evento ONLINE.
  * Adiciona o campo 'plataforma' (youtube|zoom|meet) ao schema 'convite-evento'.
    E ele que alimenta a image layer 'variant' com a logo da plataforma, e faz o
    editor de arte oferecer o campo em variant_source / placeholders.
  * 'local_nome' deixa de ser required (agora e condicional: so faz sentido em
    evento presencial). Seguro: 'convite-evento' NAO esta em REQUIRED_FIELDS,
    entao o backend nunca validou esse campo — o required era so metadado.

Alvo: src/config/form-schemas.ts. Idempotente, backup .bak-plataforma.
"""
import io, os, sys
def _r(cs):
    for c in cs:
        p=os.path.normpath(c)
        if os.path.exists(p): return p
    return None
F=_r(["artifacts/api-server/src/config/form-schemas.ts","src/config/form-schemas.ts"])
if F is None: sys.exit("form-schemas.ts nao encontrado")
s=io.open(F,encoding="utf-8").read()
if "name: 'plataforma'" in s:
    print("JA APLICADO."); sys.exit()

OLD = """      { name: 'local_nome',       label: 'Nome do local',       type: 'text',   required: true },
      { name: 'endereco',         label: 'Endereco',            type: 'textarea' },"""
NEW = """      // Presencial: local_nome + endereco. Online: plataforma (logo).
      // Nao sao obrigatorios porque dependem do tipo_evento — em online os campos
      // de local vem vazios (as text layers somem sozinhas) e a logo e resolvida
      // pela image layer 'variant' via variant_source: 'plataforma'.
      { name: 'local_nome',       label: 'Nome do local (presencial)', type: 'text' },
      { name: 'endereco',         label: 'Endereco (presencial)',      type: 'textarea' },
      { name: 'plataforma',       label: 'Plataforma (online)',        type: 'select',
        options: [
          { value: 'youtube', label: 'YouTube' },
          { value: 'zoom',    label: 'Zoom' },
          { value: 'meet',    label: 'Meet' }
        ] },"""
if s.count(OLD)!=1: sys.exit("ABORTADO: ancora %d vezes"%s.count(OLD))
bp=F+".bak-plataforma"
if not os.path.exists(bp): io.open(bp,"w",encoding="utf-8").write(s)
io.open(F,"w",encoding="utf-8").write(s.replace(OLD,NEW,1))
print("OK — campo 'plataforma' adicionado; local_nome/endereco agora opcionais. backup .bak-plataforma")

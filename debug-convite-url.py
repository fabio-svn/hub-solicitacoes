#!/usr/bin/env python3
"""
DEBUG TEMPORARIO: adiciona um log no getRemoteAsset que mostra a URL exata recebida
e os primeiros bytes do buffer baixado. Ajuda a descobrir por que o Sharp rejeita a foto.
Rode na raiz do HUB. REVERTER depois (e so debug).
"""
import os, sys, shutil, glob

RENDERER = None
for cand in ("artifacts/api-server/src/services/template-renderer.ts","src/services/template-renderer.ts"):
    if os.path.exists(cand): RENDERER = cand; break
if not RENDERER:
    hits = glob.glob("**/services/template-renderer.ts", recursive=True)
    if hits: RENDERER = hits[0]
if not RENDERER: sys.exit("ERRO: template-renderer.ts nao encontrado.")

s = open(RENDERER).read()

if "DEBUG_CONVITE_URL" in s:
    sys.exit("JA APLICADO (debug ativo).")

# Adicionar log logo apos baixar o buffer no getRemoteAsset (http)
anchor = "    const buf = Buffer.from(await res.arrayBuffer());"
if anchor not in s:
    sys.exit("ERRO: ponto de download no getRemoteAsset nao encontrado.")

novo = """    const buf = Buffer.from(await res.arrayBuffer());
    // DEBUG_CONVITE_URL (temporario): mostra o que foi baixado
    logger.info({
      url,
      status: res.status,
      contentType: res.headers.get('content-type'),
      bufLen: buf.length,
      hexInicial: buf.subarray(0, 8).toString('hex'),
    }, '[DEBUG_CONVITE_URL] asset baixado');"""

s = s.replace(anchor, novo, 1)

shutil.copy(RENDERER, RENDERER + ".bak-debug")
open(RENDERER, "w").write(s)
print("OK: log de debug adicionado ao getRemoteAsset.")
print("Agora gere o convite e veja no log a linha [DEBUG_CONVITE_URL].")
print("Ela mostra: a URL exata, o content-type, e os primeiros bytes (hex).")
print("PNG valido comeca com: 89504e470d0a1a0a")
print("Se vier outro hex ou content-type text/html -> a URL esta errada/suja.")
print("")
print("REVERTER depois: cp " + RENDERER + ".bak-debug " + RENDERER)

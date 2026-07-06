#!/usr/bin/env python3
"""
Correcao definitiva: fotos de palestrante nao renderizam porque o Cloudflare (do portalsvn.com.br)
devolve 202 + HTML para requisicoes do Node (undici) sem headers de navegador — trata como bot.
Solucao: enviar User-Agent + Accept de navegador no fetch do getRemoteAsset, e validar que a
resposta e realmente imagem (falha claro se vier HTML, em vez de passar lixo pro Sharp).
Tambem REMOVE o log de debug temporario.
Rode na raiz do HUB.
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

# 1) Adicionar headers de navegador no fetch
old_fetch = "      res = await fetch(url, { signal: controller.signal });"
new_fetch = """      res = await fetch(url, {
        signal: controller.signal,
        headers: {
          // Alguns hosts (ex.: Cloudflare no portalsvn.com.br) devolvem 202 + HTML de desafio
          // para requisicoes sem cara de navegador. Enviar UA/Accept realistas evita isso.
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
          'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        },
      });"""
if old_fetch not in s:
    sys.exit("ERRO: fetch do getRemoteAsset nao encontrado.")
s = s.replace(old_fetch, new_fetch, 1)

# 2) Validar que a resposta e imagem (nao HTML). Inserir apos o check de res.ok.
old_check = "    if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);"
new_check = """    if (!res.ok) throw new Error(`Falha ao buscar ${url}: ${res.status}`);
    const ct = res.headers.get('content-type') || '';
    if (ct && !ct.startsWith('image/')) {
      // Resposta 2xx mas nao e imagem (ex.: 202 + text/html de desafio anti-bot).
      throw new Error(`Asset ${url} retornou content-type inesperado: ${ct} (status ${res.status})`);
    }"""
if old_check not in s:
    sys.exit("ERRO: check res.ok nao encontrado.")
s = s.replace(old_check, new_check, 1)

# 3) Remover o log de debug temporario (se presente)
debug_block = """    const buf = Buffer.from(await res.arrayBuffer());
    // DEBUG_CONVITE_URL (temporario): mostra o que foi baixado
    logger.info({
      url,
      status: res.status,
      contentType: res.headers.get('content-type'),
      bufLen: buf.length,
      hexInicial: buf.subarray(0, 8).toString('hex'),
    }, '[DEBUG_CONVITE_URL] asset baixado');"""
debug_clean = "    const buf = Buffer.from(await res.arrayBuffer());"
if debug_block in s:
    s = s.replace(debug_block, debug_clean, 1)
    print("  (log de debug temporario removido)")

shutil.copy(RENDERER, RENDERER + ".bak-cloudflare")
open(RENDERER, "w").write(s)
print("OK: getRemoteAsset agora envia headers de navegador + valida content-type.")
print("  Isso resolve o 202+HTML do Cloudflare (fotos de palestrante).")
print("Backup: template-renderer.ts.bak-cloudflare")

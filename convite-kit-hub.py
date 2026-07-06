#!/usr/bin/env python3
"""
Convite KIT (3 formatos) — parte HUB.
- Muda template_variant_field do convite para '_variante_convite' (combina num+formato)
- Adiciona funcao gerarKitConvite que gera os 3 formatos e devolve os buffers
- Adapta a rota /gerar-convite para gerar o kit e devolver { urls: {stories, feed, quadrado} }
Rode na raiz do HUB.
NAO altera gerarArteBuffer (usado por outros tipos) — injeta o campo _variante_convite nos dados.
"""
import os, sys, shutil, glob

# ---------- localizar arquivos ----------
def find(cands, pattern):
    for c in cands:
        if os.path.exists(c): return c
    hits = glob.glob(pattern, recursive=True)
    return hits[0] if hits else None

SCHEMA = find(["artifacts/api-server/src/config/form-schemas.ts","src/config/form-schemas.ts"], "**/config/form-schemas.ts")
ARTGEN = find(["artifacts/api-server/src/services/art-generator.ts","src/services/art-generator.ts"], "**/services/art-generator.ts")
CONVITE_ROUTE = find(["artifacts/api-server/src/routes/convites.ts","src/routes/convites.ts"], "**/routes/convites.ts")

if not SCHEMA: sys.exit("ERRO: form-schemas.ts nao encontrado.")
if not ARTGEN: sys.exit("ERRO: art-generator.ts nao encontrado.")
if not CONVITE_ROUTE:
    # a rota pode estar noutro arquivo; procurar por /gerar-convite
    hits = []
    for f in glob.glob("**/*.ts", recursive=True):
        try:
            if '/gerar-convite' in open(f).read(): hits.append(f)
        except: pass
    CONVITE_ROUTE = hits[0] if hits else None
if not CONVITE_ROUTE: sys.exit("ERRO: rota /gerar-convite nao encontrada.")

print(f"Arquivos: schema={SCHEMA}, artgen={ARTGEN}, rota={CONVITE_ROUTE}")

FORMATOS = ["stories", "feed", "quadrado"]  # rotulos dos 3 formatos

# ============================================================
# 1) SCHEMA: trocar template_variant_field do convite p/ _variante_convite
# ============================================================
s = open(SCHEMA).read()
if "_variante_convite" in s:
    print("1. (schema ja atualizado)")
else:
    old = "    template_variant_field: 'num_palestrantes',"
    if old not in s:
        sys.exit("ERRO: template_variant_field do convite nao encontrado.")
    s = s.replace(old, "    template_variant_field: '_variante_convite',", 1)
    shutil.copy(SCHEMA, SCHEMA + ".bak-kit")
    open(SCHEMA, "w").write(s)
    print("1. OK: template_variant_field -> '_variante_convite'")

# ============================================================
# 2) ART-GENERATOR: adicionar gerarKitConvite (gera os 3 formatos)
# ============================================================
a = open(ARTGEN).read()
if "export async function gerarKitConvite" in a:
    print("2. (gerarKitConvite ja existe)")
else:
    # inserir apos o fim de gerarArteBuffer. Ancora: a linha de retorno final do png.
    anchor = '''  return { buffer: await renderFromTemplate(config, renderData), ext: "png", mimetype: "image/png" };
}'''
    if anchor not in a:
        sys.exit("ERRO: fim de gerarArteBuffer nao encontrado (ancora).")
    kit_fn = anchor + '''

/**
 * Gera o KIT de convite: os 3 formatos (stories, feed, quadrado) para a mesma
 * quantidade de palestrantes. Reusa gerarArteBuffer injetando o campo
 * `_variante_convite` = "{num_palestrantes}-{formato}" em cada chamada.
 * Retorna um objeto { formato: buffer } apenas com os formatos que tinham template.
 */
const CONVITE_FORMATOS = ["stories", "feed", "quadrado"] as const;
export type ConviteFormato = typeof CONVITE_FORMATOS[number];

export async function gerarKitConvite(
  dados: Record<string, unknown>,
): Promise<Record<string, { buffer: Buffer; ext: string; mimetype: string }>> {
  const num = String(dados["num_palestrantes"] ?? "").trim() || "1";
  const resultado: Record<string, { buffer: Buffer; ext: string; mimetype: string }> = {};
  for (const formato of CONVITE_FORMATOS) {
    const dadosFmt = { ...dados, _variante_convite: `${num}-${formato}` };
    try {
      const art = await gerarArteBuffer("convite-evento", dadosFmt);
      if (art) resultado[formato] = art;
      else logger.warn({ variante: `${num}-${formato}` }, "[convite-kit] sem template para esta variante");
    } catch (err) {
      logger.error({ err, formato }, "[convite-kit] erro ao gerar formato");
    }
  }
  return resultado;
}'''
    a = a.replace(anchor, kit_fn, 1)
    shutil.copy(ARTGEN, ARTGEN + ".bak-kit")
    open(ARTGEN, "w").write(a)
    print("2. OK: gerarKitConvite adicionada")

# ============================================================
# 3) ROTA /gerar-convite: usar gerarKitConvite e devolver as 3 URLs
# ============================================================
r = open(CONVITE_ROUTE).read()
if "gerarKitConvite" in r:
    print("3. (rota ja usa gerarKitConvite)")
else:
    # import
    if "import { gerarArteBuffer }" in r:
        r = r.replace("import { gerarArteBuffer }", "import { gerarArteBuffer, gerarKitConvite }", 1)
    elif "gerarKitConvite" not in r:
        # adicionar import no topo (apos primeira linha de import de art-generator)
        import re
        m = re.search(r'import \{[^}]*\} from ["\']\.\./services/art-generator["\'];', r)
        if m:
            r = r.replace(m.group(0), m.group(0).replace("}", ", gerarKitConvite }").replace(", , ", ", "), 1)

    # Substituir o bloco que gera 1 arte + sobe 1 URL pelo kit
    old_gen = '''    // 3) Gerar a arte (reusa o motor existente; escolhe o template pela variante num_palestrantes)
    const resultado = await gerarArteBuffer("convite-evento", dados);
    if (!resultado) {
      res.status(404).json({
        error: "Nenhum template ativo encontrado para convite-evento com essa variante (num_palestrantes).",
      });
      return;
    }

    const { buffer, ext, mimetype } = resultado;

    // 4) Gravar em arquivo temporario (uploadToR2 le de disco)
    const filename = `convite-evento-${Date.now()}.${ext}`;
    const tmpPath = path.join(os.tmpdir(), filename);
    await fs.promises.writeFile(tmpPath, buffer);

    // 5) Subir no R2. Convite nao tem solicitacao -> usa id sintetico 0 e campo "convite".
    //    (uploadToR2 apaga o arquivo temporario ao final.)
    const url = await uploadToR2(
      { path: tmpPath, originalname: `convite-evento.${ext}`, mimetype },
      0,
      "convite",
    );

    logger.info({ url }, "[convite] gerado e enviado ao R2");
    res.json({ url });'''

    new_gen = '''    // 3) Gerar o KIT (3 formatos) reusando o motor; cada formato tem seu template
    const kit = await gerarKitConvite(dados);
    const formatos = Object.keys(kit);
    if (formatos.length === 0) {
      res.status(404).json({
        error: "Nenhum template ativo encontrado para convite-evento (verifique as variantes {num}-stories/feed/quadrado).",
      });
      return;
    }

    // 4+5) Para cada formato gerado, gravar temp e subir no R2
    const urls: Record<string, string> = {};
    for (const formato of formatos) {
      const { buffer, ext, mimetype } = kit[formato];
      const filename = `convite-${formato}-${Date.now()}.${ext}`;
      const tmpPath = path.join(os.tmpdir(), filename);
      await fs.promises.writeFile(tmpPath, buffer);
      const url = await uploadToR2(
        { path: tmpPath, originalname: `convite-${formato}.${ext}`, mimetype },
        0,
        "convite",
      );
      urls[formato] = url;
    }

    logger.info({ urls }, "[convite] kit gerado e enviado ao R2");
    res.json({ urls });'''

    if old_gen not in r:
        sys.exit("ERRO: bloco de geracao na rota /gerar-convite nao encontrado (formato esperado).")
    r = r.replace(old_gen, new_gen, 1)
    shutil.copy(CONVITE_ROUTE, CONVITE_ROUTE + ".bak-kit")
    open(CONVITE_ROUTE, "w").write(r)
    print("3. OK: rota /gerar-convite agora gera o kit e devolve { urls }")

print("\nOK (HUB): kit de 3 formatos implementado.")
print("Templates devem ter variant_value: '{num}-stories', '{num}-feed', '{num}-quadrado'")
print("Backups: .bak-kit")

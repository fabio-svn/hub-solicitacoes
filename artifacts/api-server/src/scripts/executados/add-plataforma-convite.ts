/**
 * Adiciona a layer da logo da plataforma (online) aos templates de "convite-evento".
 *
 * COMO FUNCIONA
 *   Presencial -> as text layers {{local_nome}}/{{endereco}} têm valor e aparecem;
 *                 a layer da logo é pulada (campo `plataforma` vazio -> renderImage dá return).
 *   Online     -> local_nome/endereco vêm vazios (as text layers somem sozinhas);
 *                 `plataforma` = youtube|zoom|meet -> a image layer 'variant' resolve a logo.
 *   Nenhuma condicional nova: o renderer já ignora placeholder vazio e variant sem dado.
 *
 * USO
 *   1) Preencha LOGOS abaixo com as URLs do R2.
 *   2) Dry-run (não grava):   pnpm --filter @workspace/api-server exec tsx src/scripts/add-plataforma-convite.ts
 *   3) Aplicar de verdade:    pnpm --filter @workspace/api-server exec tsx src/scripts/add-plataforma-convite.ts --apply
 *
 * Idempotente: se a layer já existe no template, ele é pulado.
 * A posição é derivada das layers de endereço/local de cada template — depois é só
 * ajustar no editor de arte se quiser refinar (drag & drop).
 */
import { db, artTemplatesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import fs from "node:fs";

// >>> PREENCHA COM AS URLs DO R2 <<<
const LOGOS: Record<string, string> = {
  youtube: "https://solicitacoes.portalsvn.com.br/assets/2026-07/38CLCdFZ-YouTube_Logo1.png",
  zoom:    "https://solicitacoes.portalsvn.com.br/assets/2026-07/RbX0oAfo-Zoom-Logo.png",
  meet:    "https://solicitacoes.portalsvn.com.br/assets/2026-07/Y4lrCZcY-google-meet1.png",
  // "live" nao esta no select do form (e usado em outros contextos), mas fica mapeado:
  // se algum payload enviar plataforma: "live", a logo resolve normalmente.
  live:    "https://solicitacoes.portalsvn.com.br/assets/2026-07/z0vCDXlP-live-logo-01.png",
};

const LAYER_ID = "logo_plataforma";
const APPLY = process.argv.includes("--apply");

type AnyLayer = Record<string, any>;

/** Acha as layers de texto que referenciam local/endereço e devolve o bounding box. */
function regiaoDoEndereco(layers: AnyLayer[]): { x: number; y: number; w: number; h: number } | null {
  const alvos = layers.filter(
    (l) =>
      (l.type === "text-line" || l.type === "text-block") &&
      typeof l.content === "string" &&
      /\{\{\s*(local_nome|endereco)\s*\}\}/.test(l.content)
  );
  if (alvos.length === 0) return null;

  const x = Math.min(...alvos.map((l) => Number(l.x) || 0));
  const y = Math.min(...alvos.map((l) => Number(l.y) || 0));
  const right = Math.max(...alvos.map((l) => (Number(l.x) || 0) + (Number(l.w) || 0)));
  // altura: text-block tem h; text-line usa font_size como aproximação
  const bottom = Math.max(
    ...alvos.map((l) => (Number(l.y) || 0) + (Number(l.h) || Number(l.font_size) || 40))
  );
  return { x, y, w: Math.max(right - x, 1), h: Math.max(bottom - y, 1) };
}

function novaLayerLogo(regiao: { x: number; y: number; w: number; h: number }): AnyLayer {
  // A logo ocupa a mesma faixa horizontal do endereço, com altura da própria região
  // (mínimo de 48px para não ficar ilegível). resize_mode 'contain' preserva o aspecto.
  const h = Math.max(regiao.h, 48);
  return {
    id: LAYER_ID,
    name: "Logo da plataforma (online)",
    type: "image",
    x: regiao.x,
    y: regiao.y,
    w: regiao.w,
    h,
    source: {
      type: "variant",
      variant_source: "plataforma",
      variants: { ...LOGOS },
    },
    resize_mode: "contain",
  };
}

async function main() {
  const faltando = Object.entries(LOGOS).filter(([, url]) => !url.trim()).map(([k]) => k);
  if (faltando.length > 0) {
    console.error(`\n✗ Preencha as URLs do R2 em LOGOS: ${faltando.join(", ")}\n`);
    process.exit(1);
  }

  const templates = await db
    .select()
    .from(artTemplatesTable)
    .where(eq(artTemplatesTable.tipo, "convite-evento"));

  if (templates.length === 0) {
    console.error("✗ Nenhum template 'convite-evento' encontrado.");
    process.exit(1);
  }

  // deixa explicito em qual banco estamos mexendo (dev x producao)
  const dbUrl = process.env.DATABASE_URL ?? "";
  const dbHost = dbUrl ? (dbUrl.split("@")[1] ?? "").split("/")[0] : "(DATABASE_URL vazia)";
  console.log(`\nBanco: ${dbHost}`);
  console.log(`${APPLY ? "APLICANDO" : "DRY-RUN (nada será gravado)"} — ${templates.length} template(s)\n`);

  // backup dos configs originais antes de qualquer escrita
  if (APPLY) {
    const arquivo = `backup-convite-templates-${Date.now()}.json`;
    const dump = templates.map((t) => ({ id: t.id, variant_value: t.variant_value, name: t.name, config: t.config }));
    fs.writeFileSync(arquivo, JSON.stringify(dump, null, 2));
    console.log(`  Backup dos configs originais: ${arquivo}\n`);
  }

  let alterados = 0;
  let pulados = 0;
  let semRegiao = 0;

  for (const t of templates) {
    const config = t.config as AnyLayer;
    const layers: AnyLayer[] = Array.isArray(config?.layers) ? config.layers : [];
    const rotulo = `${t.variant_value ?? "-"} (id ${t.id}) "${t.name}"`;

    if (layers.some((l) => l.id === LAYER_ID)) {
      console.log(`  = ${rotulo}: já tem a layer — pulado`);
      pulados++;
      continue;
    }

    const regiao = regiaoDoEndereco(layers);
    if (!regiao) {
      console.log(`  ! ${rotulo}: não achei layer com {{local_nome}}/{{endereco}} — pulado (posicione manualmente no editor)`);
      semRegiao++;
      continue;
    }

    const layer = novaLayerLogo(regiao);
    // índice 0 = mais à frente no render (o renderer inverte o array antes de compor)
    const novoConfig = { ...config, layers: [layer, ...layers] };

    console.log(
      `  + ${rotulo}: logo em x=${layer.x} y=${layer.y} w=${layer.w} h=${layer.h}`
    );

    if (APPLY) {
      await db
        .update(artTemplatesTable)
        .set({ config: novoConfig, updated_at: new Date() })
        .where(eq(artTemplatesTable.id, t.id));
    }
    alterados++;
  }

  console.log(
    `\n${APPLY ? "Gravado" : "Simulado"}: ${alterados} alterado(s), ${pulados} já ok, ${semRegiao} sem região.\n` +
      (APPLY ? "" : "Rode de novo com --apply para gravar.\n")
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Erro:", err);
  process.exit(1);
});
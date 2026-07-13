/**
 * Área Corporate — geração de convites de eventos ONLINE.
 *
 * Acesso: roles "corporate" e "admin".
 *
 * Endpoints (montados sob /api):
 *   POST /corporate/convite/preview  -> renderiza 1 formato (feed) e devolve data URI (não sobe no R2)
 *   POST /corporate/convite/gerar    -> gera o kit (stories/feed/quadrado), sobe no R2, devolve as URLs
 *   GET  /corporate/fotos            -> biblioteca de fotos de palestrantes já enviadas
 *   POST /corporate/fotos/upload     -> envia uma nova foto de palestrante (vai para a biblioteca)
 *
 * As fotos ficam na tabela art_assets (reaproveitada) sob o prefixo de chave
 * "palestrantes/", o que separa a biblioteca dos demais assets sem exigir
 * alteração de schema.
 */
import { Router } from "express";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "../lib/r2-client";
import multer from "multer";
import sharp from "sharp";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, artAssetsTable, usersTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { logger } from "../lib/logger";
import { gerarArteBuffer, gerarKitConvite } from "../services/art-generator";
import { uploadToR2 } from "./r2";
import JSZip from "jszip";

const router = Router();

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/*$/, "/");
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const FOTOS_PREFIX = "palestrantes/";

const upload = multer({ dest: os.tmpdir(), limits: { fileSize: MAX_BYTES, files: 1 } });

/** Roles que podem usar a área Corporate. */
const CORPORATE_ROLES = ["corporate", "admin"] as const;

function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 200);
}

function nanoid8() {
  return crypto.randomBytes(6).toString("base64url");
}

/**
 * Monta os dados do convite a partir do corpo da requisição.
 * `tipo_evento` é sempre "online" nesta área — é o propósito da página.
 */
function montarDados(body: Record<string, unknown>): Record<string, unknown> {
  const num = String(body.num_palestrantes ?? "1").trim() || "1";
  return {
    ...body,
    tipo_evento: "online",
    num_palestrantes: num,
    // presencial não se aplica: garante que as text layers de local/endereço fiquem vazias
    local_nome: "",
    endereco: "",
  };
}

const FORMATOS_VALIDOS = new Set(["stories", "feed", "quadrado"]);

function slug(s: string): string {
  return String(s || "convite")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    .slice(0, 60) || "convite";
}

// ── POST /corporate/convite/preview ───────────────────────────────
// Renderiza só o formato "feed" e devolve como data URI, sem subir nada no R2.
router.post("/corporate/convite/preview", requireAuth, requireRole(...CORPORATE_ROLES), async (req, res): Promise<void> => {
  try {
    const dados = montarDados((req.body ?? {}) as Record<string, unknown>);
    if (!dados.titulo) {
      res.status(400).json({ error: "Informe o título do evento para ver a prévia." });
      return;
    }

    const num = String(dados.num_palestrantes ?? "1");
    const pedido = String((req.body as any)?.formato ?? "feed");
    const formato = FORMATOS_VALIDOS.has(pedido) ? pedido : "feed";

    const art = await gerarArteBuffer("convite-evento", {
      ...dados,
      _variante_convite: `${num}-${formato}`,
    });

    if (!art) {
      res.status(404).json({ error: `Nenhum template ativo para a variante ${num}-${formato}.` });
      return;
    }

    res.json({
      preview: `data:${art.mimetype};base64,${art.buffer.toString("base64")}`,
      formato,
    });
  } catch (err: any) {
    logger.error({ err }, "[corporate] erro ao gerar prévia do convite");
    res.status(500).json({ error: "Não foi possível gerar a prévia." });
  }
});

// ── POST /corporate/convite/gerar ─────────────────────────────────
// Gera o kit completo (stories/feed/quadrado), sobe no R2 e devolve as URLs.
router.post("/corporate/convite/gerar", requireAuth, requireRole(...CORPORATE_ROLES), async (req, res): Promise<void> => {
  try {
    const dados = montarDados((req.body ?? {}) as Record<string, unknown>);
    if (!dados.titulo) {
      res.status(400).json({ error: "Campo 'titulo' é obrigatório." });
      return;
    }

    const kit = await gerarKitConvite(dados);
    const formatos = Object.keys(kit);
    if (formatos.length === 0) {
      res.status(404).json({ error: "Nenhum template ativo encontrado para convite-evento." });
      return;
    }

    const base = slug(String(dados.titulo ?? "convite"));
    const urls: Record<string, string> = {};
    const zip = new JSZip();

    for (const formato of formatos) {
      const { buffer, ext, mimetype } = kit[formato];
      const filename = `convite-${formato}-${Date.now()}.${ext}`;
      const tmpPath = path.join(os.tmpdir(), filename);
      await fs.promises.writeFile(tmpPath, buffer);
      urls[formato] = await uploadToR2(
        { path: tmpPath, originalname: `convite-${formato}.${ext}`, mimetype },
        0,
        "convite",
      );
      // o .zip reaproveita os buffers já renderizados (não gera arte de novo)
      zip.file(`${base}-${formato}.${ext}`, buffer);
    }

    // pacote com os 3 formatos
    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    const zipTmp = path.join(os.tmpdir(), `convite-${Date.now()}.zip`);
    await fs.promises.writeFile(zipTmp, zipBuffer);
    urls.zip = await uploadToR2(
      { path: zipTmp, originalname: `${base}.zip`, mimetype: "application/zip" },
      0,
      "convite",
    );

    logger.info({ urls, user: req.session?.user?.email }, "[corporate] kit de convite gerado");
    res.json({ urls });
  } catch (err: any) {
    logger.error({ err }, "[corporate] erro ao gerar convite");
    res.status(500).json({ error: "Não foi possível gerar o convite." });
  }
});

// ── GET /corporate/fotos ──────────────────────────────────────────
// Biblioteca de fotos de palestrantes (assets sob o prefixo "palestrantes/").
router.get("/corporate/fotos", requireAuth, requireRole(...CORPORATE_ROLES), async (_req, res): Promise<void> => {
  try {
    const rows = await db
      .select({
        id: artAssetsTable.id,
        filename: artAssetsTable.filename,
        url: artAssetsTable.url,
        uploaded_at: artAssetsTable.uploaded_at,
      })
      .from(artAssetsTable)
      .where(sql`${artAssetsTable.storage_key} LIKE ${FOTOS_PREFIX + "%"}`)
      .orderBy(desc(artAssetsTable.uploaded_at))
      .limit(200);

    res.json({ fotos: rows });
  } catch (err: any) {
    logger.error({ err }, "[corporate] erro ao listar fotos");
    res.status(500).json({ error: "Não foi possível carregar a biblioteca de fotos." });
  }
});

// ── POST /corporate/fotos/upload ──────────────────────────────────
router.post(
  "/corporate/fotos/upload",
  requireAuth, requireRole(...CORPORATE_ROLES),
  upload.single("file"),
  async (req, res): Promise<void> => {
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "Nenhum arquivo enviado." });
      return;
    }

    const cleanup = () => fs.promises.unlink(file.path).catch(() => {});

    try {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        await cleanup();
        res.status(400).json({ error: "Tipo inválido. Use PNG, JPG ou WEBP." });
        return;
      }

      const buffer = await fs.promises.readFile(file.path);
      const meta = await sharp(buffer).metadata();

      const yyyyMM = new Date().toISOString().slice(0, 7);
      const safe = sanitizeFilename(file.originalname);
      const key = `${FOTOS_PREFIX}${yyyyMM}/${nanoid8()}-${safe}`;

      const client = getR2Client();
      if (!client || !R2_BUCKET) {
        await cleanup();
        res.status(500).json({ error: "Armazenamento de arquivos não configurado." });
        return;
      }

      await client.send(
        new PutObjectCommand({
          Bucket: R2_BUCKET,
          Key: key,
          Body: buffer,
          ContentType: file.mimetype,
        }),
      );

      const url = `${R2_PUBLIC_URL}${key}`;
      const email = req.session?.user?.email ?? "";
      const [userRow] = email
        ? await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, email))
        : [];

      // o nome do palestrante é o rótulo da foto na biblioteca — é por ele que a
      // foto é reencontrada automaticamente nos próximos convites.
      const nomeInformado = String((req.body as any)?.nome ?? "").trim();

      const [row] = await db
        .insert(artAssetsTable)
        .values({
          filename: (nomeInformado || file.originalname).slice(0, 300),
          storage_key: key,
          url,
          mime_type: file.mimetype,
          size_bytes: buffer.length,
          width: meta.width ?? null,
          height: meta.height ?? null,
          uploaded_by: userRow?.id ?? null,
        })
        .returning({
          id: artAssetsTable.id,
          filename: artAssetsTable.filename,
          url: artAssetsTable.url,
        });

      await cleanup();
      logger.info({ key, user: email }, "[corporate] foto de palestrante enviada");
      res.json({ foto: row });
    } catch (err: any) {
      await cleanup();
      logger.error({ err }, "[corporate] erro no upload de foto");
      res.status(500).json({ error: "Não foi possível enviar a foto." });
    }
  },
);

export default router;
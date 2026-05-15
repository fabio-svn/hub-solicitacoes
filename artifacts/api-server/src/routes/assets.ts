import { Router } from "express";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import multer from "multer";
import sharp from "sharp";
import os from "os";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { db, pool } from "@workspace/db";
import { artAssetsTable, artTemplatesTable, usersTable } from "@workspace/db";
import { eq, desc, sql, and, lt, isNull } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { logger } from "../lib/logger";

const router = Router();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY  = process.env.R2_ACCESS_KEY  || "";
const R2_SECRET_KEY  = process.env.R2_SECRET_KEY  || "";
const R2_BUCKET      = process.env.R2_BUCKET      || "";
const R2_PUBLIC_URL  = (process.env.R2_PUBLIC_URL || "").replace(/\/*$/, "/");

function getS3(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY, secretAccessKey: R2_SECRET_KEY },
  });
}

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_DIM   = 8000;

const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

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

// ── POST /api/admin/assets/upload ────────────────────────────────
router.post(
  "/upload",
  requireAuth,
  requireRole("admin"),
  upload.single("file"),
  async (req, res): Promise<void> => {
    const file = req.file;
    if (!file) { res.status(400).json({ error: "Nenhum arquivo enviado" }); return; }

    const cleanup = () => fs.promises.unlink(file.path).catch(() => {});

    try {
      if (!ALLOWED_MIME.has(file.mimetype)) {
        await cleanup();
        res.status(400).json({ error: "Tipo inválido. Use PNG, JPG, WEBP ou SVG." });
        return;
      }

      // Get dimensions (skip SVG — sharp can't reliably read SVG dimensions)
      let width: number | undefined;
      let height: number | undefined;
      if (file.mimetype !== "image/svg+xml") {
        const meta = await sharp(file.path).metadata();
        width  = meta.width;
        height = meta.height;
        if ((width && width > MAX_DIM) || (height && height > MAX_DIM)) {
          await cleanup();
          res.status(400).json({ error: `Imagem muito grande (máx ${MAX_DIM}×${MAX_DIM}px)` });
          return;
        }
      }

      const now     = new Date();
      const yyyyMM  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      const safe    = sanitizeFilename(file.originalname);
      const key     = `assets/${yyyyMM}/${nanoid8()}-${safe}`;

      const s3 = getS3();
      if (!s3 || !R2_BUCKET) {
        await cleanup();
        res.status(500).json({ error: "R2 não configurado no servidor" });
        return;
      }

      await s3.send(new PutObjectCommand({
        Bucket: R2_BUCKET,
        Key: key,
        Body: fs.createReadStream(file.path),
        ContentType: file.mimetype,
      }));
      await cleanup();

      const url = `${R2_PUBLIC_URL}${key}`;

      const user    = req.session.user!;
      const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));

      const [inserted] = await db.insert(artAssetsTable).values({
        filename: file.originalname,
        storage_key: key,
        url,
        mime_type: file.mimetype,
        size_bytes: file.size,
        width:  width  ?? null,
        height: height ?? null,
        uploaded_by: userRow?.id ?? null,
      }).returning();

      res.json({ id: inserted.id, url: inserted.url, filename: inserted.filename });
    } catch (err) {
      await cleanup();
      logger.error({ err }, "Erro ao fazer upload de asset");
      res.status(500).json({ error: "Erro interno no upload" });
    }
  }
);

// ── GET /api/admin/assets ─────────────────────────────────────────
router.get("/", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const { orphan, uploaded_before, page, limit: lim } = req.query as Record<string, string>;

    const conditions: ReturnType<typeof eq>[] = [];
    if (orphan === "true") {
      conditions.push(sql`array_length(${artAssetsTable.used_in_template_ids}, 1) IS NULL` as any);
    }
    if (uploaded_before) {
      const d = new Date(uploaded_before);
      if (!isNaN(d.getTime())) conditions.push(lt(artAssetsTable.uploaded_at, d));
    }

    const pageNum  = Math.max(1, parseInt(page || "1"));
    const pageSize = Math.min(200, Math.max(1, parseInt(lim || "50")));
    const offset   = (pageNum - 1) * pageSize;

    const rows = await db
      .select()
      .from(artAssetsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(artAssetsTable.uploaded_at))
      .limit(pageSize)
      .offset(offset);

    // Total storage used
    const [totalRow] = await db.select({ total: sql<number>`COALESCE(SUM(size_bytes), 0)` }).from(artAssetsTable);

    res.json({ assets: rows, total_bytes: totalRow?.total ?? 0, page: pageNum, page_size: pageSize });
  } catch (err) {
    logger.error({ err }, "Erro ao listar assets");
    res.status(500).json({ error: "Erro ao listar assets" });
  }
});

// ── DELETE /api/admin/assets/:id ──────────────────────────────────
router.delete("/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [asset] = await db.select().from(artAssetsTable).where(eq(artAssetsTable.id, id));
    if (!asset) { res.status(404).json({ error: "Asset não encontrado" }); return; }

    const usedIn = asset.used_in_template_ids ?? [];
    if (usedIn.length > 0) {
      res.status(409).json({
        error: `Em uso em ${usedIn.length} template${usedIn.length > 1 ? "s" : ""} — remova primeiro`,
      });
      return;
    }

    const s3 = getS3();
    if (s3 && R2_BUCKET) {
      await s3.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: asset.storage_key }));
    }

    await db.delete(artAssetsTable).where(eq(artAssetsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "Erro ao deletar asset");
    res.status(500).json({ error: "Erro ao deletar asset" });
  }
});

// ── POST /api/admin/assets/scan-usage ────────────────────────────
router.post("/scan-usage", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    await scanAssetUsage();
    res.json({ ok: true, message: "Uso de assets recomputado com sucesso" });
  } catch (err) {
    logger.error({ err }, "Erro no scan-usage");
    res.status(500).json({ error: "Erro ao recomputar uso" });
  }
});

async function scanAssetUsage() {
  const templates = await db.select().from(artTemplatesTable);

  // Reset all
  await db.update(artAssetsTable).set({ used_in_template_ids: [], last_used_at: null });

  for (const t of templates) {
    const urls = extractUrlsFromConfig(t.config as any);
    for (const url of urls) {
      const [asset] = await db.select({ id: artAssetsTable.id })
        .from(artAssetsTable)
        .where(eq(artAssetsTable.url, url));
      if (asset) {
        await db.update(artAssetsTable)
          .set({
            used_in_template_ids: sql`array_append(used_in_template_ids, ${t.id})`,
            last_used_at: t.updated_at,
          })
          .where(eq(artAssetsTable.id, asset.id));
      }
    }
  }
}

function extractUrlsFromConfig(config: any): string[] {
  const urls = new Set<string>();
  if (!config) return [];
  if (config.bg?.type === "static" && config.bg.url) urls.add(config.bg.url);
  if (config.bg?.type === "variant" && config.bg.variants) {
    Object.values(config.bg.variants).forEach((u: any) => typeof u === "string" && urls.add(u));
  }
  for (const layer of config.layers || []) {
    if (layer.type === "image") {
      if (layer.source?.type === "static" && layer.source.url) urls.add(layer.source.url);
      if (layer.source?.type === "variant" && layer.source.variants) {
        Object.values(layer.source.variants).forEach((u: any) => typeof u === "string" && urls.add(u));
      }
    }
  }
  return Array.from(urls);
}

export default router;

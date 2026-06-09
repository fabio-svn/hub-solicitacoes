import { PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getR2Client, R2_BUCKET } from "../lib/r2-client";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import { logger } from "../lib/logger";
import { logEventoBg } from "../services/activity-log";

const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/*$/, "/");


function buildContentDisposition(raw: string): string {
  const sanitized = raw
    .replace(/["]/g, "")
    .replace(/[\r\n]/g, "")
    .replace(/[/\\]/g, "-")
    .replace(/[\x00-\x1f\x7f]/g, "");
  const asciiFallback = sanitized
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, "");
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodeURIComponent(sanitized)}`;
}

export async function uploadToR2(
  file: { path: string; originalname: string; mimetype: string },
  solicitacaoId: number,
  campo: string,
  downloadName?: string
): Promise<string> {
  const client = getR2Client();

  if (!client || !R2_BUCKET) {
    throw new Error(
      "R2 não configurado. Verifique R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY e R2_SECRET_KEY no ambiente."
    );
  }

  const lastDot = file.originalname.lastIndexOf(".");
  const ext = lastDot !== -1 ? file.originalname.slice(lastDot + 1) : "";
  const key = `solicitacoes/${solicitacaoId}/${campo}/${uuidv4()}.${ext}`;

  try {
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: fs.createReadStream(file.path),
      ContentType: file.mimetype,
      ...(downloadName ? { ContentDisposition: buildContentDisposition(downloadName) } : {}),
    }));
  } finally {
    await fs.promises.unlink(file.path).catch(() => {});
  }

  const url = `${R2_PUBLIC_URL}${key}`;
  logEventoBg(solicitacaoId, {
    tipo: "info",
    origem: "r2",
    mensagem: "Arquivo subido para R2",
    detalhes: { chave: key, content_type: file.mimetype },
  });
  return url;
}

export async function deleteFromR2(urlOrKey: string): Promise<void> {
  const client = getR2Client();
  if (!client || !R2_BUCKET) {
    logger.warn("[r2] deleteFromR2: cliente não configurado, pulando exclusão");
    return;
  }
  const key = R2_PUBLIC_URL && urlOrKey.startsWith(R2_PUBLIC_URL)
    ? urlOrKey.slice(R2_PUBLIC_URL.length)
    : urlOrKey;
  try {
    await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
    logger.info({ key }, "[r2] arquivo excluído com sucesso");
  } catch (err) {
    logger.error({ err, key }, "[r2] falha ao excluir arquivo do R2");
  }
}

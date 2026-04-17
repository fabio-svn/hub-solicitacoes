import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID || "";
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY || "";
const R2_SECRET_KEY = process.env.R2_SECRET_KEY || "";
const R2_BUCKET = process.env.R2_BUCKET || "";
const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL || "").replace(/\/*$/, "/");

let s3Client: S3Client | null = null;

function getS3Client(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY || !R2_SECRET_KEY) {
    return null;
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: "auto",
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY,
      },
    });
  }
  return s3Client;
}

export async function uploadToR2(
  file: { buffer: Buffer; originalname: string; mimetype: string },
  solicitacaoId: number,
  campo: string
): Promise<string> {
  const client = getS3Client();

  if (!client || !R2_BUCKET) {
    logger.error({ solicitacaoId, campo }, "R2 não configurado — arquivo não salvo, retornando placeholder");
    const baseUrl = process.env.R2_PUBLIC_URL?.replace(/\/*$/, "/") || "";
    if (!baseUrl) {
      logger.error("R2_PUBLIC_URL ausente — URL do arquivo ficará inválida");
    }
    return `${baseUrl}solicitacoes/${solicitacaoId}/${campo}/${file.originalname}`;
  }

  const ext = file.originalname.split(".").pop() || "";
  const key = `solicitacoes/${solicitacaoId}/${campo}/${uuidv4()}.${ext}`;

  await client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }));

  return `${R2_PUBLIC_URL}${key}`;
}

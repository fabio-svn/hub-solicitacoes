import os from "os";
import path from "path";
import fs from "fs";
import { Router } from "express";
import { gerarArteBuffer, gerarKitConvite } from "../services/art-generator";
import { uploadToR2 } from "./r2";
import { logger } from "../lib/logger";

const router = Router();

/**
 * POST /api/gerar-convite
 * Gera um convite de evento a partir de um template "convite-evento" e retorna a URL no R2.
 * Chamado pelo Sistema de Eventos (maquina-a-maquina).
 *
 * Auth: header x-internal-secret == process.env.INTERNAL_API_SECRET
 *
 * Body JSON:
 *   { dados: { tipo_evento, titulo, num_palestrantes, horario_brasilia, data, horario,
 *              local_nome, endereco, palestrante_1_nome, ... palestrante_3_foto } }
 *
 * Resposta: { url: string }
 */
router.post("/gerar-convite", async (req, res): Promise<void> => {
  try {
    // 1) Auth interna (mesmo padrao das rotas n8n -> Hub)
    const secret = process.env.INTERNAL_API_SECRET;
    const provided = req.headers["x-internal-secret"];
    if (!secret || provided !== secret) {
      res.status(401).json({ error: "Nao autorizado" });
      return;
    }

    // 2) Validar payload
    const dados = (req.body && req.body.dados) as Record<string, unknown> | undefined;
    if (!dados || typeof dados !== "object") {
      res.status(400).json({ error: "Campo 'dados' (objeto) e obrigatorio" });
      return;
    }
    if (!dados.titulo) {
      res.status(400).json({ error: "Campo 'dados.titulo' e obrigatorio" });
      return;
    }

    // 3) Gerar o KIT reusando o motor. Por padrao os 3 formatos; se o request
    // passar `formatos` (lista), gera so esses — usado pela previa rapida (1 formato).
    const formatosPedidos = Array.isArray((req.body as any)?.formatos)
      ? ((req.body as any).formatos as unknown[]).filter((x): x is string => typeof x === "string")
      : undefined;
    const kit = await gerarKitConvite(dados, formatosPedidos);
    const formatos = Object.keys(kit);
    if (formatos.length === 0) {
      res.status(404).json({
        error: "Nenhum template ativo encontrado para convite-evento (verifique as variantes {num}-stories/feed/quadrado).",
      });
      return;
    }

    // 4+5) Para cada formato gerado, gravar temp e subir no R2
    const eventIdRaw = (req.body && req.body.event_id) ? String(req.body.event_id) : "";
    const eventId = eventIdRaw.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 64);
    const numConvite = String(dados["num_palestrantes"] ?? "").trim() || "1";
    const urls: Record<string, string> = {};
    for (const formato of formatos) {
      const { buffer, ext, mimetype } = kit[formato];
      const filename = `convite-${formato}-${Date.now()}.${ext}`;
      const tmpPath = path.join(os.tmpdir(), filename);
      await fs.promises.writeFile(tmpPath, buffer);
      const fixedKey = eventId
        ? `solicitacoes/0/convite/${eventId}-${numConvite}-${formato}.${ext}`
        : undefined;
      const url = await uploadToR2(
        { path: tmpPath, originalname: `convite-${formato}.${ext}`, mimetype },
        0,
        "convite",
        undefined,
        fixedKey,
      );
      urls[formato] = fixedKey ? `${url}?v=${Date.now()}` : url;
    }

    logger.info({ urls }, "[convite] kit gerado e enviado ao R2");
    res.json({ urls });
  } catch (err: any) {
    logger.error({ err }, "[convite] erro ao gerar convite");
    res.status(500).json({ error: "Erro ao gerar convite", detalhe: err?.message });
  }
});

export default router;

import os from "os";
import path from "path";
import fs from "fs";
import { Router } from "express";
import { gerarArteBuffer } from "../services/art-generator";
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

    // 3) Gerar a arte (reusa o motor existente; escolhe o template pela variante num_palestrantes)
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
    res.json({ url });
  } catch (err: any) {
    logger.error({ err }, "[convite] erro ao gerar convite");
    res.status(500).json({ error: "Erro ao gerar convite", detalhe: err?.message });
  }
});

export default router;

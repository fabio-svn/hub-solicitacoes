import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, activityLogTable, artTemplatesTable, solicitacoesTable, userTipoAssignmentsTable, tipoClickupListTable, clickupListsTable, tombamentosTable } from "@workspace/db";
import { eq, desc, sql, and, count, isNull, notInArray } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "../services/template-renderer";
import { gerarArteParaSolicitacao, gerarArteBuffer } from "../services/art-generator";
import JSZip from "jszip";
import { AVAILABLE_FONTS } from "../types/art-template";
import { FORM_SCHEMAS, getFormSchemaList, TIPOS_COM_CLICKUP } from "../config/form-schemas";
import { isRole } from "../config/roles";
import { validateClickUpList } from "./clickup";
import { logAtividadeBg } from "../services/activity-log";
import multer from "multer";
import * as XLSX from "xlsx";

const TIPOS_COM_CLICKUP_SET = new Set(TIPOS_COM_CLICKUP.map(t => t.tipo));

const router = Router();


// ───────────── Tombamentos: leitura da planilha (Fase 1) ─────────────
const uploadPlanilha = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const uploadFotos = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const TOMB_DOMINIOS = ["@svninvestimentos.com.br", "@svncapital.com.br", "@svnconnect.com.br"];
const TOMB_SYN: Record<string, string[]> = {
  nome: ["nome", "nomecompleto"],
  email: ["email", "e mail"],
  telefone: ["telefone", "whatsapp", "celular", "fone"],
  marca: ["marca", "contrato", "contratosocial"],
  cargo: ["cargo", "funcao"],
  tem_cfp: ["temcfp", "cfp"],
  arquivo_foto: ["arquivofoto", "foto", "arquivodafoto", "nomedoarquivo", "imagem"],
};
function tombNorm(s: unknown): string {
  return String(s ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
}
function parseTombamentoPlanilha(buf: Buffer): { rows: Array<Record<string, unknown>> } {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) return { rows: [] };
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false, defval: "" }) as any[][];
  if (!aoa.length) return { rows: [] };
  const headers = (aoa[0] || []).map((h) => String(h ?? "").trim());
  const colToField: Record<number, string> = {};
  headers.forEach((h, i) => {
    const n = tombNorm(h);
    for (const [field, syns] of Object.entries(TOMB_SYN)) {
      if (syns.map(tombNorm).includes(n)) { colToField[i] = field; break; }
    }
  });
  const rows = aoa.slice(1).map((cells, idx) => {
    const r: Record<string, unknown> = { _linha: idx + 2 };
    headers.forEach((_, i) => { if (colToField[i]) r[colToField[i]] = String(cells[i] ?? "").trim(); });
    const issues: string[] = [];
    if (!r.nome) issues.push("sem nome");
    const email = String(r.email || "").toLowerCase();
    if (!email) issues.push("sem e-mail");
    else if (!TOMB_DOMINIOS.some((d) => email.endsWith(d))) issues.push("e-mail fora dos domínios SVN");
    r._issues = issues;
    return r;
  });
  return { rows };
}

router.post("/tombamentos/parse", requireRole("admin", "capital_humano"), uploadPlanilha.single("planilha"), (req, res): void => {
  try {
    const file = (req as { file?: { buffer: Buffer } }).file;
    if (!file) { res.status(400).json({ error: "Envie a planilha no campo 'planilha'." }); return; }
    res.json(parseTombamentoPlanilha(file.buffer));
  } catch (err) {
    logger.error({ err }, "[tombamentos] erro ao ler planilha");
    res.status(400).json({ error: "Não foi possível ler a planilha. Confira se é um .xlsx, .xls ou .csv válido." });
  }
});

router.post("/tombamentos", requireRole("admin", "capital_humano"), async (req, res): Promise<void> => {
  try {
    const { nome, marca } = req.body as { nome?: string; marca?: string };
    if (!nome || !nome.trim()) { res.status(400).json({ error: "Informe o nome do tombamento." }); return; }
    if (!marca || !marca.trim()) { res.status(400).json({ error: "Selecione a marca." }); return; }
    const [row] = await db.insert(tombamentosTable).values({
      nome: nome.trim(),
      marca: marca.trim(),
      created_by: req.session.user?.email ?? null,
    }).returning();
    res.json(row);
  } catch (err) {
    logger.error({ err }, "[tombamentos] erro ao criar");
    res.status(500).json({ error: "Erro ao criar tombamento." });
  }
});

router.get("/tombamentos", requireRole("admin", "capital_humano"), async (_req, res): Promise<void> => {
  const rows = await db.select().from(tombamentosTable).orderBy(desc(tombamentosTable.created_at));
  res.json({ tombamentos: rows });
});

router.get("/tombamentos/:id", requireRole("admin", "capital_humano"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const [row] = await db.select().from(tombamentosTable).where(eq(tombamentosTable.id, id));
  if (!row) { res.status(404).json({ error: "Tombamento não encontrado" }); return; }
  res.json(row);
});

router.patch("/tombamentos/:id", requireRole("admin", "capital_humano"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
  const { linhas, nome } = req.body as { linhas?: unknown; nome?: string };
  const patch: Record<string, unknown> = { updated_at: new Date() };
  if (linhas !== undefined) patch.linhas = linhas;
  if (nome !== undefined && String(nome).trim()) patch.nome = String(nome).trim();
  const [row] = await db.update(tombamentosTable).set(patch).where(eq(tombamentosTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Tombamento não encontrado" }); return; }
  res.json(row);
});

function tombSlug(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").toLowerCase() || "pessoa";
}
function tombNormCfp(v: unknown): string {
  const n = String(v ?? "").toLowerCase().trim();
  return ["sim", "s", "yes", "y", "1", "true", "x"].includes(n) ? "sim" : "nao";
}

router.post("/tombamentos/:id/gerar-assinaturas", requireRole("admin", "capital_humano"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [tomb] = await db.select().from(tombamentosTable).where(eq(tombamentosTable.id, id));
    if (!tomb) { res.status(404).json({ error: "Tombamento não encontrado" }); return; }

    const linhas = Array.isArray(tomb.linhas) ? (tomb.linhas as any[]) : [];
    if (!linhas.length) { res.status(400).json({ error: "Suba uma planilha neste tombamento primeiro." }); return; }
    const validas = linhas.filter((r) => !(Array.isArray(r._issues) && r._issues.length));
    if (!validas.length) { res.status(400).json({ error: "Nenhuma linha válida para gerar (todas têm pendências)." }); return; }

    const zip = new JSZip();
    const usados: Record<string, number> = {};
    const gerados: string[] = [];
    const pulados: string[] = [];
    let semTemplate = false;

    for (const r of validas) {
      const dados = {
        nome: r.nome, telefone: r.telefone, email: r.email,
        cargo: r.cargo ?? "", tem_cfp: tombNormCfp(r.tem_cfp), marca: tomb.marca,
      };
      try {
        const art = await gerarArteBuffer("assinatura-email", dados);
        if (!art) { semTemplate = true; pulados.push(`${r.nome || r.email}: sem template para a marca`); continue; }
        let base = tombSlug(r.nome || r.email);
        usados[base] = (usados[base] || 0) + 1;
        if (usados[base] > 1) base = `${base}-${usados[base]}`;
        zip.file(`assinatura-${base}.${art.ext}`, art.buffer);
        gerados.push(r.nome || r.email);
      } catch (e) {
        pulados.push(`${r.nome || r.email}: erro ao gerar`);
        logger.warn({ err: e, tombId: id }, "[tombamentos] falha ao gerar assinatura");
      }
    }

    if (!gerados.length) {
      res.status(400).json({ error: semTemplate ? `Não há template de assinatura ativo para a marca "${tomb.marca}".` : "Não foi possível gerar nenhuma assinatura." });
      return;
    }

    const relatorio = [
      `Tombamento: ${tomb.nome}`,
      `Marca: ${tomb.marca}`,
      `Assinaturas geradas: ${gerados.length}`,
      pulados.length ? `\nPuladas (${pulados.length}):\n` + pulados.join("\n") : "",
    ].join("\n");
    zip.file("_relatorio.txt", relatorio);

    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="assinaturas-${tombSlug(tomb.nome)}.zip"`);
    res.setHeader("X-Geradas", String(gerados.length));
    res.setHeader("X-Puladas", String(pulados.length));
    res.send(zipBuf);
  } catch (err) {
    logger.error({ err }, "[tombamentos] erro ao gerar assinaturas");
    res.status(500).json({ error: "Erro ao gerar assinaturas." });
  }
});

const MARCA_TO_CONTRATO: Record<string, string> = {
  "svn-investimentos": "svn-investimentos",
  "svn-capital": "svn-capital",
  "svn-connect": "svn-connect",
};
function tombStripExt(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, "");
}
function tombMime(name: string): string {
  const ext = (name.match(/\.([a-z0-9]+)$/i)?.[1] || "").toLowerCase();
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  return "image/jpeg";
}
function tombNorm2(s: unknown): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function tombTokens(s: unknown): string[] {
  return tombNorm2(s).split(" ").filter(Boolean);
}
function tombCompact(s: unknown): string {
  return tombNorm2(s).replace(/ /g, "");
}
function tombMatchScore(pTokens: string[], pCompact: string, fTokens: string[], fCompact: string): { score: number; contained: boolean; inter: number } {
  if (!pTokens.length || !fTokens.length) return { score: 0, contained: false, inter: 0 };
  if (pCompact && pCompact === fCompact) return { score: 100, contained: true, inter: pTokens.length };
  const pSet = new Set(pTokens);
  const fSet = new Set(fTokens);
  let inter = 0;
  for (const t of fSet) if (pSet.has(t)) inter++;
  if (inter === 0) return { score: 0, contained: false, inter: 0 };
  const allFInP = [...fSet].every((t) => pSet.has(t));
  const allPInF = [...pSet].every((t) => fSet.has(t));
  const contained = allFInP || allPInF;
  if (contained) return { score: 80 + Math.min(inter, 4) * 4, contained: true, inter };
  const union = pSet.size + fSet.size - inter;
  return { score: Math.round(55 * (inter / union)), contained: false, inter };
}

// Cache em memória do .zip de fotos durante a revisão (evita re-upload + permite prévia).
const tombZipCache = new Map<number, { buffer: Buffer; expires: number }>();
const TOMB_ZIP_TTL_MS = 30 * 60 * 1000;
function tombZipCacheSet(id: number, buffer: Buffer): void {
  const now = Date.now();
  for (const [k, v] of tombZipCache) if (v.expires < now) tombZipCache.delete(k);
  tombZipCache.set(id, { buffer, expires: now + TOMB_ZIP_TTL_MS });
  while (tombZipCache.size > 3) {
    let oldestK: number | null = null; let oldestE = Infinity;
    for (const [k, v] of tombZipCache) { if (k !== id && v.expires < oldestE) { oldestE = v.expires; oldestK = k; } }
    if (oldestK == null) break;
    tombZipCache.delete(oldestK);
  }
}
function tombZipCacheGet(id: number): Buffer | null {
  const v = tombZipCache.get(id);
  if (!v) return null;
  if (v.expires < Date.now()) { tombZipCache.delete(id); return null; }
  return v.buffer;
}

// Lê o .zip de fotos e devolve a lista de imagens válidas (sem ler os bytes).
function lerNomesFotos(fotosZip: JSZip): { nome: string; tokens: string[]; compact: string }[] {
  const fotos: { nome: string; tokens: string[]; compact: string }[] = [];
  const seen = new Set<string>();
  for (const entryPath of Object.keys(fotosZip.files)) {
    const entry = fotosZip.files[entryPath];
    if (entry.dir) continue;
    const base = entryPath.split(/[\\/]/).pop() || "";
    if (!base || base.startsWith(".") || entryPath.includes("__MACOSX")) continue;
    if (!/\.(jpe?g|png|webp|gif)$/i.test(base)) continue;
    if (seen.has(base.toLowerCase())) continue;
    seen.add(base.toLowerCase());
    const noext = tombStripExt(base);
    fotos.push({ nome: base, tokens: tombTokens(noext), compact: tombCompact(noext) });
  }
  return fotos;
}

// Etapa 1: sobe o .zip, casa as fotos por nome e devolve a tabela de revisão.
router.post("/tombamentos/:id/match-fotos", requireRole("admin", "capital_humano"), uploadFotos.single("fotos"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [tomb] = await db.select().from(tombamentosTable).where(eq(tombamentosTable.id, id));
    if (!tomb) { res.status(404).json({ error: "Tombamento não encontrado" }); return; }

    const contrato = MARCA_TO_CONTRATO[String(tomb.marca)];
    if (!contrato) { res.status(400).json({ error: `Cartão digital existe apenas para SVN Investimentos, SVN Capital e SVN Connect. Este tombamento é da marca "${tomb.marca}".` }); return; }

    const linhas = Array.isArray(tomb.linhas) ? (tomb.linhas as any[]) : [];
    if (!linhas.length) { res.status(400).json({ error: "Suba uma planilha neste tombamento primeiro." }); return; }
    const validas = linhas.filter((r) => !(Array.isArray(r._issues) && r._issues.length));
    if (!validas.length) { res.status(400).json({ error: "Nenhuma linha válida (todas têm pendências)." }); return; }

    const file = (req as { file?: { buffer: Buffer } }).file;
    if (!file) { res.status(400).json({ error: "Envie o .zip de fotos no campo 'fotos'." }); return; }
    let fotosZip: JSZip;
    try { fotosZip = await JSZip.loadAsync(file.buffer); }
    catch { res.status(400).json({ error: "Não foi possível ler o .zip de fotos. Confira o arquivo." }); return; }
    tombZipCacheSet(id, file.buffer);

    const fotos = lerNomesFotos(fotosZip);
    if (!fotos.length) { res.status(400).json({ error: "O .zip não contém imagens (.jpg, .png, .webp)." }); return; }

    const usoAuto: Record<string, number> = {};
    const pessoas = validas.map((r) => {
      const pTokens = tombTokens(r.nome);
      const pCompact = tombCompact(r.nome);

      // override manual via coluna arquivo_foto
      const ref = String(r.arquivo_foto ?? "").trim();
      if (ref) {
        const rk = tombCompact(tombStripExt(ref));
        const hit = fotos.find((f) => f.nome.toLowerCase() === ref.toLowerCase() || f.compact === rk);
        if (hit) return { email: r.email, nome: r.nome, status: "manual", foto: hit.nome, obs: "" };
        return { email: r.email, nome: r.nome, status: "revisar", foto: "", obs: `arquivo_foto "${ref}" não encontrado no .zip` };
      }

      // auto por nome
      let best: null | { f: (typeof fotos)[number]; score: number; contained: boolean; inter: number } = null;
      for (const f of fotos) {
        const m = tombMatchScore(pTokens, pCompact, f.tokens, f.compact);
        if (!best || m.score > best.score) best = { f, ...m };
      }
      if (!best || (best.score < 35 && !best.contained)) {
        return { email: r.email, nome: r.nome, status: "sem_foto", foto: "", obs: "" };
      }
      let status: string;
      if (best.score >= 100) status = "exato";
      else if (best.contained && best.inter >= 2) status = "forte";
      else status = "revisar";
      if (status === "exato" || status === "forte") usoAuto[best.f.nome] = (usoAuto[best.f.nome] || 0) + 1;
      return { email: r.email, nome: r.nome, status, foto: best.f.nome, obs: "" };
    });

    // conflito: mesma foto auto-escolhida para >1 pessoa -> rebaixa para revisão
    for (const p of pessoas) {
      if ((p.status === "exato" || p.status === "forte") && usoAuto[p.foto] > 1) {
        p.status = "revisar";
        p.obs = "mesma foto sugerida para outra pessoa";
      }
    }

    const resumo = {
      total: pessoas.length,
      auto: pessoas.filter((p) => p.status === "exato" || p.status === "forte" || p.status === "manual").length,
      revisar: pessoas.filter((p) => p.status === "revisar").length,
      sem_foto: pessoas.filter((p) => p.status === "sem_foto").length,
      fotos: fotos.length,
    };
    res.json({ contrato, fotos: fotos.map((f) => f.nome).sort((a, b) => a.localeCompare(b)), pessoas, resumo });
  } catch (err) {
    logger.error({ err }, "[tombamentos] erro ao casar fotos");
    res.status(400).json({ error: "Erro ao analisar as fotos." });
  }
});

// Etapa 2: gera os cartões usando as atribuições confirmadas na revisão.
router.post("/tombamentos/:id/gerar-cartoes", requireRole("admin", "capital_humano"), uploadFotos.single("fotos"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [tomb] = await db.select().from(tombamentosTable).where(eq(tombamentosTable.id, id));
    if (!tomb) { res.status(404).json({ error: "Tombamento não encontrado" }); return; }

    const contrato = MARCA_TO_CONTRATO[String(tomb.marca)];
    if (!contrato) { res.status(400).json({ error: `Cartão digital existe apenas para SVN Investimentos, SVN Capital e SVN Connect. Este tombamento é da marca "${tomb.marca}".` }); return; }

    const linhas = Array.isArray(tomb.linhas) ? (tomb.linhas as any[]) : [];
    const validas = linhas.filter((r) => !(Array.isArray(r._issues) && r._issues.length));
    if (!validas.length) { res.status(400).json({ error: "Nenhuma linha válida." }); return; }

    let atrib: Record<string, string> = {};
    try { atrib = JSON.parse(String((req.body as any)?.atribuicoes ?? "{}")); } catch { atrib = {}; }
    if (!atrib || typeof atrib !== "object" || !Object.keys(atrib).length) {
      res.status(400).json({ error: "Nenhuma atribuição de foto recebida." });
      return;
    }

    const file = (req as { file?: { buffer: Buffer } }).file;
    const srcZipBuf = file ? file.buffer : tombZipCacheGet(id);
    if (!srcZipBuf) { res.status(410).json({ error: "Sessão expirada — reenvie o .zip de fotos.", expired: true }); return; }
    let fotosZip: JSZip;
    try { fotosZip = await JSZip.loadAsync(srcZipBuf); }
    catch { res.status(400).json({ error: "Não foi possível ler o .zip de fotos. Confira o arquivo." }); return; }

    const porNome: Record<string, { buffer: Buffer; mime: string }> = {};
    for (const entryPath of Object.keys(fotosZip.files)) {
      const entry = fotosZip.files[entryPath];
      if (entry.dir) continue;
      const base = entryPath.split(/[\\/]/).pop() || "";
      if (!base || base.startsWith(".") || entryPath.includes("__MACOSX")) continue;
      if (!/\.(jpe?g|png|webp|gif)$/i.test(base)) continue;
      porNome[base.toLowerCase()] = { buffer: Buffer.from(await entry.async("nodebuffer")), mime: tombMime(base) };
    }

    const zip = new JSZip();
    const usados: Record<string, number> = {};
    const gerados: string[] = [];
    const pulados: string[] = [];

    for (const r of validas) {
      const pessoa = r.nome || r.email;
      const fname = atrib[String(r.email)];
      if (!fname) { pulados.push(`${pessoa}: sem foto atribuída`); continue; }
      const foto = porNome[String(fname).toLowerCase()];
      if (!foto) { pulados.push(`${pessoa}: foto "${fname}" não está no .zip`); continue; }
      const dataUri = `data:${foto.mime};base64,${foto.buffer.toString("base64")}`;
      const dados = { nome: r.nome, telefone: r.telefone, email: r.email, contrato_social: contrato, foto_perfil: dataUri };
      try {
        const art = await gerarArteBuffer("cartao-visita-digital", dados);
        if (!art) { pulados.push(`${pessoa}: sem template de cartão para "${contrato}"`); continue; }
        let nb = tombSlug(pessoa);
        usados[nb] = (usados[nb] || 0) + 1;
        if (usados[nb] > 1) nb = `${nb}-${usados[nb]}`;
        zip.file(`cartao-${nb}.${art.ext}`, art.buffer);
        gerados.push(pessoa);
      } catch (e) {
        pulados.push(`${pessoa}: erro ao gerar`);
        logger.warn({ err: e, tombId: id }, "[tombamentos] falha ao gerar cartão");
      }
    }

    if (!gerados.length) {
      res.status(400).json({ error: "Nenhum cartão gerado. Confira as atribuições de foto na revisão." });
      return;
    }

    const relatorio = [
      `Tombamento: ${tomb.nome}`,
      `Marca / contrato: ${tomb.marca} -> ${contrato}`,
      `Cartões gerados: ${gerados.length}`,
      pulados.length ? `\nPulados (${pulados.length}):\n` + pulados.join("\n") : "",
    ].join("\n");
    zip.file("_relatorio.txt", relatorio);

    const zipBuf = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="cartoes-${tombSlug(tomb.nome)}.zip"`);
    res.setHeader("X-Geradas", String(gerados.length));
    res.setHeader("X-Puladas", String(pulados.length));
    res.send(zipBuf);
  } catch (err) {
    logger.error({ err }, "[tombamentos] erro ao gerar cartões");
    res.status(500).json({ error: "Erro ao gerar cartões digitais." });
  }
});

// Prévia de uma foto do .zip em cache (usada pelo ícone de olho na revisão).
router.get("/tombamentos/:id/foto", requireRole("admin", "capital_humano"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    const nome = String(req.query.nome ?? "");
    if (isNaN(id) || !nome) { res.status(400).end(); return; }
    const buf = tombZipCacheGet(id);
    if (!buf) { res.status(410).json({ error: "Prévia expirada. Reenvie o .zip." }); return; }
    const zip = await JSZip.loadAsync(buf);
    const target = nome.toLowerCase();
    let hit: any = null; let hitName = "";
    for (const entryPath of Object.keys(zip.files)) {
      const entry = zip.files[entryPath];
      if (entry.dir) continue;
      const base = entryPath.split(/[\\/]/).pop() || "";
      if (base.toLowerCase() === target) { hit = entry; hitName = base; break; }
    }
    if (!hit) { res.status(404).json({ error: "Foto não encontrada" }); return; }
    res.setHeader("Content-Type", tombMime(hitName));
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(await hit.async("nodebuffer"));
  } catch (err) {
    logger.error({ err }, "[tombamentos] erro na prévia de foto");
    res.status(500).end();
  }
});

// Exclui um tombamento.
router.delete("/tombamentos/:id", requireRole("admin", "capital_humano"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id), 10);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [row] = await db.delete(tombamentosTable).where(eq(tombamentosTable.id, id)).returning();
    if (!row) { res.status(404).json({ error: "Tombamento não encontrado" }); return; }
    tombZipCache.delete(id);
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "[tombamentos] erro ao deletar tombamento");
    res.status(500).json({ error: "Erro ao deletar tombamento." });
  }
});

router.get("/users", requireRole("admin"), async (req, res) => {
  try {
    const users = await db.select().from(usersTable);
    const assignments = await db.select().from(userTipoAssignmentsTable);

    const byUserId = new Map<number, string[]>();
    for (const a of assignments) {
      const list = byUserId.get(a.user_id) || [];
      list.push(a.tipo);
      byUserId.set(a.user_id, list);
    }

    const enriched = users.map(u => ({
      ...u,
      tipos_assigned: byUserId.get(u.id) || [],
    }));

    res.json(enriched);
  } catch (err: any) {
    req.log.error({ err }, "Erro ao listar usuários");
    res.status(500).json({ error: "Erro ao listar usuários", code: err.code });
  }
});

router.put("/users/:id/role", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const userId = parseInt(String(req.params.id));
    if (isNaN(userId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { role } = req.body as { role: string };
    const currentUser = req.session.user!;

    if (!isRole(role)) {
      res.status(400).json({ error: "Role inválida" });
      return;
    }

    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!targetUser) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    if (targetUser.email === currentUser.email) {
      res.status(400).json({ error: "Não é possível alterar sua própria role" });
      return;
    }

    await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId));

    logAtividadeBg({
      userEmail: currentUser.email, userName: currentUser.name,
      tipo: "usuario_papel_alterado", nivel: "warn",
      detalhe: `${currentUser.email} alterou o papel de ${targetUser.email}: "${targetUser.role || "colaborador"}" → "${role}"`,
      metadata: { targetEmail: targetUser.email, de: targetUser.role || "colaborador", para: role },
    });

    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao alterar role");
    res.status(500).json({ error: "Erro ao alterar role", code: err.code });
  }
});

router.post("/impersonate", requireRole("admin", "gestor"), async (req, res): Promise<void> => {
  try {
    const { email } = req.body as { email: string };
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "E-mail inválido" });
      return;
    }
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.email, email));
    if (!targetUser) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }

    db.insert(activityLogTable).values({
      user_email: req.session.user?.email,
      user_name: req.session.user?.name,
      tipo: "impersonate_inicio",
      nivel: "warn" as any,
      detalhe: `${req.session.user?.email} assumiu a conta de ${targetUser.email}`,
      metadata: { admin: req.session.user?.email, alvo: targetUser.email } as any,
    }).catch(() => {});
    req.session.adminOriginal = req.session.user;
    // O perfil do MySQL (telefone, cargo, unidade) fica cacheado na sessao e a
    // sessao nao muda ao impersonar — sem descartar aqui, os formularios
    // preencheriam com os dados de quem impersonou.
    delete req.session.userProfile;
    req.session.user = {
      email: targetUser.email,
      name: targetUser.name || email.split("@")[0],
      role: targetUser.role || "colaborador",
    };
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Erro ao salvar sessão de impersonar");
        res.status(500).json({ error: "Erro ao impersonar", code: (err as any).code });
        return;
      }
      res.json({ success: true, email });
    });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao impersonar");
    res.status(500).json({ error: "Erro ao impersonar", code: err.code });
  }
});

router.post("/impersonate/stop", requireAuth, async (req, res): Promise<void> => {
  try {
    if (req.session.adminOriginal) {
      const _adminEmail = req.session.adminOriginal.email;
      const _alvoEmail = req.session.user?.email ?? "desconhecido";
      db.insert(activityLogTable).values({
        user_email: _adminEmail,
        user_name: req.session.adminOriginal.name,
        tipo: "impersonate_fim",
        nivel: "info" as any,
        detalhe: `${_adminEmail} encerrou o impersonate de ${_alvoEmail}`,
        metadata: { admin: _adminEmail, alvo: _alvoEmail } as any,
      }).catch(() => {});
      req.session.user = req.session.adminOriginal;
      delete req.session.adminOriginal;
      // mesma razao da entrada: o cache agora e do usuario impersonado
      delete req.session.userProfile;
    }
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Erro ao salvar sessão ao sair impersonar");
        res.status(500).json({ error: "Erro ao sair", code: (err as any).code });
        return;
      }
      res.json({ success: true });
    });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao sair impersonar");
    res.status(500).json({ error: "Erro ao sair", code: err.code });
  }
});

router.put("/users/:id/clickup_user_id", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const userId = parseInt(String(req.params.id));
    if (isNaN(userId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { clickup_user_id } = req.body as { clickup_user_id: string | null };
    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!targetUser) {
      res.status(404).json({ error: "Usuário não encontrado" });
      return;
    }
    await db.update(usersTable).set({ clickup_user_id: clickup_user_id || null }).where(eq(usersTable.id, userId));
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao atualizar clickup_user_id");
    res.status(500).json({ error: "Erro ao atualizar ClickUp User ID", code: err.code });
  }
});

router.get("/activity-log", requireAuth, async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    if (user.role !== "admin" && user.role !== "gestor") {
      res.status(403).json({ error: "Acesso negado" }); return;
    }
    const page = Math.max(1, parseInt(String(req.query.page)) || 1);
    const limit = Math.min(50, parseInt(String(req.query.limit)) || 30);
    const offset = (page - 1) * limit;

    const conditions: ReturnType<typeof eq>[] = [];
    if (req.query.busca) {
      const busca = `%${String(req.query.busca)}%`;
      conditions.push(sql`(${activityLogTable.detalhe} ILIKE ${busca} OR ${activityLogTable.user_email} ILIKE ${busca})`);
    }
    if (req.query.nivel) conditions.push(eq(activityLogTable.nivel, String(req.query.nivel)));
    if (req.query.tipo) conditions.push(eq(activityLogTable.tipo, String(req.query.tipo)));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const results = await db.select()
      .from(activityLogTable)
      .where(whereClause)
      .orderBy(desc(activityLogTable.created_at))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db.select({ count: sql<number>`count(*)` })
      .from(activityLogTable)
      .where(whereClause);

    const total = Number(countResult.count);
    res.json({ data: results, total, page, limit, totalPages: Math.ceil(total / limit) });
  } catch (err: any) {
    req.log.error({ err }, "Erro ao buscar activity log");
    res.status(500).json({ error: "Erro ao buscar log", code: err.code });
  }
});

// ── Art Templates CRUD ─────────────────────────────────────────────────────
const VALID_FONT_FAMILIES = new Set(AVAILABLE_FONTS.map(f => f.family));

function validateTemplateConfig(config: any): string | null {
  if (!config || typeof config !== 'object') return 'Config inválido';
  if (!config.canvas?.width || !config.canvas?.height) return 'Canvas inválido: width/height obrigatórios';
  if (!Array.isArray(config.layers)) return 'Layers deve ser um array';
  const ids = new Set<string>();
  for (const layer of config.layers) {
    if (!layer.id) return 'Layer sem campo id';
    if (ids.has(layer.id)) return `ID duplicado: ${layer.id}`;
    ids.add(layer.id);
    if (layer.font_family && !VALID_FONT_FAMILIES.has(layer.font_family)) {
      return `Fonte inválida: "${layer.font_family}"`;
    }
    const maxX = (layer.x || 0) + (layer.w || 0);
    const maxY = (layer.y || 0) + (layer.h || 0);
    if (maxX > config.canvas.width + 50) return `Layer "${layer.id}" ultrapassa largura do canvas`;
    if (layer.h && maxY > config.canvas.height + 50) return `Layer "${layer.id}" ultrapassa altura do canvas`;
  }
  return null;
}

const SAMPLE_DATA: Record<string, Record<string, string>> = {
  'cartao-boas-vindas': {
    nome_cliente:    'Cliente Teste',
    nome_assinatura: 'João Sardeto',
    unidade:         'SVN Maringá',
    contrato_social: 'svn-investimentos',
    contrato_label:  'SVN Investimentos',
    is_private_key:  'padrao',
  },
  'assinatura-email': {
    nome:        'Maria da Silva',
    cargo:       'Assessora de Investimentos',
    telefone:    '(44) 99999-9999',
    email:       'maria@svninvest.com.br',
    marca:       'svn-investimentos',
    marca_label: 'SVN Investimentos',
    tem_cfp:     'nao',
  },
};

// GET /art-templates — list all templates (no config for perf)
router.get("/art-templates", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const rows = await db.select({
      id:            artTemplatesTable.id,
      tipo:          artTemplatesTable.tipo,
      variant_value: artTemplatesTable.variant_value,
      name:          artTemplatesTable.name,
      is_active:     artTemplatesTable.is_active,
      created_at:    artTemplatesTable.created_at,
      updated_at:    artTemplatesTable.updated_at,
      updated_by:    artTemplatesTable.updated_by,
    }).from(artTemplatesTable)
      .orderBy(artTemplatesTable.tipo, artTemplatesTable.created_at);
    res.json(rows);
  } catch (err: any) {
    req.log.error({ err }, "Erro ao listar art-templates");
    res.status(500).json({ error: "Erro ao listar templates", code: err.code });
  }
});

// GET /art-templates/sample-data/:tipo — must come before /:id
router.get("/art-templates/sample-data/:tipo", requireRole("admin"), async (req, res): Promise<void> => {
  res.json(SAMPLE_DATA[String(req.params.tipo)] || {});
});

// POST /art-templates/preview — ad-hoc render, must come before /:id routes
router.post("/art-templates/preview", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const { config, data } = req.body as { config: any; data: Record<string, any> };
    if (!config) { res.status(400).json({ error: "Campo config obrigatório" }); return; }
    const pngBuffer = await renderFromTemplate(config, data || {});
    res.set('Content-Type', 'image/png').send(pngBuffer);
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao renderizar preview");
    res.status(500).json({ error: "Erro ao renderizar preview", code: err.code });
  }
});

// GET /art-templates/:id — full template with config
router.get("/art-templates/:id", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [row] = await db.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
    if (!row) { res.status(404).json({ error: "Template não encontrado" }); return; }
    res.json(row);
  } catch (err: any) {
    req.log.error({ err }, "Erro ao buscar art-template");
    res.status(500).json({ error: "Erro ao buscar template", code: err.code });
  }
});

// POST /art-templates — create new template
router.post("/art-templates", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const { tipo, name, config, variant_value } = req.body as { tipo: string; name: string; config: any; variant_value?: string };
    if (!tipo) { res.status(400).json({ error: "Campo tipo obrigatório" }); return; }
    if (!name) { res.status(400).json({ error: "Campo name obrigatório" }); return; }
    const effectiveConfig = config || { canvas: { width: 1080, height: 1080 }, bg: { type: 'static', url: '' }, layers: [] };
    const validationError = validateTemplateConfig(effectiveConfig);
    if (validationError) { res.status(400).json({ error: validationError }); return; }
    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));
    const [inserted] = await db.insert(artTemplatesTable)
      .values({ tipo, name, config: effectiveConfig, is_active: false, variant_value: variant_value || null, updated_at: new Date(), updated_by: userRow?.id ?? null })
      .returning();
    res.json(inserted);
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao criar art-template");
    res.status(500).json({ error: "Erro ao criar template", code: err.code });
  }
});

// PUT /art-templates/:id — update name and/or config
router.put("/art-templates/:id", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { name, config, variant_value } = req.body as { name?: string; config?: any; variant_value?: string };
    if (config) {
      const validationError = validateTemplateConfig(config);
      if (validationError) { res.status(400).json({ error: validationError }); return; }
    }
    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));
    const updateData: Record<string, any> = { updated_at: new Date(), updated_by: userRow?.id ?? null };
    if (name !== undefined) updateData.name = name;
    if (config !== undefined) updateData.config = config;
    if ('variant_value' in req.body) updateData.variant_value = variant_value || null;
    const [updated] = await db.update(artTemplatesTable).set(updateData).where(eq(artTemplatesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Template não encontrado" }); return; }
    res.json({ success: true, template: updated });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao atualizar art-template");
    res.status(500).json({ error: "Erro ao atualizar template", code: err.code });
  }
});

// PATCH /art-templates/:id/activate — mark as active, deactivate siblings
router.patch("/art-templates/:id/activate", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.transaction(async (tx) => {
      const [target] = await tx.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
      if (!target) throw Object.assign(new Error("Template não encontrado"), { status: 404 });
      const deactivateWhere = target.variant_value !== null && target.variant_value !== undefined
        ? and(eq(artTemplatesTable.tipo, target.tipo), eq(artTemplatesTable.variant_value, target.variant_value))
        : and(eq(artTemplatesTable.tipo, target.tipo), isNull(artTemplatesTable.variant_value));
      await tx.update(artTemplatesTable).set({ is_active: false }).where(deactivateWhere);
      await tx.update(artTemplatesTable).set({ is_active: true }).where(eq(artTemplatesTable.id, id));
    });
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao ativar art-template");
    res.status(err.status || 500).json({ error: "Erro ao ativar template", code: err.code });
  }
});

// DELETE /art-templates/:id — permite deletar inclusive o ativo (promove outro do mesmo
// grupo tipo+variante a ativo). Bloqueia apagar o ÚLTIMO template de um tipo que ainda
// tem solicitações, a menos que ?force=true seja enviado (confirmação explícita do admin).
router.delete("/art-templates/:id", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const force = req.query.force === "true" || req.query.force === "1";
    const [target] = await db.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
    if (!target) { res.status(404).json({ error: "Template não encontrado" }); return; }

    const siblings = await db.select({ id: artTemplatesTable.id }).from(artTemplatesTable).where(eq(artTemplatesTable.tipo, target.tipo));
    // Proteção: apagar o ÚLTIMO template de um tipo que ainda tem solicitações deixa essas
    // solicitações sem como gerar a arte. Exige confirmação explícita (force).
    if (siblings.length <= 1 && !force) {
      const [{ total }] = await db.select({ total: count() }).from(solicitacoesTable)
        .where(eq(solicitacoesTable.tipo_solicitacao, target.tipo));
      if (total > 0) {
        res.status(409).json({
          code: "last_template_with_solicitacoes",
          total,
          error: `Este é o único template do tipo "${target.tipo}" e há ${total} solicitação(ões) associada(s). Se deletar, elas ficam sem template até você criar outro.`,
        });
        return;
      }
    }

    await db.delete(artTemplatesTable).where(eq(artTemplatesTable.id, id));

    // Se o deletado era o ativo e ainda existem outros do mesmo grupo (tipo+variante),
    // promove o mais recente a ativo — assim o grupo não fica sem template ativo
    // (a geração ignora os inativos).
    if (target.is_active) {
      const sameGroupWhere = target.variant_value !== null && target.variant_value !== undefined
        ? and(eq(artTemplatesTable.tipo, target.tipo), eq(artTemplatesTable.variant_value, target.variant_value))
        : and(eq(artTemplatesTable.tipo, target.tipo), isNull(artTemplatesTable.variant_value));
      const [next] = await db.select({ id: artTemplatesTable.id }).from(artTemplatesTable)
        .where(sameGroupWhere).orderBy(desc(artTemplatesTable.id)).limit(1);
      if (next) {
        await db.update(artTemplatesTable).set({ is_active: true }).where(eq(artTemplatesTable.id, next.id));
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao deletar art-template");
    res.status(500).json({ error: "Erro ao deletar template", code: err.code });
  }
});

// ── Form schemas ─────────────────────────────────────────────────
router.get("/form-schemas", requireRole("admin"), (_req, res) => {
  res.json(getFormSchemaList());
});

router.get("/form-schemas/:tipo", requireRole("admin"), (req, res): void => {
  const schema = FORM_SCHEMAS[String(req.params.tipo)];
  if (!schema) { res.status(404).json({ error: "Schema não encontrado para este tipo" }); return; }
  res.json(schema);
});

// POST /solicitacoes/:id/regerar — re-execute art generation for a specific request
router.post("/solicitacoes/:id/regerar", requireRole("admin", "gestor"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }

    const [sol] = await db.select().from(solicitacoesTable).where(eq(solicitacoesTable.id, id));
    if (!sol) { res.status(404).json({ error: "Solicitação não encontrada" }); return; }

    const tipo = sol.tipo_solicitacao;
    const dados = (sol.dados ?? {}) as Record<string, unknown>;

    req.log.info({ solicitacaoId: id, tipo }, "Regenerando arte por solicitação do admin");

    try {
      await gerarArteParaSolicitacao(id, tipo, dados);
      res.json({ ok: true, message: "Arte regenerada com sucesso" });
    } catch (genErr: any) {
      req.log.error({ err: genErr, solicitacaoId: id, tipo }, "Falha ao regenerar arte");
      res.status(500).json({ error: "Falha ao gerar arte" });
    }
  } catch (err: any) {
    req.log.error({ err }, "Erro no endpoint de regeneração");
    res.status(500).json({ error: "Erro interno" });
  }
});

// POST /art-templates/:id/duplicate — clone a template
router.post("/art-templates/:id/duplicate", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { name, variant_value } = req.body as { name?: string; variant_value?: string };
    const [source] = await db.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
    if (!source) { res.status(404).json({ error: "Template não encontrado" }); return; }
    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));
    const [inserted] = await db.insert(artTemplatesTable)
      .values({
        tipo: source.tipo,
        variant_value: variant_value !== undefined ? (variant_value || null) : source.variant_value,
        name: name || `${source.name} (cópia)`,
        config: source.config,
        is_active: false,
        updated_at: new Date(),
        updated_by: userRow?.id ?? null,
      })
      .returning();
    res.json(inserted);
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao duplicar art-template");
    res.status(500).json({ error: "Erro ao duplicar template", code: err.code });
  }
});

router.get("/tipos-com-clickup", requireRole("admin"), (_req, res) => {
  res.json(TIPOS_COM_CLICKUP);
});

router.post("/users", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const { email, name, role, clickup_user_id } = req.body as {
      email: string; name: string; role: string; clickup_user_id?: string | null;
    };

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "email obrigatório" }); return;
    }
    const emailNormalized = email.trim().toLowerCase();
    if (!emailNormalized.endsWith("@svninvest.com.br")) {
      res.status(400).json({ error: "Apenas e-mails @svninvest.com.br são permitidos" }); return;
    }
    if (!name || !name.trim()) {
      res.status(400).json({ error: "name obrigatório" }); return;
    }
    if (!isRole(role)) {
      res.status(400).json({ error: "Role inválida" }); return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, emailNormalized));
    if (existing.length > 0) {
      res.status(409).json({ error: "Usuário com este e-mail já existe" }); return;
    }

    const [inserted] = await db.insert(usersTable).values({
      email: emailNormalized,
      name: name.trim(),
      role,
      clickup_user_id: clickup_user_id?.trim() || null,
    }).returning();

    logAtividadeBg({
      userEmail: req.session.user!.email, userName: req.session.user!.name,
      tipo: "usuario_criado", nivel: "warn",
      detalhe: `${req.session.user!.email} criou o usuário ${emailNormalized} com papel "${role}"`,
      metadata: { novoUsuario: emailNormalized, papel: role },
    });

    res.json({ success: true, user: inserted });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao criar usuário");
    res.status(500).json({ error: "Erro ao criar usuário", code: err.code });
  }
});

router.put("/users/:id/assignments", requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const userId = parseInt(String(req.params.id));
    if (isNaN(userId)) { res.status(400).json({ error: "ID inválido" }); return; }

    const { tipos } = req.body as { tipos: string[] };
    if (!Array.isArray(tipos)) {
      res.status(400).json({ error: "tipos deve ser um array" }); return;
    }

    const invalidos = tipos.filter(t => !TIPOS_COM_CLICKUP_SET.has(t));
    if (invalidos.length > 0) {
      res.status(400).json({ error: `Tipos inválidos: ${invalidos.join(", ")}` }); return;
    }

    const [targetUser] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, userId));
    if (!targetUser) {
      res.status(404).json({ error: "Usuário não encontrado" }); return;
    }

    await db.transaction(async (tx) => {
      await tx.delete(userTipoAssignmentsTable).where(eq(userTipoAssignmentsTable.user_id, userId));
      if (tipos.length > 0) {
        await tx.insert(userTipoAssignmentsTable).values(
          tipos.map(tipo => ({ user_id: userId, tipo }))
        );
      }
    });

    res.json({ success: true, tipos });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao atualizar assignments");
    res.status(500).json({ error: "Erro ao atualizar atribuições", code: err.code });
  }
});

// ── ClickUp list config ───────────────────────────────────────────────────────

// Lista as listas registradas (com os forms atribuídos) + os forms disponíveis
router.get("/clickup-lists", requireRole("admin"), async (_req, res) => {
  try {
    const lists = await db.select().from(clickupListsTable);
    const assignments = await db.select().from(tipoClickupListTable);
    const forms = TIPOS_COM_CLICKUP.map(t => ({ tipo: t.tipo, label: t.label }));
    const tiposByList: Record<string, string[]> = {};
    const assignedTipos: Record<string, string> = {};
    for (const a of assignments) {
      (tiposByList[a.list_id] ||= []).push(a.tipo);
      assignedTipos[a.tipo] = a.list_id;
    }
    res.json({
      lists: lists.map(l => ({ id: l.id, list_id: l.list_id, list_name: l.list_name, tipos: tiposByList[l.list_id] || [] })),
      forms,
      assignedTipos,
    });
  } catch (err) {
    logger.error({ err }, "clickup-lists GET falhou");
    res.status(500).json({ error: "Erro ao carregar listas." });
  }
});

// Testa um list_id no ClickUp (botão Validar)
router.post("/clickup-lists/validate", requireRole("admin"), async (req, res): Promise<void> => {
  const listId = String(req.body?.list_id ?? "").trim();
  if (!listId) { res.status(400).json({ ok: false, error: "Informe o ID da lista." }); return; }
  const result = await validateClickUpList(listId);
  res.json(result);
});

// Adiciona uma lista ao registro. Valida no ClickUp antes.
router.post("/clickup-lists", requireRole("admin"), async (req, res): Promise<void> => {
  const listId = String(req.body?.list_id ?? "").trim();
  if (!listId) { res.status(400).json({ error: "Informe o ID da lista." }); return; }
  const v = await validateClickUpList(listId);
  if (!v.ok) { res.status(400).json({ error: v.error || "Lista inválida no ClickUp." }); return; }
  try {
    const [row] = await db.insert(clickupListsTable)
      .values({ list_id: listId, list_name: v.name ?? null })
      .onConflictDoUpdate({ target: clickupListsTable.list_id, set: { list_name: v.name ?? null } })
      .returning();
    res.json({ ok: true, list: { id: row.id, list_id: row.list_id, list_name: row.list_name, tipos: [] } });
  } catch (err) {
    logger.error({ err }, "clickup-lists POST falhou");
    res.status(500).json({ error: "Erro ao adicionar lista." });
  }
});

// Define os forms atribuídos a uma lista. Move o form de qualquer outra lista.
router.put("/clickup-lists/:id/forms", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  const tipos: string[] = Array.isArray(req.body?.tipos) ? req.body.tipos.map((t: any) => String(t)) : [];
  try {
    const [list] = await db.select().from(clickupListsTable).where(eq(clickupListsTable.id, id));
    if (!list) { res.status(404).json({ error: "Lista não encontrada." }); return; }
    if (tipos.length) {
      await db.delete(tipoClickupListTable)
        .where(and(eq(tipoClickupListTable.list_id, list.list_id), notInArray(tipoClickupListTable.tipo, tipos)));
    } else {
      await db.delete(tipoClickupListTable).where(eq(tipoClickupListTable.list_id, list.list_id));
    }
    if (tipos.length > 0) {
      const now = new Date();
      await db.insert(tipoClickupListTable)
        .values(tipos.map(tipo => ({ tipo, list_id: list.list_id, list_name: list.list_name, updated_at: now })))
        .onConflictDoUpdate({
          target: tipoClickupListTable.tipo,
          set: { list_id: list.list_id, list_name: list.list_name, updated_at: now }
        });
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, id }, "clickup-lists PUT forms falhou");
    res.status(500).json({ error: "Erro ao salvar formulários." });
  }
});

// Exclui a lista do registro e suas atribuições
router.delete("/clickup-lists/:id", requireRole("admin"), async (req, res): Promise<void> => {
  const id = parseInt(String(req.params.id), 10);
  try {
    const [list] = await db.select().from(clickupListsTable).where(eq(clickupListsTable.id, id));
    if (!list) { res.status(404).json({ error: "Lista não encontrada." }); return; }
    await db.delete(tipoClickupListTable).where(eq(tipoClickupListTable.list_id, list.list_id));
    await db.delete(clickupListsTable).where(eq(clickupListsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err, id }, "clickup-lists DELETE falhou");
    res.status(500).json({ error: "Erro ao excluir lista." });
  }
});

export default router;
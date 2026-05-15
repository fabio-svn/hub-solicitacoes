import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, activityLogTable, artTemplatesTable, solicitacoesTable } from "@workspace/db";
import { eq, desc, sql, and, count } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "../services/template-renderer";
import { AVAILABLE_FONTS } from "../types/art-template";
import { FORM_SCHEMAS, getFormSchemaList } from "../config/form-schemas";

const router = Router();

router.get("/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const users = await db.select().from(usersTable);
    res.json(users);
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao listar usuários");
    res.status(500).json({ error: err.message || "Erro ao listar usuários", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

router.put("/users/:id/role", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const userId = parseInt(String(req.params.id));
    if (isNaN(userId)) {
      res.status(400).json({ error: "ID inválido" });
      return;
    }
    const { role } = req.body as { role: string };
    const currentUser = req.session.user!;

    if (!["colaborador", "gestor", "admin"].includes(role)) {
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

    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao alterar role");
    res.status(500).json({ error: err.message || "Erro ao alterar role", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

router.post("/impersonate", requireAuth, requireRole("admin", "gestor"), async (req, res): Promise<void> => {
  try {
    const { email } = req.body as { email: string };
    if (!email || !email.includes("@")) {
      res.status(400).json({ error: "E-mail inválido" });
      return;
    }
    req.session.adminOriginal = req.session.user;
    req.session.user = { email, name: email.split("@")[0], role: "user" };
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Erro ao salvar sessão de impersonar");
        res.status(500).json({ error: err.message || "Erro ao impersonar", code: (err as any).code });
        return;
      }
      res.json({ success: true, email });
    });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao impersonar");
    res.status(500).json({ error: err.message || "Erro ao impersonar", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

router.post("/impersonate/stop", requireAuth, async (req, res): Promise<void> => {
  try {
    if (req.session.adminOriginal) {
      req.session.user = req.session.adminOriginal;
      delete req.session.adminOriginal;
    }
    req.session.save((err) => {
      if (err) {
        req.log.error({ err }, "Erro ao salvar sessão ao sair impersonar");
        res.status(500).json({ error: err.message || "Erro ao sair", code: (err as any).code });
        return;
      }
      res.json({ success: true });
    });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao sair impersonar");
    res.status(500).json({ error: err.message || "Erro ao sair", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

router.put("/users/:id/clickup_user_id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
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
    res.status(500).json({ error: err.message || "Erro ao atualizar ClickUp User ID", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
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
    res.status(500).json({ error: err.message || "Erro ao buscar log", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
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
router.get("/art-templates", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const rows = await db.select({
      id:         artTemplatesTable.id,
      tipo:       artTemplatesTable.tipo,
      name:       artTemplatesTable.name,
      is_active:  artTemplatesTable.is_active,
      created_at: artTemplatesTable.created_at,
      updated_at: artTemplatesTable.updated_at,
      updated_by: artTemplatesTable.updated_by,
    }).from(artTemplatesTable)
      .orderBy(artTemplatesTable.tipo, artTemplatesTable.created_at);
    res.json(rows);
  } catch (err: any) {
    req.log.error({ err }, "Erro ao listar art-templates");
    res.status(500).json({ error: err.message || "Erro ao listar templates", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

// GET /art-templates/sample-data/:tipo — must come before /:id
router.get("/art-templates/sample-data/:tipo", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  res.json(SAMPLE_DATA[req.params.tipo] || {});
});

// POST /art-templates/preview — ad-hoc render, must come before /:id routes
router.post("/art-templates/preview", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const { config, data } = req.body as { config: any; data: Record<string, any> };
    if (!config) { res.status(400).json({ error: "Campo config obrigatório" }); return; }
    const pngBuffer = await renderFromTemplate(config, data || {});
    res.set('Content-Type', 'image/png').send(pngBuffer);
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao renderizar preview");
    res.status(500).json({ error: err.message || "Erro ao renderizar preview", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

// GET /art-templates/:id — full template with config
router.get("/art-templates/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [row] = await db.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
    if (!row) { res.status(404).json({ error: "Template não encontrado" }); return; }
    res.json(row);
  } catch (err: any) {
    req.log.error({ err }, "Erro ao buscar art-template");
    res.status(500).json({ error: err.message || "Erro ao buscar template", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

// POST /art-templates — create new template
router.post("/art-templates", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const { tipo, name, config } = req.body as { tipo: string; name: string; config: any };
    if (!tipo) { res.status(400).json({ error: "Campo tipo obrigatório" }); return; }
    if (!name) { res.status(400).json({ error: "Campo name obrigatório" }); return; }
    const effectiveConfig = config || { canvas: { width: 1080, height: 1080 }, bg: { type: 'static', url: '' }, layers: [] };
    const validationError = validateTemplateConfig(effectiveConfig);
    if (validationError) { res.status(400).json({ error: validationError }); return; }
    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));
    const [inserted] = await db.insert(artTemplatesTable)
      .values({ tipo, name, config: effectiveConfig, is_active: false, updated_at: new Date(), updated_by: userRow?.id ?? null })
      .returning();
    res.json(inserted);
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao criar art-template");
    res.status(500).json({ error: err.message || "Erro ao criar template", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

// PUT /art-templates/:id — update name and/or config
router.put("/art-templates/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { name, config } = req.body as { name?: string; config?: any };
    if (config) {
      const validationError = validateTemplateConfig(config);
      if (validationError) { res.status(400).json({ error: validationError }); return; }
    }
    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));
    const updateData: Record<string, any> = { updated_at: new Date(), updated_by: userRow?.id ?? null };
    if (name !== undefined) updateData.name = name;
    if (config !== undefined) updateData.config = config;
    const [updated] = await db.update(artTemplatesTable).set(updateData).where(eq(artTemplatesTable.id, id)).returning();
    if (!updated) { res.status(404).json({ error: "Template não encontrado" }); return; }
    res.json({ success: true, template: updated });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao atualizar art-template");
    res.status(500).json({ error: err.message || "Erro ao atualizar template", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

// PATCH /art-templates/:id/activate — mark as active, deactivate siblings
router.patch("/art-templates/:id/activate", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    await db.transaction(async (tx) => {
      const [target] = await tx.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
      if (!target) throw Object.assign(new Error("Template não encontrado"), { status: 404 });
      await tx.update(artTemplatesTable).set({ is_active: false }).where(eq(artTemplatesTable.tipo, target.tipo));
      await tx.update(artTemplatesTable).set({ is_active: true }).where(eq(artTemplatesTable.id, id));
    });
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao ativar art-template");
    res.status(err.status || 500).json({ error: err.message || "Erro ao ativar template", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

// DELETE /art-templates/:id — delete (blocked if active or last of tipo)
router.delete("/art-templates/:id", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const [target] = await db.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
    if (!target) { res.status(404).json({ error: "Template não encontrado" }); return; }
    if (target.is_active) {
      res.status(400).json({ error: "Não é possível deletar o template ativo. Ative outro primeiro." }); return;
    }
    const siblings = await db.select({ id: artTemplatesTable.id }).from(artTemplatesTable).where(eq(artTemplatesTable.tipo, target.tipo));
    if (siblings.length <= 1) {
      const [{ total }] = await db.select({ total: count() }).from(solicitacoesTable)
        .where(eq(solicitacoesTable.tipo_solicitacao, target.tipo));
      if (total > 0) {
        res.status(400).json({ error: `Este é o único template do tipo "${target.tipo}" e há ${total} solicitação(ões) associada(s). Crie outro template antes de deletar este.` }); return;
      }
    }
    await db.delete(artTemplatesTable).where(eq(artTemplatesTable.id, id));
    res.json({ success: true });
  } catch (err: any) {
    req.log.error({ err, body: req.body }, "Erro ao deletar art-template");
    res.status(500).json({ error: err.message || "Erro ao deletar template", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

// ── Form schemas ─────────────────────────────────────────────────
router.get("/form-schemas", requireAuth, requireRole("admin"), (_req, res) => {
  res.json(getFormSchemaList());
});

router.get("/form-schemas/:tipo", requireAuth, requireRole("admin"), (req, res): void => {
  const schema = FORM_SCHEMAS[req.params.tipo];
  if (!schema) { res.status(404).json({ error: "Schema não encontrado para este tipo" }); return; }
  res.json(schema);
});

// POST /art-templates/:id/duplicate — clone a template
router.post("/art-templates/:id/duplicate", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "ID inválido" }); return; }
    const { name } = req.body as { name?: string };
    const [source] = await db.select().from(artTemplatesTable).where(eq(artTemplatesTable.id, id));
    if (!source) { res.status(404).json({ error: "Template não encontrado" }); return; }
    const [userRow] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.email, user.email));
    const [inserted] = await db.insert(artTemplatesTable)
      .values({
        tipo: source.tipo,
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
    res.status(500).json({ error: err.message || "Erro ao duplicar template", code: err.code, details: err.stack?.split('\n').slice(0, 3).join('\n') });
  }
});

export default router;

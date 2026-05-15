import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable, activityLogTable, artTemplatesTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { logger } from "../lib/logger";
import { renderFromTemplate } from "../services/template-renderer";
import { AVAILABLE_FONTS } from "../types/art-template";

const router = Router();

router.get("/users", requireAuth, requireRole("admin"), async (req, res) => {
  try {
    const users = await db.select().from(usersTable);
    res.json(users);
  } catch (err) {
    logger.error({ err }, "Error listing users");
    res.status(500).json({ error: "Erro ao listar usuários" });
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
  } catch (err) {
    logger.error({ err }, "Error updating user role");
    res.status(500).json({ error: "Erro ao alterar role" });
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
        logger.error({ err }, "Erro ao salvar sessão de impersonar");
        res.status(500).json({ error: "Erro ao impersonar" });
        return;
      }
      res.json({ success: true, email });
    });
  } catch (err) {
    logger.error({ err }, "Erro ao impersonar");
    res.status(500).json({ error: "Erro ao impersonar" });
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
        logger.error({ err }, "Erro ao salvar sessão ao sair impersonar");
        res.status(500).json({ error: "Erro ao sair" });
        return;
      }
      res.json({ success: true });
    });
  } catch (err) {
    logger.error({ err }, "Erro ao sair impersonar");
    res.status(500).json({ error: "Erro ao sair" });
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
  } catch (err) {
    logger.error({ err }, "Error updating clickup_user_id");
    res.status(500).json({ error: "Erro ao atualizar ClickUp User ID" });
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
  } catch (err) {
    logger.error({ err }, "Erro ao buscar activity log");
    res.status(500).json({ error: "Erro ao buscar log" });
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

router.get("/art-templates", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const rows = await db.select({
      id:         artTemplatesTable.id,
      tipo:       artTemplatesTable.tipo,
      updated_at: artTemplatesTable.updated_at,
      updated_by: artTemplatesTable.updated_by,
    }).from(artTemplatesTable);
    res.json(rows);
  } catch (err) {
    logger.error({ err }, "Erro ao listar art-templates");
    res.status(500).json({ error: "Erro ao listar templates" });
  }
});

router.get("/art-templates/:tipo", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const [row] = await db.select().from(artTemplatesTable)
      .where(eq(artTemplatesTable.tipo, req.params.tipo));
    if (!row) { res.status(404).json({ error: "Template não encontrado" }); return; }
    res.json(row);
  } catch (err) {
    logger.error({ err }, "Erro ao buscar art-template");
    res.status(500).json({ error: "Erro ao buscar template" });
  }
});

router.put("/art-templates/:tipo", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const user = req.session.user!;
    const { config } = req.body as { config: any };
    if (!config) { res.status(400).json({ error: "Campo config obrigatório" }); return; }
    const validationError = validateTemplateConfig(config);
    if (validationError) { res.status(400).json({ error: validationError }); return; }
    const [userRow] = await db.select({ id: usersTable.id })
      .from(usersTable).where(eq(usersTable.email, user.email));
    await db.insert(artTemplatesTable)
      .values({ tipo: req.params.tipo, config, updated_at: new Date(), updated_by: userRow?.id })
      .onConflictDoUpdate({
        target: artTemplatesTable.tipo,
        set: { config, updated_at: new Date(), updated_by: userRow?.id ?? null },
      });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Erro ao salvar art-template");
    res.status(500).json({ error: "Erro ao salvar template" });
  }
});

router.post("/art-templates/:tipo/preview", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const { config, data } = req.body as { config: any; data: Record<string, any> };
    if (!config) { res.status(400).json({ error: "Campo config obrigatório" }); return; }
    const pngBuffer = await renderFromTemplate(config, data || {});
    res.set('Content-Type', 'image/png').send(pngBuffer);
  } catch (err: any) {
    logger.error({ err }, "Erro ao renderizar preview");
    res.status(500).json({ error: err?.message || "Erro ao renderizar preview" });
  }
});

router.get("/art-templates/:tipo/sample-data", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  const defaults: Record<string, Record<string, string>> = {
    'cartao-boas-vindas': {
      nome_cliente:    'Cliente Teste',
      nome_assinatura: 'João Sardeto',
      unidade:         'SVN Maringá',
      contrato_social: 'svn-investimentos',
      contrato_label:  'SVN Investimentos',
      is_private_key:  'padrao',
    },
    'assinatura-email': {
      nome:       'Maria da Silva',
      cargo:      'Assessora de Investimentos',
      telefone:   '(44) 99999-9999',
      email:      'maria@svninvest.com.br',
      marca:      'svn-investimentos',
      marca_label:'SVN Investimentos',
      tem_cfp:    'nao',
    },
  };
  res.json(defaults[req.params.tipo] || {});
});

export default router;

import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../middleware/auth.middleware";
import { logger } from "../lib/logger";

const router = Router();

router.get("/users", requireAuth, requireRole("admin", "gestor"), async (req, res) => {
  try {
    const users = await db.select().from(usersTable);
    res.json(users);
  } catch (err) {
    logger.error({ err }, "Error listing users");
    res.status(500).json({ error: "Erro ao listar usuarios" });
  }
});

router.put("/users/:id/role", requireAuth, requireRole("admin"), async (req, res): Promise<void> => {
  try {
    const userId = parseInt(String(req.params.id));
    const { role } = req.body as { role: string };
    const currentUser = req.session.user!;

    if (!["colaborador", "gestor", "admin"].includes(role)) {
      res.status(400).json({ error: "Role invalida" });
      return;
    }

    const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!targetUser) {
      res.status(404).json({ error: "Usuario nao encontrado" });
      return;
    }

    if (targetUser.email === currentUser.email) {
      res.status(400).json({ error: "Nao e possivel alterar sua propria role" });
      return;
    }

    await db.update(usersTable).set({ role }).where(eq(usersTable.id, userId));

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, "Error updating user role");
    res.status(500).json({ error: "Erro ao alterar role" });
  }
});

export default router;

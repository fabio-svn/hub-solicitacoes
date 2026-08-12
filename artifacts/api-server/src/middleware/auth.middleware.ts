import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

interface SessionUser {
  email: string;
  name: string;
  role: string;
  /** ISO string da última vez que last_login foi gravado nesta sessão (throttle). */
  last_login?: string | null;
}

export interface UserProfile {
  telefone: string | null;
  ddd: string | null;
  unidade: string | null;
  escritorio: string | null;
  cargo: string | null;
  cd_ancord: string | null;
  encontrado: boolean;
  atualizado_em: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    adminOriginal?: SessionUser;
    authNonce?: string;
    authRedirect?: string;
    graphToken?: string;
    userProfile?: UserProfile;
  }
}

// AUTH-MW-LIMPO: getSessionUser e isImpersonating viviam aqui sem nenhum
// chamador. Quem precisa do usuario le req.session.user direto; quem precisa
// saber de impersonacao olha req.session.adminOriginal.
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.user) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }
  // ULTIMO-ACESSO-THROTTLE: grava last_login no banco no máximo uma vez por
  // hora por sessão, em background (fire-and-forget). "Último acesso" passa a
  // refletir atividade real, não apenas a data do último login via OAuth.
  // O valor é mantido na sessão para controle do intervalo sem consulta extra.
  const now = new Date();
  const ul = req.session.user.last_login;
  const diffMs = ul ? now.getTime() - new Date(ul).getTime() : Infinity;
  if (diffMs >= 60 * 60 * 1000) {
    req.session.user.last_login = now.toISOString();
    const email = req.session.user.email;
    db.update(usersTable)
      .set({ last_login: now })
      .where(eq(usersTable.email, email))
      .catch((err: unknown) => {
        console.error("[requireAuth] Falha ao atualizar last_login:", err);
      });
  }
  next();
}

// requireRole reutiliza requireAuth para a verificação de autenticação (DRY).
// Ao usar requireRole em uma rota, não é necessário adicionar requireAuth antes.
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, () => {
      const user = req.session.user!;
      if (!roles.includes(user.role)) {
        res.status(403).json({ error: "Acesso negado" });
        return;
      }
      next();
    });
  };
}

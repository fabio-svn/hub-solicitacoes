import type { Request, Response, NextFunction } from "express";

interface SessionUser {
  email: string;
  name: string;
  role: string;
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

export function getSessionUser(req: Request): SessionUser | undefined {
  return req.session?.user;
}

export function isImpersonating(req: Request): boolean {
  return !!req.session?.adminOriginal;
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.user) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
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

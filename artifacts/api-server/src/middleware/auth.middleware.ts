import type { Request, Response, NextFunction } from "express";

interface SessionUser {
  email: string;
  name: string;
  role: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
    adminOriginal?: SessionUser;
    authNonce?: string;
    authRedirect?: string;
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

// requireRole já inclui verificação de autenticação internamente.
// Ao usar requireRole em uma rota, não é necessário adicionar requireAuth
// antes — mas fazê-lo é inofensivo e aumenta a clareza da intenção.
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = req.session?.user;
    if (!user) {
      res.status(401).json({ error: "Autenticação necessária" });
      return;
    }
    if (!roles.includes(user.role)) {
      res.status(403).json({ error: "Acesso negado" });
      return;
    }
    next();
  };
}

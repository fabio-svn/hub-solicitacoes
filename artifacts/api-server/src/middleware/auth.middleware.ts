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

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.user) {
    res.status(401).json({ error: "Autenticação necessária" });
    return;
  }
  next();
}

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

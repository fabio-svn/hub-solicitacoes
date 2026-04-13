import type { Request, Response, NextFunction } from "express";

interface SessionUser {
  email: string;
  name: string;
  role: string;
}

declare module "express-session" {
  interface SessionData {
    user?: SessionUser;
  }
}

export function getSessionUser(req: Request): SessionUser | undefined {
  return req.session?.user;
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.user) {
    return res.status(401).json({ error: "Autenticacao necessaria" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.session?.user;
    if (!user) {
      return res.status(401).json({ error: "Autenticacao necessaria" });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}

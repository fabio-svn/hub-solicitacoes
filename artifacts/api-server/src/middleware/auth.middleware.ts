import type { Request, Response, NextFunction } from "express";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!(req.session as any)?.user) {
    return res.status(401).json({ error: "Autenticacao necessaria" });
  }
  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req.session as any)?.user;
    if (!user) {
      return res.status(401).json({ error: "Autenticacao necessaria" });
    }
    if (!roles.includes(user.role)) {
      return res.status(403).json({ error: "Acesso negado" });
    }
    next();
  };
}

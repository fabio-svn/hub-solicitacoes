declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        role: 'admin' | 'gestor' | 'colaborador';
      };
      solicitacao?: any;
    }
  }
}
export {};

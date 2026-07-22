// Fonte unica das roles que o sistema reconhece. Antes esta lista vivia
// duplicada — e uma copia desatualizada em admin.ts barrava promocoes para
// corporate e capital_humano com "Role invalida".
//
// Isto responde "quais roles EXISTEM", nao "quem pode fazer o que": as regras
// de acesso (requireRole em cada rota) sao decisoes independentes e continuam
// escritas na propria rota, de proposito.
export const ROLES_VALIDAS = [
  "colaborador",
  "gestor",
  "capital_humano",
  "corporate",
  "admin",
] as const;

// Tipo derivado da lista: usar isto no lugar de `string` faz o compilador
// recusar uma role inexistente (um "corporativo" digitado errado vira erro de
// build, nao um 403 em producao).
export type Role = (typeof ROLES_VALIDAS)[number];

export function isRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES_VALIDAS as readonly string[]).includes(v);
}

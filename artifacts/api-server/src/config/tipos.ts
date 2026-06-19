// Fonte única dos tipos de solicitação automatizados (entregam material sem passar
// pela fila do time). Backend importa daqui; o frontend recebe a lista via
// GET /api/config (campo `tiposAutomacao`), eliminando as cópias hardcoded.
export const TIPOS_AUTOMACAO = [
  "assinatura-email",
  "cartao-visita-digital",
  "cartao-boas-vindas",
  "divulgacao-nps",
  "convite-fp",
  "cartao-comemorativo",
] as const;

// Versão Set para checagens O(1) (onde antes se usava new Set([...]).has()).
export const TIPOS_AUTOMACAO_SET: ReadonlySet<string> = new Set(TIPOS_AUTOMACAO);

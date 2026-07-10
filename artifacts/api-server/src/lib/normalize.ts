// Normalizacao de dados de formulario -> forma canonica snake_case.
// Funcao PURA (sem banco/perfil): renomeia chaves camelCase->snake_case,
// converte is_private_key (sim/nao) e os campos palSvn (selos). Testavel isolada.
export function normalizeFormDados(
  _tipo: string,
  dados: Record<string, unknown>
): Record<string, unknown> {
  const out = { ...dados };

  const KEY_MAP: Record<string, string> = {
    isPrivate:     "is_private_key",
    modeloCartao:  "modelo_cartao",
    modeloArte:    "modelo_arte",
    contratoSocial:"contrato_social",
    nomeCliente:   "nome_cliente",
    nomeAssinatura: "nome_assinatura",
    nomeCompleto:      "nome_completo",
    codigoAssessor:    "codigo_assessor",
    fotoPerfilDigital: "foto_perfil",
  };
  for (const [camel, snake] of Object.entries(KEY_MAP)) {
    if (camel in out) {
      if (!(snake in out)) out[snake] = out[camel];
      delete out[camel];
    }
  }

  if (out.is_private_key === "sim")       out.is_private_key = "private";
  else if (out.is_private_key === "nao")  out.is_private_key = "padrao";

  for (let i = 1; i <= 4; i++) {
    const k = "palSvn" + i;
    const v = out[k];
    if (typeof v === "string") {
      const lower = v.toLowerCase();
      if (lower === "sim")              out[k] = "Sim";
      else if (lower === "nao" || lower === "não") out[k] = "Não";
    }
  }

  return out;
}

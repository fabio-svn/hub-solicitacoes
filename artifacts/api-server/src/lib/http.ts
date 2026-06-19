// Timeout padrão das chamadas HTTP externas. Sobrescrevível por env sem mexer no código.
const DEFAULT_TIMEOUT_MS = Number(process.env.HTTP_TIMEOUT_MS) || 12000;

/**
 * fetch com timeout via AbortController.
 *
 * Impede que um upstream lento ou travado (ClickUp, n8n/Brevo, Microsoft Graph)
 * pendure o request indefinidamente — inclusive o submit da solicitação, que
 * espera o ClickUp. Em timeout, aborta a conexão e lança um Error com
 * name = "TimeoutError", para o try/catch já existente do chamador tratar.
 *
 * Uso: troca direta por fetch() — a mesma assinatura, com 3º arg opcional de ms.
 */
export async function fetchWithTimeout(
  url: string | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      const e = new Error(`Timeout de ${timeoutMs}ms ao chamar ${String(url)}`);
      e.name = "TimeoutError";
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

import { pool } from "@workspace/db";
import { logger } from "./logger";

/**
 * Propagacao de mudancas de identidade para as sessoes ja abertas.
 *
 * A sessao guarda um retrato do usuario feito no login (/auth/callback) e o
 * cookie e rolling de 30 dias, renovado a cada request: quem usa o Hub toda
 * semana nunca ganha sessao nova. Sem propagar, uma mudanca de papel so
 * aparecia quando o /auth/me reconciliava — ou seja, no proximo carregamento
 * de pagina. Entre uma navegacao e outra, as chamadas de API seguiam com o
 * papel antigo. Tolerar isso ao promover alguem e inofensivo; ao rebaixar,
 * nao e.
 *
 * O store e o connect-pg-simple: uma linha por sessao, com o payload em `sess`
 * (coluna json). Mexer nele por SQL e deliberado — nao existe API do
 * express-session para alcancar a sessao de outra pessoa.
 */

// Fixado no app.ts, em `new PgStore({ tableName: "session" })`.
const TABELA_SESSAO = "session";

/**
 * Reescreve a role dentro das sessoes vivas do usuario. Vale na requisicao
 * seguinte dele, inclusive para o requireRole do servidor, e sem interromper
 * nada: a sessao continua a mesma, so o papel muda.
 *
 * Devolve quantas sessoes foram tocadas (uma pessoa pode ter varias — celular,
 * desktop, outro navegador). Zero e resultado normal: significa que ela nao
 * tem sessao aberta, e o proximo login ja traz o papel certo.
 */
export async function atualizarRoleNasSessoes(email: string, role: string): Promise<number> {
  const alvo = String(email || "").toLowerCase();
  if (!alvo) return 0;

  const { rowCount } = await pool.query(
    `UPDATE ${TABELA_SESSAO}
        SET sess = jsonb_set(sess::jsonb, '{user,role}', to_jsonb($2::text))::json
      WHERE lower(sess -> 'user' ->> 'email') = $1
        AND COALESCE(sess -> 'user' ->> 'role', '') <> $2`,
    [alvo, role],
  );

  const n = rowCount ?? 0;
  if (n > 0) logger.info({ email: alvo, role, sessoes: n }, "Role propagada para sessoes abertas");
  return n;
}

/**
 * Apaga as sessoes do usuario. Isto NAO e a mesma coisa que a funcao acima:
 * aqui a pessoa cai no login na proxima requisicao, com perda do que estivesse
 * preenchendo. Reserve para revogacao de verdade — desligamento, incidente,
 * acesso indevido — onde a interrupcao e o objetivo. Para mudanca de papel,
 * use atualizarRoleNasSessoes.
 *
 * Cobre tambem as sessoes em que este e-mail e o admin por tras de uma
 * impersonacao: revogar o acesso de alguem tem que derrubar as duas pontas.
 *
 * Sem chamador ainda — existe para quando houver desativacao de usuario.
 */
export async function encerrarSessoes(email: string): Promise<number> {
  const alvo = String(email || "").toLowerCase();
  if (!alvo) return 0;

  const { rowCount } = await pool.query(
    `DELETE FROM ${TABELA_SESSAO}
      WHERE lower(sess -> 'user' ->> 'email') = $1
         OR lower(sess -> 'adminOriginal' ->> 'email') = $1`,
    [alvo],
  );

  const n = rowCount ?? 0;
  logger.warn({ email: alvo, sessoes: n }, "Sessoes encerradas");
  return n;
}

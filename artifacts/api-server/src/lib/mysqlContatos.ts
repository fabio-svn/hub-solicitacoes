import mysql from "mysql2/promise";
import { logger } from "./logger";

export interface PerfilContato {
  email: string;
  telefone: string | null;
  ddd: string | null;
  unidade: string | null;
  escritorio: string | null;
  cargo: string | null;
  cd_ancord: string | null;
  encontrado: boolean;
}

let pool: mysql.Pool | null = null;

function getPool(): mysql.Pool | null {
  const url = process.env.MYSQL_CONTATOS;
  if (!url) return null;
  if (!pool) {
    try {
      pool = mysql.createPool({
        uri: url,
        connectionLimit: 5,
        waitForConnections: true,
        connectTimeout: 5000,
      });
    } catch (err) {
      logger.error({ err }, "[mysqlContatos] Falha ao criar pool");
      return null;
    }
  }
  return pool;
}

function juntarTelefone(ddd: unknown, telefone: unknown): string | null {
  const d = ddd == null ? "" : String(ddd).trim();
  let t = telefone == null ? "" : String(telefone).trim();
  if (!d && !t) return null;
  if (t.length === 9) t = `${t.slice(0, 5)}-${t.slice(5)}`;
  else if (t.length === 8) t = `${t.slice(0, 4)}-${t.slice(4)}`;
  if (!d) return t;
  if (!t) return d;
  return `(${d}) ${t}`;
}

export async function buscarContato(email: string): Promise<PerfilContato> {
  const vazio: PerfilContato = {
    email, telefone: null, ddd: null, unidade: null,
    escritorio: null, cargo: null, cd_ancord: null, encontrado: false,
  };

  const p = getPool();
  if (!p) {
    logger.warn("[mysqlContatos] MYSQL_CONTATOS não configurado");
    return vazio;
  }

  try {
    const [rows] = await p.query(
      "SELECT DDD, Telefone, DS_unidade, Escritorio, DS_cargo, CD_ancord FROM contatos WHERE LOWER(Email_interno) = LOWER(?) LIMIT 1",
      [email]
    );
    const arr = rows as Array<Record<string, unknown>>;
    if (!arr || arr.length === 0) return vazio;
    const r = arr[0];
    const toStr = (v: unknown) => (v == null ? null : String(v).trim() || null);
    return {
      email,
      ddd: toStr(r.DDD),
      telefone: juntarTelefone(r.DDD, r.Telefone),
      unidade: toStr(r.DS_unidade),
      escritorio: toStr(r.Escritorio),
      cargo: toStr(r.DS_cargo),
      cd_ancord: toStr(r.CD_ancord),
      encontrado: true,
    };
  } catch (err) {
    logger.error({ err, email }, "[mysqlContatos] Erro ao buscar contato");
    return vazio;
  }
}

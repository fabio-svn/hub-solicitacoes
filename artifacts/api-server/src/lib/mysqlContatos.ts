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

function juntarTelefone(ddd: string | null, telefone: string | null): string | null {
  const d = (ddd || "").trim();
  const t = (telefone || "").trim();
  if (!d && !t) return null;
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
      "SELECT DDD, Telefone, DS_unidade, Escritorio, Cargo, CD_ancord FROM contatos WHERE LOWER(Email_interno) = LOWER(?) LIMIT 1",
      [email]
    );
    const arr = rows as Array<{
      DDD: string | null; Telefone: string | null;
      DS_unidade: string | null; Escritorio: string | null;
      Cargo: string | null; CD_ancord: string | null;
    }>;
    if (!arr || arr.length === 0) return vazio;
    const r = arr[0];
    return {
      email,
      ddd: r.DDD || null,
      telefone: juntarTelefone(r.DDD, r.Telefone),
      unidade: r.DS_unidade || null,
      escritorio: r.Escritorio || null,
      cargo: r.Cargo || null,
      cd_ancord: r.CD_ancord || null,
      encontrado: true,
    };
  } catch (err) {
    logger.error({ err, email }, "[mysqlContatos] Erro ao buscar contato");
    return vazio;
  }
}

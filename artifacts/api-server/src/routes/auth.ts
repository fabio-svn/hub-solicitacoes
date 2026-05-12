import { Router } from "express";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { randomBytes } from "crypto";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";
import { buscarContato } from "../lib/mysqlContatos";

const router = Router();

const msalConfig = {
  auth: {
    clientId: process.env.MSAL_CLIENT_ID || "",
    authority: `https://login.microsoftonline.com/${process.env.MSAL_TENANT_ID || "common"}`,
    clientSecret: process.env.MSAL_CLIENT_SECRET || "",
  },
};

let cca: ConfidentialClientApplication | null = null;

function getMsalClient() {
  if (!cca) {
    cca = new ConfidentialClientApplication(msalConfig);
  }
  return cca;
}

const REDIRECT_URI = process.env.MSAL_REDIRECT_URI || "/auth/callback";

if (process.env.NODE_ENV === "production" && (!process.env.MSAL_REDIRECT_URI || !process.env.MSAL_REDIRECT_URI.startsWith("https://"))) {
  throw new Error("MSAL_REDIRECT_URI must be set to an absolute HTTPS URL in production (e.g. https://yourdomain.com/auth/callback)");
}
const SCOPES = ["user.read", "openid", "profile", "email"];

function isSafeRedirect(url: string): boolean {
  if (!url) return false;
  if (url.startsWith("/") && !url.startsWith("//")) return true;
  return false;
}

function sanitizeRedirect(url: string): string {
  if (isSafeRedirect(url)) return url;
  return "/solicitacoes.html";
}

router.get("/login", async (req, res) => {
  try {
    const redirectTo = sanitizeRedirect(String(req.query.redirect || "/solicitacoes.html"));
    const nonce = randomBytes(16).toString("hex");

    req.session.authNonce = nonce;
    req.session.authRedirect = redirectTo;

    const client = getMsalClient();
    const authUrl = await client.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      state: nonce,
      prompt: "select_account",
    });
    req.session.save((saveErr) => {
      if (saveErr) {
        logger.error({ saveErr }, "Session save error before MSAL redirect");
        res.redirect("/?error=login_failed");
        return;
      }
      res.redirect(authUrl);
    });
  } catch (err) {
    logger.error({ err }, "MSAL login error");
    res.redirect("/?error=login_failed");
  }
});

router.get("/callback", async (req, res) => {
  try {
    const code = String(req.query.code || "");
    const stateNonce = String(req.query.state || "");

    if (!code) {
      res.redirect("/?error=no_code");
      return;
    }

    const expectedNonce = req.session.authNonce;
    const redirectTo = req.session.authRedirect || "/solicitacoes.html";

    delete req.session.authNonce;
    delete req.session.authRedirect;

    if (!expectedNonce || stateNonce !== expectedNonce) {
      logger.warn("OAuth state mismatch - possible CSRF");
      res.redirect("/?error=invalid_state");
      return;
    }

    const client = getMsalClient();
    const tokenResponse = await client.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    });

    const account = tokenResponse.account;
    if (!account) {
      res.redirect("/?error=no_account");
      return;
    }

    const email = (account.username || "").toLowerCase();
    if (!email.endsWith("@svninvest.com.br")) {
      res.redirect("/?error=domain_not_allowed");
      return;
    }

    const name = account.name || email.split("@")[0];

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    let role = "colaborador";

    if (existing.length === 0) {
      await db.insert(usersTable).values({ email, name, role: "colaborador" });
    } else {
      role = existing[0].role || "colaborador";
      if (existing[0].name !== name) {
        await db.update(usersTable).set({ name }).where(eq(usersTable.email, email));
      }
    }

    req.session.user = { email, name, role };
    req.session.graphToken = tokenResponse.accessToken;

    try {
      const perfil = await buscarContato(email);
      req.session.userProfile = {
        telefone: perfil.telefone,
        ddd: perfil.ddd,
        unidade: perfil.unidade,
        escritorio: perfil.escritorio,
        cargo: perfil.cargo,
        cd_ancord: perfil.cd_ancord,
        encontrado: perfil.encontrado,
        atualizado_em: new Date().toISOString(),
      };
    } catch (err) {
      logger.error({ err, email }, "Erro ao buscar perfil MySQL no login");
    }

    res.redirect(sanitizeRedirect(redirectTo));
  } catch (err) {
    logger.error({ err }, "MSAL callback error");
    res.redirect("/?error=auth_failed");
  }
});

router.get("/me-graph", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  const token = req.session?.graphToken;
  if (!token) {
    res.status(400).json({ error: "Token do Microsoft Graph não disponível. Faça logout e login novamente." });
    return;
  }
  try {
    const fields = [
      "id", "displayName", "givenName", "surname",
      "userPrincipalName", "mail",
      "mobilePhone", "businessPhones",
      "officeLocation", "jobTitle", "department",
      "companyName", "employeeId",
      "city", "state", "country",
      "streetAddress", "postalCode",
      "onPremisesSamAccountName", "onPremisesUserPrincipalName",
      "onPremisesExtensionAttributes",
    ].join(",");

    const graphRes = await fetch(
      `https://graph.microsoft.com/v1.0/me?$select=${fields}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await graphRes.json() as Record<string, unknown>;

    if (!graphRes.ok) {
      res.status(graphRes.status).json({ error: "Erro ao chamar Graph API", detail: data });
      return;
    }

    res.json({ sessionUser: user, graphProfile: data });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar perfil Graph");
    res.status(500).json({ error: "Erro interno ao buscar perfil" });
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.redirect("/");
  });
});

router.get("/me", (req, res): void => {
  const user = req.session?.user;
  if (!user) {
    res.json({ authenticated: false });
    return;
  }
  res.json({
    authenticated: true,
    user,
    adminOriginal: req.session.adminOriginal || null,
    impersonating: !!req.session.adminOriginal,
    profile: req.session.userProfile || null,
  });
});

router.get("/me-profile", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  if (req.session.userProfile) {
    res.json({ profile: req.session.userProfile, fonte: "sessao" });
    return;
  }
  try {
    const perfil = await buscarContato(user.email);
    req.session.userProfile = {
      telefone: perfil.telefone,
      ddd: perfil.ddd,
      unidade: perfil.unidade,
      escritorio: perfil.escritorio,
      cargo: perfil.cargo,
      cd_ancord: perfil.cd_ancord,
      encontrado: perfil.encontrado,
      atualizado_em: new Date().toISOString(),
    };
    res.json({ profile: req.session.userProfile, fonte: "mysql" });
  } catch (err) {
    logger.error({ err }, "Erro ao buscar perfil MySQL");
    res.status(500).json({ error: "Erro ao buscar perfil" });
  }
});

router.post("/me-profile/refresh", async (req, res): Promise<void> => {
  const user = req.session?.user;
  if (!user) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }
  try {
    const perfil = await buscarContato(user.email);
    req.session.userProfile = {
      telefone: perfil.telefone,
      ddd: perfil.ddd,
      unidade: perfil.unidade,
      escritorio: perfil.escritorio,
      cargo: perfil.cargo,
      cd_ancord: perfil.cd_ancord,
      encontrado: perfil.encontrado,
      atualizado_em: new Date().toISOString(),
    };
    res.json({ profile: req.session.userProfile, fonte: "mysql" });
  } catch (err) {
    logger.error({ err }, "Erro ao recarregar perfil MySQL");
    res.status(500).json({ error: "Erro ao recarregar perfil" });
  }
});

export default router;

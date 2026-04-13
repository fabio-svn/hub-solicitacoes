import { Router } from "express";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger";

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
    const redirectTo = sanitizeRedirect((req.query.redirect as string) || "/solicitacoes.html");
    const client = getMsalClient();
    const authUrl = await client.getAuthCodeUrl({
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
      state: redirectTo,
      prompt: "select_account",
    });
    res.redirect(authUrl);
  } catch (err) {
    logger.error({ err }, "MSAL login error");
    res.redirect("/?error=login_failed");
  }
});

router.get("/callback", async (req, res) => {
  try {
    const code = req.query.code as string;
    const state = sanitizeRedirect((req.query.state as string) || "/solicitacoes.html");

    if (!code) {
      return res.redirect("/?error=no_code");
    }

    const client = getMsalClient();
    const tokenResponse = await client.acquireTokenByCode({
      code,
      scopes: SCOPES,
      redirectUri: REDIRECT_URI,
    });

    const account = tokenResponse.account;
    if (!account) {
      return res.redirect("/?error=no_account");
    }

    const email = (account.username || "").toLowerCase();
    if (!email.endsWith("@svninvest.com.br")) {
      return res.redirect("/?error=domain_not_allowed");
    }

    const name = account.name || email.split("@")[0];

    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    if (existing.length === 0) {
      await db.insert(usersTable).values({ email, name, role: "colaborador" });
    } else if (existing[0].name !== name) {
      await db.update(usersTable).set({ name }).where(eq(usersTable.email, email));
    }

    const userRow = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);

    req.session.user = {
      email,
      name,
      role: userRow[0]?.role || "colaborador",
    };

    res.redirect(state);
  } catch (err) {
    logger.error({ err }, "MSAL callback error");
    res.redirect("/?error=auth_failed");
  }
});

router.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

router.get("/me", (req, res) => {
  const user = req.session?.user;
  if (!user) {
    return res.json({ authenticated: false });
  }
  res.json({ authenticated: true, user });
});

export default router;

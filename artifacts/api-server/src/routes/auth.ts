import { Router } from "express";
import { ConfidentialClientApplication } from "@azure/msal-node";
import { randomBytes } from "crypto";
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
    res.redirect(authUrl);
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

    res.redirect(sanitizeRedirect(redirectTo));
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

router.get("/me", (req, res): void => {
  const user = req.session?.user;
  if (!user) {
    res.json({ authenticated: false });
    return;
  }
  res.json({ authenticated: true, user });
});

export default router;

import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { APIError, createAuthMiddleware, isAPIError } from "better-auth/api";
import { LoginThrottle } from "@/server/auth/login-throttle";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/mail/outbox";

/** Verrou par compte : 5 échecs / 15 min → 15 min de blocage, indépendamment de l'IP. */
const loginThrottle = new LoginThrottle();
const SIGN_IN_PATH = "/sign-in/email";

/**
 * Proxys de confiance (CIDR, séparés par des virgules) : quand l'application est derrière un ou
 * plusieurs proxys qui AJOUTENT l'IP cliente à X-Forwarded-For, better-auth retient la première IP
 * non fiable en partant de la droite. En production, la garde docker/xff-guard.cjs garantit que
 * l'en-tête ne vient que de ces pairs (sinon il est remplacé par l'adresse réelle du pair).
 */
const trustedProxies = (process.env.TRUSTED_PROXIES ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export const auth = betterAuth({
  appName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "HELIOSTORES",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    sendResetPassword: async ({ user, url }) => {
      await enqueueEmail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe",
        template: "password-reset",
        payload: { name: user.name, url },
      });
    },
  },
  user: {
    additionalFields: {
      role: { type: ["CUSTOMER", "MANAGER", "ADMIN"], required: false, defaultValue: "CUSTOMER", input: false },
      phone: { type: "string", required: false },
      marketingOptIn: { type: "boolean", required: false, defaultValue: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 14,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: false },
  },
  // Limite par IP (règles intégrées : 3 connexions / 10 s par IP et par chemin) + verrou par compte ci-dessous.
  rateLimit: { enabled: true, window: 60, max: 30 },
  advanced: trustedProxies.length ? { ipAddress: { trustedProxies } } : undefined,
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const key = LoginThrottle.keyOf((ctx.body as { email?: unknown } | undefined)?.email);
      if (key && loginThrottle.lockedFor(key) > 0) {
        throw new APIError("TOO_MANY_REQUESTS", { message: "Trop de tentatives de connexion pour ce compte. Réessayez plus tard.", code: "ACCOUNT_LOCKED" });
      }
    }),
    after: createAuthMiddleware(async (ctx) => {
      if (ctx.path !== SIGN_IN_PATH) return;
      const key = LoginThrottle.keyOf((ctx.body as { email?: unknown } | undefined)?.email);
      if (!key) return;
      const returned = ctx.context.returned;
      if (isAPIError(returned)) {
        if (returned.statusCode === 401) loginThrottle.fail(key);
      } else loginThrottle.success(key);
    }),
  },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3400", process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400"],
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

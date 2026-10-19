import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { prisma } from "@/lib/prisma";
import { enqueueEmail } from "@/server/mail/outbox";

export const auth = betterAuth({
  appName: process.env.NEXT_PUBLIC_BRAND_NAME ?? "ELIOS SOLAR",
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
  rateLimit: { enabled: true, window: 60, max: 30 },
  trustedOrigins: [process.env.BETTER_AUTH_URL ?? "http://127.0.0.1:3400", process.env.NEXT_PUBLIC_SITE_URL ?? "http://127.0.0.1:3400"],
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;

/**
 * Amorçage de l'administrateur : crée (ou promeut) un compte ADMIN sans jamais écrire de
 * mot de passe dans le dépôt ni dans les journaux.
 *
 *   ADMIN_EMAIL=vous@exemple.fr ADMIN_PASSWORD="$(cat /chemin/secret)" pnpm admin:bootstrap
 *   # ou, interactif :  pnpm admin:bootstrap  (saisie masquée)
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { Writable } from "node:stream";

async function askHidden(question: string): Promise<string> {
  const muted = new Writable({ write(_c, _e, cb) { cb(); } });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: true });
  process.stdout.write(question);
  return new Promise((resolve) => rl.question("", (a) => { rl.close(); process.stdout.write("\n"); resolve(a); }));
}
async function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (a) => { rl.close(); resolve(a); }));
}

async function main() {
  const { auth } = await import("../src/lib/auth");
  const { prisma } = await import("../src/lib/prisma");
  const email = (process.env.ADMIN_EMAIL ?? (await ask("E-mail de l'administrateur : "))).trim().toLowerCase();
  const name = process.env.ADMIN_NAME ?? "Administrateur";
  if (!email.includes("@")) throw new Error("e-mail invalide");
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
    console.log(`Compte existant promu ADMIN : ${email}`);
  } else {
    const password = process.env.ADMIN_PASSWORD ?? (await askHidden("Mot de passe (saisie masquée, 12 caractères minimum) : "));
    if (password.length < 12) throw new Error("mot de passe trop court (12 caractères minimum)");
    const res = await auth.api.signUpEmail({ body: { email, password, name } });
    await prisma.user.update({ where: { id: res.user.id }, data: { role: "ADMIN", emailVerified: true } });
    console.log(`Administrateur créé : ${email}`);
  }
  await prisma.auditLog.create({ data: { action: "admin.bootstrap", entity: "user", entityId: email, actorEmail: "cli" } });
  await prisma.$disconnect();
}
main().catch((e) => { console.error(String(e)); process.exit(1); });

import "dotenv/config";
import { purgeConversations } from "../src/server/chat/service";
import { prisma } from "../src/lib/prisma";

/**
 * Purge des conversations (données personnelles) :
 *   pnpm exec tsx scripts/purge-conversations.ts [--days=180] [--inactive-days=365] [--dry-run]
 * - conversations FERMÉES depuis plus de N jours : supprimées (messages en cascade) ;
 * - conversations sans message depuis plus de M jours (par défaut 365) : supprimées aussi.
 * À planifier quotidiennement (cron). Valeurs par défaut : CHAT_RETENTION_DAYS / CHAT_INACTIVE_DAYS.
 */
function arg(name: string): string | undefined {
  const a = process.argv.find((x) => x.startsWith(`--${name}=`));
  return a?.slice(name.length + 3);
}

async function main() {
  const days = Number(arg("days") ?? process.env.CHAT_RETENTION_DAYS ?? 180);
  const inactiveDays = Number(arg("inactive-days") ?? process.env.CHAT_INACTIVE_DAYS ?? 365);
  if (!Number.isFinite(days) || days < 1 || !Number.isFinite(inactiveDays) || inactiveDays < 1) throw new Error("--days et --inactive-days doivent être des entiers ≥ 1");
  const dryRun = process.argv.includes("--dry-run");
  const n = await purgeConversations({ days, inactiveDays, dryRun });
  console.log(`[purge-conversations] ${dryRun ? "à supprimer (simulation)" : "supprimées"} : ${n} (fermées > ${days} j, inactives > ${inactiveDays} j)`);
  if (!dryRun && n) await prisma.auditLog.create({ data: { action: "conversation.purge", entity: "Conversation", after: { count: n, days, inactiveDays } } });
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });

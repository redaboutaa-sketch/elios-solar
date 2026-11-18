import { prisma } from "@/lib/prisma";

export async function audit(entry: { actorUserId?: string | null; actorEmail?: string | null; action: string; entity: string; entityId?: string | null; before?: unknown; after?: unknown }) {
  await prisma.auditLog.create({
    data: {
      actorUserId: entry.actorUserId ?? null,
      actorEmail: entry.actorEmail ?? null,
      action: entry.action,
      entity: entry.entity,
      entityId: entry.entityId ?? null,
      before: (entry.before ?? undefined) as never,
      after: (entry.after ?? undefined) as never,
    },
  });
}

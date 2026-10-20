import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildInfo } from "@/lib/build-info";

export const dynamic = "force-dynamic";

export async function GET() {
  const build = buildInfo();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const [migration] = await prisma.$queryRaw<Array<{ migration_name: string }>>`SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL ORDER BY finished_at DESC LIMIT 1`;
    return NextResponse.json({ status: "ok", db: "ok", commit: build.commit, builtAt: build.builtAt, lastMigration: migration?.migration_name ?? null, time: new Date().toISOString() });
  } catch {
    return NextResponse.json({ status: "degraded", db: "error", commit: build.commit }, { status: 503 });
  }
}

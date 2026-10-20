import { NextResponse } from "next/server";
import { getConfigurationWithRevalidation } from "@/server/configuration/service";
import { buildConfigurationPdf } from "@/server/pdf/configuration-pdf";
import { prisma } from "@/lib/prisma";

export async function GET(_req: Request, ctx: RouteContext<"/projets/[token]/pdf">) {
  const { token } = await ctx.params;
  const data = await getConfigurationWithRevalidation({ shareToken: token });
  if (!data) return NextResponse.json({ error: "introuvable" }, { status: 404 });
  const seller = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const bytes = await buildConfigurationPdf({ title: data.configuration.title ?? data.result.lines[0]?.label ?? "Configuration", result: data.result, reference: `CFG-${data.configuration.id.slice(-8).toUpperCase()} v${data.configuration.version}`, kind: "configuration", seller });
  return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="configuration-${data.configuration.id.slice(-8)}.pdf"`, "cache-control": "no-store" } });
}

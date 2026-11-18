import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { getOrderForOwner } from "@/server/order/service";
import { AccountNav } from "@/components/account/account-nav";
import { OrderDetail } from "@/components/account/order-detail";
import { PlanPreview } from "@/components/configurator/plan-preview";
import type { EvaluationResult, PergolaStandardInput } from "@/domain/types";
export const metadata: Metadata = { title: "Détail de commande", robots: { index: false } };
export default async function Page(props: PageProps<"/compte/commandes/[id]">) {
  const session = await requireUser();
  const { id } = await props.params;
  const order = await getOrderForOwner(id, { userId: session.user.id });
  if (!order) notFound();
  const snapshots = order.lines.map((l) => l.configurationSnapshot as { input: PergolaStandardInput; result: EvaluationResult } | null).filter((s): s is { input: PergolaStandardInput; result: EvaluationResult } => !!s && !!s.result?.layout);
  return (
    <div className="container-x py-8"><h1 className="font-display text-4xl">Commande {order.number}</h1><div className="mt-4"><AccountNav current="/compte/commandes" /></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-2"><OrderDetail order={order} />{snapshots.map((s, i) => <div key={i} className="card p-3"><p className="px-2 pt-1 text-sm font-medium">Configuration commandée (figée)</p><PlanPreview layout={s.result.layout!} segments={s.input.kind === "pergola_standard" ? s.input.segments : {}} /></div>)}</div>
    </div>
  );
}

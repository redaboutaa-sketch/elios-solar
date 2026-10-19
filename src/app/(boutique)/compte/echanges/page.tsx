import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/session";
import { AccountNav } from "@/components/account/account-nav";
import { listConversationsFor, type ChatMessageMeta } from "@/server/chat/service";

export const metadata: Metadata = { title: "Mes échanges", robots: { index: false } };
const STATUS: Record<string, string> = { OPEN: "En cours", WAITING_CUSTOMER: "Réponse reçue", CLOSED: "Terminée" };
const AUTHOR: Record<string, string> = { CUSTOMER: "Vous", ADVISOR: "Conseiller", ASSISTANT: "Assistant automatique", SYSTEM: "" };

export default async function Page() {
  const session = await requireUser("/compte/echanges");
  const list = await listConversationsFor({ userId: session.user.id });
  return (
    <div className="container-x max-w-3xl py-8">
      <h1 className="font-display text-4xl">Mes échanges</h1>
      <div className="mt-4"><AccountNav current="/compte/echanges" /></div>
      <p className="mt-6 text-sm text-stone-700">Vos conversations avec nos conseillers. Pour écrire, utilisez le bouton de chat en bas de l'écran. Vous pouvez exporter ou supprimer ces données depuis <Link href="/compte/donnees" className="underline">Mes données</Link>.</p>
      {list.length === 0 ? <div className="mt-6 card p-8 text-center"><p>Aucun échange pour le moment.</p></div> : (
        <ul className="mt-6 space-y-4">
          {list.map((c) => (
            <li key={c.id} className="card p-4">
              <details>
                <summary className="cursor-pointer">
                  <span className="font-medium">{c.subject || "Conversation"}</span>
                  <span className="ml-2 text-xs text-stone-700">{STATUS[c.status]} · {c.lastMessageAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</span>
                </summary>
                <ol className="mt-3 space-y-2 text-sm">
                  {c.messages.filter((m) => !(m.author !== "CUSTOMER" && (m.meta as ChatMessageMeta | null)?.internal)).map((m) => (
                    <li key={m.id} className={m.author === "SYSTEM" ? "text-center text-xs text-stone-700" : "rounded-lg bg-sand-100 p-2"}>
                      {m.author !== "SYSTEM" && <p className="text-xs text-stone-700">{AUTHOR[m.author]} · {m.createdAt.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" })}</p>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      {m.author === "ASSISTANT" && <p className="mt-1 text-xs italic text-stone-700">Réponse indicative, à confirmer par un conseiller.</p>}
                    </li>
                  ))}
                </ol>
              </details>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

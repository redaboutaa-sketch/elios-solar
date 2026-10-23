"use client";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageCircle, Paperclip, Send, X } from "lucide-react";
import { attachProjectAction, closeChatAction, handoverAction, loadChatAction, sendChatMessageAction } from "@/server/actions/chat";
import type { ChatMessageDto, ChatPollResponse, ChatState } from "./types";

const POLL_MS = 6000;
const MAX_LEN = 2000;

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function mergeMessages(current: ChatMessageDto[], incoming: ChatMessageDto[]): ChatMessageDto[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  return added.length ? [...current, ...added] : current;
}

export function ChatWidget({ enabled, initialOnline }: { enabled: boolean; initialOnline: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<ChatState | null>(null);
  const [online, setOnline] = useState(initialOnline);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [attach, setAttach] = useState<string>("");
  const [busy, start] = useTransition();
  const pathname = usePathname();
  const titleId = useId();
  const descId = useId();
  const closeRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  const shareToken = pathname?.match(/^\/projets\/([A-Za-z0-9_-]{8,})/)?.[1] ?? null;
  const conversation = state?.conversation ?? null;
  const messages = useMemo(() => state?.messages ?? [], [state]);
  const lastAtRef = useRef<string | null>(null);
  const conversationId = conversation?.id ?? null;
  const handedOver = messages.some((m) => m.meta?.kind === "handover");
  const lastAssistant = messages.length > 0 && messages[messages.length - 1]!.author === "ASSISTANT";

  const load = useCallback(() => {
    start(async () => {
      const r = await loadChatAction();
      if (!r.ok) { setError(r.error); return; }
      setState(r.data);
      setOnline(r.data.online);
      if (r.data.email) setEmail((v) => v || r.data.email!);
      if (r.data.name) setName((v) => v || r.data.name!);
      setError(null);
    });
  }, []);

  useEffect(() => { if (open && !state) load(); }, [open, state, load]);
  useEffect(() => { if (open) closeRef.current?.focus(); else openerRef.current?.focus({ preventScroll: true }); }, [open]);
  useEffect(() => { lastAtRef.current = messages[messages.length - 1]?.createdAt ?? null; }, [messages]);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, open]);

  // Rafraîchissement par polling toutes les 6 s tant que le panneau est ouvert.
  useEffect(() => {
    if (!open || !conversationId) return;
    let cancelled = false;
    const tick = async () => {
      const last = lastAtRef.current;
      const qs = new URLSearchParams({ conversationId, read: "1", ...(last ? { after: last } : {}) });
      try {
        const res = await fetch(`/api/chat/messages?${qs}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as ChatPollResponse;
        if (cancelled) return;
        setOnline(data.online);
        setState((s) => s && s.conversation ? { ...s, online: data.online, messages: mergeMessages(s.messages, data.messages), conversation: { ...s.conversation, status: data.status, assigned: data.assigned } } : s);
      } catch { /* réseau indisponible : nouvel essai au prochain cycle */ }
    };
    const id = setInterval(tick, POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [open, conversationId]);

  if (!enabled) return null;

  const needsConsent = !conversation;
  const needsEmail = !conversation && !online;

  const send = () => {
    const body = draft.trim();
    if (!body) return;
    if (needsConsent && !consent) { setError("Merci d'accepter la politique de confidentialité avant d'envoyer."); return; }
    if (needsEmail && !email.trim()) { setError("Indiquez votre adresse e-mail pour recevoir la réponse."); return; }
    setError(null);
    start(async () => {
      const r = await sendChatMessageAction({
        conversationId: conversation?.id ?? null,
        body,
        email: email.trim() || null,
        name: name.trim() || null,
        consent: needsConsent ? consent : undefined,
        configurationId: attach && attach !== "token" ? attach : null,
        shareToken: attach === "token" ? shareToken : null,
      });
      if (!r.ok) { setError(r.error); return; }
      setDraft("");
      setAttach("");
      setOnline(r.data.online);
      setState((s) => s ? { ...s, online: r.data.online, conversation: r.data.conversation, messages: r.data.messages } : s);
    });
  };

  const attachNow = () => {
    if (!conversation || !attach) return;
    start(async () => {
      const r = await attachProjectAction({ conversationId: conversation.id, configurationId: attach !== "token" ? attach : null, shareToken: attach === "token" ? shareToken : null });
      if (!r.ok) { setError(r.error); return; }
      setAttach("");
      setState((s) => s ? { ...s, messages: r.data.messages, conversation: s.conversation ? { ...s.conversation, configurationId: s.conversation.configurationId ?? "linked" } : s.conversation } : s);
    });
  };

  const handover = () => {
    if (!conversation) return;
    start(async () => {
      const r = await handoverAction({ conversationId: conversation.id });
      if (!r.ok) { setError(r.error); return; }
      setState((s) => s ? { ...s, messages: r.data.messages } : s);
    });
  };

  const closeConversation = () => {
    if (!conversation) return;
    start(async () => {
      const r = await closeChatAction({ conversationId: conversation.id });
      if (!r.ok) { setError(r.error); return; }
      setState((s) => s ? { ...s, conversation: null, messages: [] } : s);
      setConsent(false);
    });
  };

  const attachOptions: Array<{ value: string; label: string }> = [
    ...(shareToken ? [{ value: "token", label: "Le projet affiché sur cette page" }] : []),
    ...(state?.projects ?? []).map((p) => ({ value: p.id, label: p.title })),
  ];

  return (
    <>
      <button
        ref={openerRef}
        data-chat-launcher
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={open ? `${titleId}-panel` : undefined}
        aria-label={open ? "Fermer le chat" : "Ouvrir le chat avec un conseiller"}
        className="fixed right-4 bottom-[5.5rem] z-40 inline-flex h-14 w-14 items-center justify-center rounded-full bg-anthracite text-sand-50 shadow-soft hover:bg-ink lg:right-6 lg:bottom-6"
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <MessageCircle className="size-6" aria-hidden="true" />}
        <span className={`absolute top-1 right-1 h-3 w-3 rounded-full border-2 border-anthracite ${online ? "bg-success" : "bg-stone-700"}`} aria-hidden="true" />
      </button>

      {open && (
        <section
          id={`${titleId}-panel`}
          role="dialog"
          aria-modal="false"
          aria-labelledby={titleId}
          aria-describedby={descId}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          className="fixed inset-x-2 bottom-[9.5rem] z-40 flex max-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-xl border border-sand-200 bg-white shadow-soft lg:inset-x-auto lg:right-6 lg:bottom-24 lg:w-96 lg:max-h-[70vh]"
          data-testid="chat-panel"
        >
          <header className="flex items-start justify-between gap-2 border-b border-sand-200 bg-sand-50 px-4 py-3">
            <div>
              <h2 id={titleId} className="font-display text-lg leading-tight">Discuter avec un conseiller</h2>
              <p id={descId} className="mt-0.5 flex items-center gap-1.5 text-xs text-stone-700">
                <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-success" : "bg-stone-700"}`} aria-hidden="true" />
                {online ? "Un conseiller est disponible" : "Nos conseillers ne sont pas connectés : laissez un message, réponse par e-mail"}
              </p>
            </div>
            <button ref={closeRef} type="button" onClick={() => setOpen(false)} className="btn-ghost min-h-0 px-2 py-2" aria-label="Fermer le chat"><X className="size-5" aria-hidden="true" /></button>
          </header>

          <div ref={listRef} className="min-h-40 flex-1 space-y-2 overflow-y-auto px-4 py-3 text-sm" aria-live="polite" aria-relevant="additions" aria-label="Messages">
            {!state && <p className="text-stone-700">Chargement…</p>}
            {state && !online && !conversation && <p className="rounded-lg bg-sand-100 p-3 text-stone-800">{state.offlineMessage}</p>}
            {state && messages.length === 0 && online && <p className="text-stone-700">Posez votre question : dimensions, finitions, options, livraison… Nous vous répondons dans ce fil.</p>}
            {messages.map((m) => <Message key={m.id} m={m} />)}
            {conversation?.status === "CLOSED" && <p className="text-center text-xs text-stone-700">Conversation terminée. Envoyez un message pour en ouvrir une nouvelle.</p>}
          </div>

          {state?.assistant && conversation && lastAssistant && !handedOver && (
            <div className="border-t border-sand-200 px-4 py-2">
              <button type="button" onClick={handover} disabled={busy} className="btn-secondary min-h-0 w-full py-2 text-xs">Parler à un conseiller</button>
            </div>
          )}

          <form className="space-y-2 border-t border-sand-200 px-4 py-3" onSubmit={(e) => { e.preventDefault(); send(); }}>
            {!conversation && (
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="label text-xs" htmlFor={`${titleId}-name`}>Prénom (facultatif)</label>
                  <input id={`${titleId}-name`} className="input min-h-10 py-1.5 text-sm" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" maxLength={80} />
                </div>
                <div>
                  <label className="label text-xs" htmlFor={`${titleId}-email`}>E-mail {needsEmail ? "(obligatoire)" : "(facultatif)"}</label>
                  <input id={`${titleId}-email`} type="email" className="input min-h-10 py-1.5 text-sm" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required={needsEmail} maxLength={200} />
                </div>
              </div>
            )}
            {needsConsent && (
              <label className="flex items-start gap-2 text-xs text-stone-800">
                <input type="checkbox" className="mt-0.5 h-4 w-4" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-required="true" />
                <span>J'accepte que mes messages soient conservés pour traiter ma demande (<Link href="/confidentialite" className="underline" target="_blank">politique de confidentialité</Link>).</span>
              </label>
            )}
            <div>
              <label className="sr-only" htmlFor={`${titleId}-msg`}>Votre message</label>
              <textarea id={`${titleId}-msg`} className="input min-h-10 resize-none py-2 text-sm" rows={2} maxLength={MAX_LEN} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Votre message…" onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} />
            </div>
            {attachOptions.length > 0 && (
              <div className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`${titleId}-attach`}>Joindre ma configuration</label>
                <select id={`${titleId}-attach`} className="input min-h-10 flex-1 py-1.5 text-xs" value={attach} onChange={(e) => setAttach(e.target.value)}>
                  <option value="">Joindre ma configuration…</option>
                  {attachOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {conversation && attach && <button type="button" onClick={attachNow} disabled={busy} className="btn-secondary min-h-0 px-3 py-2 text-xs" aria-label="Joindre maintenant"><Paperclip className="size-4" aria-hidden="true" /></button>}
              </div>
            )}
            {error && <p role="alert" className="text-xs text-danger">{error}</p>}
            <div className="flex items-center justify-between gap-2">
              {conversation && conversation.status !== "CLOSED" ? <button type="button" onClick={closeConversation} disabled={busy} className="text-xs text-stone-700 underline">Terminer la conversation</button> : <span />}
              <button type="submit" disabled={busy || !draft.trim()} className="btn-primary min-h-0 px-4 py-2 text-sm"><Send className="size-4" aria-hidden="true" /> Envoyer</button>
            </div>
          </form>
        </section>
      )}
    </>
  );
}

function Message({ m }: { m: ChatMessageDto }) {
  if (m.author === "SYSTEM") {
    return (
      <p className="text-center text-xs text-stone-700">
        {m.body}
        {m.meta?.shareToken && <> — <Link href={`/projets/${m.meta.shareToken}`} className="underline">voir le projet</Link></>}
      </p>
    );
  }
  const mine = m.author === "CUSTOMER";
  const label = mine ? "Vous" : m.author === "ASSISTANT" ? "Assistant automatique" : "Conseiller";
  return (
    <div className={`flex ${mine ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[85%] rounded-xl px-3 py-2 ${mine ? "bg-anthracite text-sand-50" : m.author === "ASSISTANT" ? "border border-sand-300 bg-sand-50 text-ink" : "bg-sand-100 text-ink"}`}>
        <p className={`text-[11px] ${mine ? "text-sand-200" : "text-stone-700"}`}>{label} · {fmtTime(m.createdAt)}</p>
        <p className="whitespace-pre-wrap break-words">{m.body}</p>
        {m.author === "ASSISTANT" && <p className="mt-1 text-[11px] italic text-stone-700">Assistant automatique — réponse indicative, à confirmer par un conseiller</p>}
      </div>
    </div>
  );
}

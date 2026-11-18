"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Notice } from "@/components/ui/alert";
import { afterSignInAction } from "@/server/actions/account";

function safeNext(n: string | null): string {
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/compte";
}

export function SignInForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form className="card p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => {
      const r = await authClient.signIn.email({ email: String(fd.get("email")), password: String(fd.get("password")) });
      if (r.error) { setError(authErrorFr(r.error, "Identifiants incorrects.")); return; }
      await afterSignInAction();
      router.push(safeNext(sp.get("next"))); router.refresh();
    }); }}>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
      <div><label className="label" htmlFor="password">Mot de passe</label><input id="password" name="password" type="password" autoComplete="current-password" required className="input" /></div>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn-primary w-full" type="submit" disabled={busy}>Se connecter</button>
      <p className="text-sm text-center"><Link href="/compte/mot-de-passe-oublie" className="underline">Mot de passe oublié ?</Link> · <Link href={`/compte/inscription${sp.get("next") ? `?next=${encodeURIComponent(sp.get("next")!)}` : ""}`} className="underline">Créer un compte</Link></p>
    </form>
  );
}

export function SignUpForm() {
  const router = useRouter();
  const sp = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <form className="card p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => {
      const password = String(fd.get("password"));
      if (password.length < 10) { setError("Le mot de passe doit contenir au moins 10 caractères."); return; }
      const r = await authClient.signUp.email({ name: String(fd.get("name")), email: String(fd.get("email")), password });
      if (r.error) { setError(authErrorFr(r.error, "Inscription impossible.")); return; }
      await afterSignInAction();
      router.push(safeNext(sp.get("next"))); router.refresh();
    }); }}>
      <div><label className="label" htmlFor="name">Nom complet</label><input id="name" name="name" autoComplete="name" required className="input" /></div>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" autoComplete="email" required className="input" /></div>
      <div><label className="label" htmlFor="password">Mot de passe (10 caractères minimum)</label><input id="password" name="password" type="password" autoComplete="new-password" minLength={10} required className="input" /></div>
      <p className="text-xs text-stone-700">En créant un compte, vous acceptez la <Link href="/confidentialite" className="underline">politique de confidentialité</Link>. Aucune communication marketing sans votre accord explicite.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn-primary w-full" type="submit" disabled={busy}>Créer mon compte</button>
    </form>
  );
}

export function ForgotForm({ mailReal = true, contactEmail = null }: { mailReal?: boolean; contactEmail?: string | null }) {
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();
  if (done) return mailReal
    ? <Notice tone="success">Si un compte existe pour cette adresse, un e-mail de réinitialisation a été envoyé.</Notice>
    : <Notice tone="warn">Demande enregistrée, mais aucun e-mail n'est envoyé pour le moment.{contactEmail ? <> Écrivez-nous à <a className="underline" href={`mailto:${contactEmail}`}>{contactEmail}</a> pour retrouver l'accès à votre compte.</> : null}</Notice>;
  return (
    <form className="card p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { await authClient.requestPasswordReset({ email: String(fd.get("email")), redirectTo: "/compte/reinitialisation" }); setDone(true); }); }}>
      <div><label className="label" htmlFor="email">E-mail</label><input id="email" name="email" type="email" required className="input" /></div>
      <button className="btn-primary w-full" type="submit" disabled={busy}>Envoyer le lien</button>
    </form>
  );
}

export function ResetForm() {
  const sp = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const token = sp.get("token");
  if (!token) return <Notice tone="error">Lien invalide ou expiré.</Notice>;
  return (
    <form className="card p-6 space-y-4" onSubmit={(e) => { e.preventDefault(); const fd = new FormData(e.currentTarget); start(async () => { const r = await authClient.resetPassword({ newPassword: String(fd.get("password")), token }); if (r.error) setError(r.error.message ?? "Échec."); else router.push("/compte/connexion?reset=1"); }); }}>
      <div><label className="label" htmlFor="password">Nouveau mot de passe</label><input id="password" name="password" type="password" minLength={10} required className="input" autoComplete="new-password" /></div>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn-primary w-full" type="submit" disabled={busy}>Enregistrer</button>
    </form>
  );
}

/** Changement du mot de passe une fois connecté (better-auth `changePassword`) ; les autres sessions sont fermées. */
export function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, start] = useTransition();
  if (done) return <Notice tone="success">Mot de passe modifié. Vos autres sessions ont été déconnectées.</Notice>;
  return (
    <form className="card p-6 space-y-4" aria-label="Changer mon mot de passe" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const fd = new FormData(form);
      const next = String(fd.get("newPassword"));
      if (next !== String(fd.get("confirmPassword"))) { setError("Les deux saisies du nouveau mot de passe diffèrent."); return; }
      start(async () => {
        const r = await authClient.changePassword({ currentPassword: String(fd.get("currentPassword")), newPassword: next, revokeOtherSessions: true });
        if (r.error) setError(r.error.code === "INVALID_PASSWORD" ? "Mot de passe actuel incorrect." : authErrorFr(r.error, "Modification impossible."));
        else { form.reset(); setError(null); setDone(true); }
      });
    }}>
      <div><label className="label" htmlFor="currentPassword">Mot de passe actuel</label><input id="currentPassword" name="currentPassword" type="password" required className="input" autoComplete="current-password" /></div>
      <div><label className="label" htmlFor="newPassword">Nouveau mot de passe (12 caractères minimum)</label><input id="newPassword" name="newPassword" type="password" minLength={12} required className="input" autoComplete="new-password" /></div>
      <div><label className="label" htmlFor="confirmPassword">Confirmer le nouveau mot de passe</label><input id="confirmPassword" name="confirmPassword" type="password" minLength={12} required className="input" autoComplete="new-password" /></div>
      {error && <Notice tone="error">{error}</Notice>}
      <button className="btn-primary" type="submit" disabled={busy}>Changer le mot de passe</button>
    </form>
  );
}

export function SignOutButton() {
  const router = useRouter();
  return <button type="button" className="btn-secondary" onClick={async () => { await authClient.signOut(); router.push("/"); router.refresh(); }}>Se déconnecter</button>;
}

/** Messages d'erreur d'authentification en français (le fournisseur renvoie des libellés anglais). */
function authErrorFr(err: { status?: number; code?: string; message?: string }, fallback: string): string {
  if (err.status === 429) return "Trop de tentatives : réessayez dans quelques minutes.";
  if (err.code === "INVALID_EMAIL_OR_PASSWORD") return "E-mail ou mot de passe incorrect.";
  if (err.code === "USER_ALREADY_EXISTS") return "Un compte existe déjà avec cet e-mail.";
  return err.message && /[àâçéèêëîïôûùüÿœ]/i.test(err.message) ? err.message : fallback;
}

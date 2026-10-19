import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { missingSettings } from "@/server/admin/launch";
import { Notice } from "@/components/ui/alert";
import { Flash, PageTitle, Section } from "@/components/admin/ui";
import { updateSettingsAction } from "@/server/actions/admin/settings";

export const metadata: Metadata = { title: "Réglages" };

function Field({ name, label, value, type = "text", hint, missing }: { name: string; label: string; value: string | null | undefined; type?: string; hint?: string; missing?: boolean }) {
  return (
    <div>
      <label className="label" htmlFor={name}>{label}{missing && <span className="ml-1 text-xs text-danger">(manquant)</span>}</label>
      <input id={name} name={name} type={type} className={`input ${missing ? "border-danger/50" : ""}`} defaultValue={value ?? ""} aria-describedby={hint ? `${name}-hint` : undefined} />
      {hint && <p id={`${name}-hint`} className="mt-1 text-xs text-stone-700">{hint}</p>}
    </div>
  );
}

export default async function SettingsPage(props: PageProps<"/admin/reglages">) {
  await requireRole(["ADMIN", "MANAGER"]);
  const s = await prisma.siteSettings.findUnique({ where: { id: 1 } });
  const missing = missingSettings(s);
  const isMissing = (k: string) => missing.some((m) => m.key === k);
  return (
    <div className="space-y-6">
      <PageTitle title="Réglages du site" />
      <Flash searchParams={props.searchParams} />
      {missing.length > 0 ? <Notice tone="warn">Champs obligatoires avant lancement encore vides : {missing.map((m) => m.label).join(", ")}.</Notice> : <Notice tone="success">Tous les champs obligatoires sont renseignés.</Notice>}
      <form action={updateSettingsAction} className="space-y-6">
        <Section title="Marque">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="brandName" label="Nom de marque" value={s?.brandName ?? "ELIOS SOLAR"} />
            <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="brandNameProvisional" className="h-4 w-4" defaultChecked={s?.brandNameProvisional ?? true} /> Nom provisoire (à confirmer)</label>
          </div>
        </Section>
        <Section title="Identité légale">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="legalName" label="Raison sociale" value={s?.legalName} missing={isMissing("legalName")} />
            <Field name="legalForm" label="Forme juridique" value={s?.legalForm} hint="ex. SAS, SARL" />
            <Field name="siret" label="SIRET" value={s?.siret} missing={isMissing("siret")} hint="14 chiffres" />
            <Field name="vatNumber" label="N° TVA intracommunautaire" value={s?.vatNumber} missing={isMissing("vatNumber")} />
            <Field name="shareCapital" label="Capital social" value={s?.shareCapital} />
            <Field name="rcsCity" label="Ville du RCS" value={s?.rcsCity} />
          </div>
        </Section>
        <Section title="Coordonnées">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="addressLine1" label="Adresse" value={s?.addressLine1} missing={isMissing("addressLine1")} />
            <Field name="addressLine2" label="Complément d'adresse" value={s?.addressLine2} />
            <Field name="postalCode" label="Code postal" value={s?.postalCode} missing={isMissing("postalCode")} />
            <Field name="city" label="Ville" value={s?.city} missing={isMissing("city")} />
            <Field name="countryCode" label="Pays (code ISO)" value={s?.countryCode ?? "FR"} />
            <Field name="phone" label="Téléphone" value={s?.phone} type="tel" missing={isMissing("phone")} />
            <Field name="contactEmail" label="E-mail de contact" value={s?.contactEmail} type="email" missing={isMissing("contactEmail")} />
            <Field name="domain" label="Nom de domaine" value={s?.domain} missing={isMissing("domain")} hint="sans https://, ex. elios-solar.fr" />
          </div>
        </Section>
        <Section title="Fiscalité, indexation et mesure d'audience">
          <div className="grid gap-4 md:grid-cols-2">
            <Field name="taxRate" label="TVA par défaut (%)" value={String((s?.defaultTaxRateBps ?? 2000) / 100)} hint="Appliquée aux nouveaux articles ; les commandes passées conservent leur taux." />
            <div className="space-y-2 self-end pb-2 text-sm">
              <label className="flex items-center gap-2"><input type="checkbox" name="indexable" className="h-4 w-4" defaultChecked={s?.indexable ?? false} /> Site indexable par les moteurs de recherche</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="analyticsEnabled" className="h-4 w-4" defaultChecked={s?.analyticsEnabled ?? false} /> Mesure d'audience activée (soumise au consentement)</label>
            </div>
            <div className="md:col-span-2"><Field name="analyticsScriptUrl" label="URL du script de mesure d'audience" value={s?.analyticsScriptUrl} type="url" hint="https:// uniquement ; chargé seulement après consentement." /></div>
          </div>
          <p className="mt-3 text-xs text-stone-700">L'indexation dépend aussi de la variable d'environnement SITE_INDEXABLE (actuellement : {process.env.SITE_INDEXABLE === "true" ? "true" : "false"}).</p>
        </Section>
        <button className="btn-primary" type="submit">Enregistrer les réglages</button>
      </form>
    </div>
  );
}

export function DemoBadge({ label = "Prix de démonstration", className = "" }: { label?: string; className?: string }) {
  return (
    <span className={`badge-demo ${className}`} title="Données de démonstration : ne constituent pas une offre commerciale.">
      {label}
    </span>
  );
}

export function artKind(slug: string): "glass" | "slats" | "screen" | "led" | "heater" | "lantern" | "sensor" {
  if (slug.includes("vitree")) return "glass";
  if (slug.includes("persienne")) return "slats";
  if (slug.includes("vertical")) return "screen";
  if (slug.includes("led")) return "led";
  if (slug.includes("chauff")) return "heater";
  if (slug.includes("lantern")) return "lantern";
  return "sensor";
}

/**
 * Scripts d'exploitation hors de Next (tsx) : le paquet « server-only » n'est fourni que par le compilateur Next. Ce
 * préchargement le remplace par un module vide pour les seuls scripts lancés avec
 *   NODE_OPTIONS="--require ./scripts/lib/server-only-shim.cjs" tsx scripts/<script>.ts
 * (aucun effet sur l'application).
 */
// eslint-disable-next-line @typescript-eslint/no-require-imports -- préchargement CommonJS (--require)
const Module = require("node:module");
const load = Module._load;
Module._load = function (request, parent, isMain) {
  if (request === "server-only") return {};
  return load.call(this, request, parent, isMain);
};

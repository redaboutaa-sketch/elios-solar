// Garde X-Forwarded-For, préchargée par le serveur Next autonome : `node -r ./xff-guard.cjs server.js`.
// better-auth (getIP) et les quotas de l'application ne lisent que les en-têtes : sans cette garde, un pair
// qui joint directement le port de l'application (autre conteneur du réseau traefik-public, tunnel SSH)
// choisirait librement son IP, car Next ne remplace pas un X-Forwarded-For déjà présent.
// Règle : l'en-tête reçu n'est conservé que si le pair TCP appartient à TRUSTED_PROXIES (adresses ou CIDR,
// séparés par des virgules) ; le pair y est alors ajouté en fin de chaîne. Sinon l'en-tête est remplacé
// par l'adresse du pair. TRUSTED_PROXIES vide = aucun proxy de confiance.
/* eslint-disable @typescript-eslint/no-require-imports -- module CommonJS préchargé par node -r */
"use strict";
const http = require("node:http");
const net = require("node:net");

function normalizePeer(addr) {
  if (!addr) return null;
  const v4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(addr);
  return v4 ? v4[1] : addr;
}

function parseTrusted(spec) {
  const list = new net.BlockList();
  const invalid = [];
  let count = 0;
  for (const raw of (spec ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [ip, prefix] = raw.split("/");
    const family = net.isIPv4(ip) ? "ipv4" : net.isIPv6(ip) ? "ipv6" : null;
    const max = family === "ipv4" ? 32 : 128;
    const bits = prefix === undefined ? max : Number(prefix);
    if (!family || !Number.isInteger(bits) || bits < 0 || bits > max) { invalid.push(raw); continue; }
    if (bits === max) list.addAddress(ip, family); else list.addSubnet(ip, bits, family);
    count++;
  }
  return { list, count, invalid };
}

function isTrusted(trusted, peer) {
  if (!peer || trusted.count === 0) return false;
  const family = net.isIPv4(peer) ? "ipv4" : net.isIPv6(peer) ? "ipv6" : null;
  return family ? trusted.list.check(peer, family) : false;
}

/** Valeur X-Forwarded-For à transmettre à l'application (null = pair inconnu : en-tête supprimé). */
function forwardedFor(received, peerAddr, trusted) {
  const peer = normalizePeer(peerAddr);
  if (!peer) return null;
  if (!isTrusted(trusted, peer)) return peer;
  const chain = Array.isArray(received) ? received.join(",") : received;
  return chain && chain.trim() ? `${chain}, ${peer}` : peer;
}

function install(spec = process.env.TRUSTED_PROXIES) {
  const trusted = parseTrusted(spec);
  if (trusted.invalid.length) console.warn(`[xff-guard] entrées TRUSTED_PROXIES ignorées : ${trusted.invalid.join(", ")}`);
  const emit = http.Server.prototype.emit;
  http.Server.prototype.emit = function (event, req, ...rest) {
    if (event === "request" && req && req.headers) {
      const value = forwardedFor(req.headers["x-forwarded-for"], req.socket && req.socket.remoteAddress, trusted);
      if (value) req.headers["x-forwarded-for"] = value; else delete req.headers["x-forwarded-for"];
    }
    return emit.call(this, event, req, ...rest);
  };
}

module.exports = { forwardedFor, parseTrusted, normalizePeer, install };
if (require.main !== module && !process.env.XFF_GUARD_NO_INSTALL) install();

import pino from "pino";

/** Journal applicatif : jamais de données personnelles en clair (e-mails hachés en amont). */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: { paths: ["email", "*.email", "password", "*.password", "token", "*.token", "req.headers.authorization", "req.headers.cookie"], censor: "[masqué]" },
});

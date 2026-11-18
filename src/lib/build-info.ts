/** Identifiant du code exécuté (injecté au build Docker : GIT_COMMIT, BUILD_TIME). */
export function buildInfo() {
  const commit = process.env.GIT_COMMIT && process.env.GIT_COMMIT !== "unknown" ? process.env.GIT_COMMIT : "dev";
  return { commit, shortCommit: commit.slice(0, 7), builtAt: process.env.BUILD_TIME ?? "unknown" };
}

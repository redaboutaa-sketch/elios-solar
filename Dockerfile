# syntax=docker/dockerfile:1.7
# Image reproductible (lockfile), sortie standalone, utilisateur non root.
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN pnpm db:generate && pnpm exec next typegen && pnpm build

# ---- image d'exécution de l'application web ----
FROM base AS runner
ARG GIT_COMMIT=unknown
ARG BUILD_TIME=unknown
ENV NODE_ENV=production PORT=3400 HOSTNAME=0.0.0.0 GIT_COMMIT=$GIT_COMMIT BUILD_TIME=$BUILD_TIME
RUN groupadd -r app && useradd -r -g app -d /app app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
RUN mkdir -p /app/uploads && chown app:app /app/uploads
USER app
EXPOSE 3400
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:3400/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]

# ---- image outils : migrations, seed, worker e-mail, import, sauvegarde ----
FROM deps AS tools
ARG GIT_COMMIT=unknown
ENV GIT_COMMIT=$GIT_COMMIT
COPY . .
RUN pnpm db:generate && apt-get update && apt-get install -y --no-install-recommends postgresql-client && rm -rf /var/lib/apt/lists/* \
  && groupadd -r app && useradd -r -g app -d /app app && chown -R app:app /app
USER app
CMD ["pnpm", "mail:worker"]

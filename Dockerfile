# syntax=docker/dockerfile:1
FROM node:24-bookworm-slim AS base

RUN npm install --global pnpm@12.21.0
WORKDIR /app

FROM base AS build
ENV CI=1 \
    EXPO_NO_TELEMETRY=1

# Install from the committed lockfile before copying changing application files.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc tsconfig.base.json ./
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY apps/server/package.json ./apps/server/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN pnpm install --frozen-lockfile

COPY apps/mobile ./apps/mobile
COPY apps/server ./apps/server
COPY packages/shared ./packages/shared
COPY scripts ./scripts
RUN pnpm build

# A fresh image downloads and verifies the pinned PhET files. No host cache or
# OPENAI_API_KEY is part of this build; failed verification stops the image build.
RUN pnpm phet:sync

FROM base AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    PHYSIM_WORKSPACE_ROOT=/app \
    WEB_DIST_DIR=/app/apps/mobile/dist \
    PHET_STORAGE_DIR=/app/apps/server/storage/phet-sims

# The server starts TypeScript with Node 24's transform-types support. Preserve
# server/shared sources and workspace links, as well as the static Expo export.
# Keep the verified installation intact instead of breaking hoisted dependencies.
COPY --from=build --chown=node:node /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/server ./apps/server
COPY --from=build --chown=node:node /app/packages/shared ./packages/shared
COPY --from=build --chown=node:node /app/apps/mobile/package.json ./apps/mobile/package.json
COPY --from=build --chown=node:node /app/apps/mobile/dist ./apps/mobile/dist

# pnpm may create project-local state when starting; the app runs as node.
RUN chown node:node /app
USER node
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:4000/api/v1/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"
CMD ["pnpm", "start"]

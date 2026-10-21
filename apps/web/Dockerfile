# Build context is the monorepo root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS builder
WORKDIR /repo

RUN corepack enable

COPY . .
# Only the web app and the workspace packages it depends on; the mobile app stays out.
RUN pnpm install --frozen-lockfile --filter "web..." --config.allow-unused-patches=true

# Inlined into the browser bundle at build time, so it is a build argument, not a runtime variable.
ARG NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter web build

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3001

COPY --from=builder --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=builder --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=node:node /repo/apps/web/public ./apps/web/public

USER node

EXPOSE 3001

CMD ["node", "apps/web/server.js"]

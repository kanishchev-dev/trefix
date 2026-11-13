FROM node:22-alpine AS deps
WORKDIR /app

COPY package*.json ./
RUN npm ci --legacy-peer-deps --ignore-scripts

FROM node:22-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# One-shot image for `sequelize-cli db:migrate`: the CLI and ts-node are dev dependencies.
FROM builder AS migrator
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate"]

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/i18n ./dist/i18n

# The image ships no secrets and needs no privileges: run as the unprivileged user of the base image.
USER node

EXPOSE 3000

CMD ["node", "dist/src/main.js"]

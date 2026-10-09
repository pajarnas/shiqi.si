# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/web/Dockerfile .

FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# Install with only manifests first, so dependency layers cache across code changes.
FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/
COPY packages/pixel/package.json packages/pixel/
COPY packages/ui/package.json packages/ui/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @shiqi/web build \
 && pnpm --filter @shiqi/web deploy --prod --legacy /out \
 && cp -r apps/web/build /out/build

FROM node:22-alpine AS runtime
ENV NODE_ENV=production PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /out ./
USER node
EXPOSE 3000
ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION
CMD ["node_modules/.bin/react-router-serve", "./build/server/index.js"]

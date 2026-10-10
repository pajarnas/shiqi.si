# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/web/Dockerfile .

# Install and build on the runner's own CPU, even for the arm64 image: emulating
# arm64 made an uncached install + build take over half an hour. The output is
# plain JavaScript (no native addons in production dependencies), so only the
# runtime stage below is per-platform.
FROM --platform=$BUILDPLATFORM node:22-alpine AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# Install with only manifests first, so dependency layers cache across code changes.
# Every workspace package.json is collected, so a new package needs no edit here;
# the copy below stays cached as long as the manifests themselves don't change.
FROM base AS manifests
COPY . .
RUN mkdir /manifests \
 && cp pnpm-lock.yaml pnpm-workspace.yaml package.json /manifests/ \
 && for f in apps/*/package.json packages/*/package.json; do \
      mkdir -p "/manifests/$(dirname "$f")" && cp "$f" "/manifests/$f"; done

FROM base AS deps
COPY --from=manifests /manifests ./
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

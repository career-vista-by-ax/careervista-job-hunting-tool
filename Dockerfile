# syntax=docker/dockerfile:1
ARG NODE_VERSION=26.12.0
FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /build
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY scripts/copy-assets.mjs ./scripts/copy-assets.mjs
RUN npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG VERSION=0.2.0-preview.2
LABEL org.opencontainers.image.title="CareerVista" \
      org.opencontainers.image.description="Local Australian job-search workspace; use your own agent on the host" \
      org.opencontainers.image.source="https://github.com/career-vista-by-ax/careervista-job-hunting-tool" \
      org.opencontainers.image.version="${VERSION}"
WORKDIR /opt/careervista
ENV PLAYWRIGHT_BROWSERS_PATH=/opt/playwright
COPY docker/package.json docker/package-lock.json ./headless/
RUN cd headless && npm ci --ignore-scripts --no-audit --no-fund \
    && npx playwright install --with-deps chromium --only-shell \
    && rm -rf /var/lib/apt/lists/*
COPY docker/headless.mjs ./headless/headless.mjs
COPY --from=build /build/dist ./bundle/app/dist
COPY docs ./bundle/app/docs
COPY agent-skills ./bundle/agent-skills
COPY README.md CONTRIBUTING.md ./bundle/app/
COPY package.json ./bundle/app/package.json
COPY docker/create-bundle.mjs docker/entrypoint.mjs docker/healthcheck.mjs ./
ENV CAREERVISTA_IMAGE_VERSION=${VERSION}
RUN node create-bundle.mjs && mkdir -p /var/lib/careervista && chown node:node /var/lib/careervista
USER node
ENV CAREERVISTA_ROOT=/var/lib/careervista/workspace \
    CAREERVISTA_PORT=4318 \
    CAREERVISTA_BIND_HOST=0.0.0.0 \
    CAREERVISTA_PUBLIC_ORIGIN=http://127.0.0.1:4318
EXPOSE 4318
VOLUME ["/var/lib/careervista"]
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 CMD ["node", "healthcheck.mjs"]
CMD ["node", "entrypoint.mjs"]

FROM node:24-bookworm-slim AS build
WORKDIR /app/srcs/frontend
RUN npm install --global bun@1.4.4 --no-audit --no-fund
COPY srcs/frontend/package.json srcs/frontend/bun.lock ./
RUN bun install --frozen-lockfile
COPY srcs/frontend/ ./
COPY srcs/core/ /app/srcs/core/
COPY docs/privacy-policy.md docs/terms-of-service.md /app/docs/
RUN npm run build

FROM caddy:2-alpine
COPY setup/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/srcs/frontend/dist /srv
RUN mkdir -p /data /config && chown -R 1000:1000 /data /config
USER 1000:1000
EXPOSE 8443

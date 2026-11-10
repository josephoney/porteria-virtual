# Static web image: dashboard + public pass page, served by Caddy.
FROM node:22-alpine AS build

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm --filter @porteria/shared build
RUN pnpm --filter @porteria/database build
RUN pnpm --filter @porteria/dashboard build
RUN pnpm --filter @porteria/pass-web build

FROM caddy:2-alpine

COPY deploy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/apps/dashboard/dist /srv/dashboard
COPY --from=build /app/apps/pass-web/dist /srv/pass-web

EXPOSE 80 443

# Imagen web: compila las tres apps estáticas y las sirve con Caddy.
#
# Se construye desde la raíz del repo. Un solo contenedor atiende dashboard,
# pass-web y kiosco; Caddy decide por ruta.

FROM node:22-alpine AS build
RUN corepack enable
WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/dashboard/package.json apps/dashboard/
COPY apps/pass-web/package.json apps/pass-web/
COPY apps/kiosk/package.json apps/kiosk/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/dashboard apps/dashboard
COPY apps/pass-web apps/pass-web
COPY apps/kiosk apps/kiosk

RUN pnpm --filter @porteria/shared build \
 && pnpm --filter @porteria/dashboard build \
 && pnpm --filter @porteria/pass-web build \
 && pnpm --filter @porteria/kiosk build

FROM caddy:2-alpine AS runtime
COPY --from=build /app/apps/dashboard/dist /srv/dashboard
COPY --from=build /app/apps/pass-web/dist /srv/p
# El kiosco se sirve desde /srv para respetar su base /kiosk/.
COPY --from=build /app/apps/kiosk/dist /srv/kiosk
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443

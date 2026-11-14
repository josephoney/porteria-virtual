# Imagen del API y de las migraciones.
#
# Se construye desde la raíz del repo: necesita el workspace completo porque el
# API depende de @porteria/shared y @porteria/database compilados.

FROM node:22-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS build
# Manifiestos primero: si no cambian, la capa de dependencias se reutiliza.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/database/package.json packages/database/
COPY server/api/package.json server/api/
RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages packages
COPY server/api server/api
RUN pnpm --filter @porteria/shared build \
 && pnpm --filter @porteria/database build \
 && pnpm --filter @porteria/api build

# La imagen final conserva node_modules porque las migraciones usan drizzle-kit,
# que es una dependencia de desarrollo. Es más grande y menos limpia que un
# runtime podado, y a cambio el deploy no necesita un paso extra en el servidor.
FROM build AS runtime
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /app/server/api
CMD ["node", "dist/index.js"]

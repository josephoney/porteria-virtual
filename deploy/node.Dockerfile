# Runtime image for the Node services: API, signaling and MQTT bridge.
#
# The workspace packages export TypeScript sources, so the services run with
# `tsx` in v1. CI typechecks the code before publishing the image. A future
# packaging pass can emit `dist` for every workspace package and switch the
# commands to plain `node`.
FROM node:22-alpine

RUN corepack enable

WORKDIR /app

COPY . .

RUN pnpm install --frozen-lockfile

ENV NODE_ENV=production

EXPOSE 3000 3001 3002

CMD ["pnpm", "--filter", "@porteria/api", "exec", "tsx", "src/index.ts"]

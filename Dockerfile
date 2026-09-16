# Medusa backend — Northflank / Oracle / any Docker host
FROM node:20-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn ./.yarn
COPY medusa-config.ts tsconfig.json ./

RUN yarn install --immutable

COPY . .

RUN yarn build

ENV NODE_ENV=production
EXPOSE 9000

# Platform sets PORT; Medusa binds 0.0.0.0:$PORT
CMD ["sh", "-c", "yarn medusa db:migrate && yarn medusa start"]

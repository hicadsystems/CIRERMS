FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tailwind.config.js ./
COPY public ./public
RUN npm run css:build && npm prune --omit=dev

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/public ./public
COPY package.json migrate.js ./
COPY src ./src
RUN mkdir -p storage/uploads/photos storage/uploads/documents \
  && chown -R node:node /app

USER node
EXPOSE 3000
CMD ["node", "src/server.js"]

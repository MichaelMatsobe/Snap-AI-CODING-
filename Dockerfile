# Snap! Technical Atelier — production image
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
COPY tsconfig.json ./
RUN mkdir -p /app/data
EXPOSE 3001
CMD ["npx", "tsx", "server/index.ts"]

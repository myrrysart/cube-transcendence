# Local-network API, migration and scoring-worker image.
FROM node:24-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app/srcs/backend
COPY srcs/backend/package.json srcs/backend/package-lock.json ./
COPY srcs/backend/prisma ./prisma
RUN npm ci --no-audit --no-fund && npm run prisma:generate
COPY srcs/backend/tsconfig.json ./
COPY srcs/backend/src ./src
COPY srcs/backend/test ./test
COPY srcs/core/ /app/srcs/core/
RUN npm run build
USER node
CMD ["npm", "start"]

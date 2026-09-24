FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY assets ./assets
COPY auth ./auth
COPY modules ./modules
COPY server ./server
COPY tools/install-database.cjs tools/container-start.cjs ./tools/
COPY database.sql index.html ./
USER node
EXPOSE 3000
CMD ["node", "tools/container-start.cjs"]

# Bun-native, single stage. Deploy anywhere — or managed on Berth (useberth.com).
FROM oven/bun:1
WORKDIR /app
COPY package.json ./
RUN bun install --production
COPY . .
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "server.ts"]

# Static Qwik site pre-rendered by the static adapter, served by nginx.
# Node+npm for the build — Qwik's SSG is reliable on Node's worker_threads (Bun
# silently emits 0 pages in-container), matching the prehoy / darka.io builds.

# --- build (Node + npm) ---
FROM node:20-slim AS build
WORKDIR /usr/src/app
COPY package.json ./
# --legacy-peer-deps: the dep tree has peer conflicts Bun tolerates but npm rejects.
RUN npm install --legacy-peer-deps
COPY . .
# client build emits hashed assets; server build runs the static SSG into dist/.
RUN npm run build.client && npm run build.server

# --- runtime: static file server ---
FROM nginx:1.27-alpine AS final
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80

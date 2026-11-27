FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts vite.buildIdPlugin.ts vite.initialThemePlugin.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.31.9-alpine@sha256:fb4658584bd9a916ffb6f6e365f97c25cfdb2923801f551ea08356e695f14ff7

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
RUN nginx -t
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

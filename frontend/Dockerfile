FROM node:22.23.5-alpine@sha256:1314fb30ec37592d5845e5a160d522c0e680972aa534549940b8d73bde88481a AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts vite.buildIdPlugin.ts vite.initialThemePlugin.ts tsconfig.json tsconfig.node.json ./
COPY public ./public
COPY src ./src

RUN npm run build

FROM nginx:1.31.8-alpine@sha256:fed7e14be83cbd2661a75cdc5b872d936cf155d46c327084d30b8df19ae88d72

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/security-headers.conf
RUN nginx -t
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

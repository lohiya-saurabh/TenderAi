# Multi-stage production Dockerfile for TenderPulse Web SPA
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/web/ apps/web/

RUN npm install
RUN npm run build --workspace=@tenderpulse/shared-types
RUN npm run build --workspace=@tenderpulse/ui
RUN npm run build --workspace=@tenderpulse/web

FROM nginx:alpine AS runner
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

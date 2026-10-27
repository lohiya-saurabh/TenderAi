# Multi-stage production Dockerfile for TenderPulse API
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/ packages/
COPY apps/api/ apps/api/

RUN npm install
RUN npm run build --workspace=@tenderpulse/shared-types
RUN npm run build --workspace=@tenderpulse/api

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

# AWS RDS CA bundle: the API verifies the database's TLS certificate (DATABASE_SSL=verify-full).
ADD https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certs/rds-global-bundle.pem

EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

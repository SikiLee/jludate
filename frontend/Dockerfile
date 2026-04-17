# Build stage
FROM node:20-alpine as build
WORKDIR /app
COPY package*.json ./
# Default to the global npm registry; can be overridden for local mirrors.
ARG NPM_REGISTRY=https://registry.npmjs.org/
# frontend package-lock may pin mirror URLs; regenerate lock in container to avoid regional mirror failures.
RUN rm -f package-lock.json && npm install --registry=${NPM_REGISTRY}
COPY . .
RUN npm run build

# Production stage
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

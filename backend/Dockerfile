FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
ARG NPM_REGISTRY=https://registry.npmjs.org/
RUN npm install --registry=${NPM_REGISTRY}

COPY . .
RUN npm run build

EXPOSE 8000
CMD ["npm", "run", "start"]

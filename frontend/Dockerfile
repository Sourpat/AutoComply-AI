# Build stage
FROM node:20-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Runtime stage - use Vite preview server
FROM node:20-alpine AS runtime

WORKDIR /app

# Only copy built assets + necessary files
COPY --from=build /app ./

EXPOSE 4173

# VITE_API_BASE will be passed from docker-compose
CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0", "--port", "4173"]

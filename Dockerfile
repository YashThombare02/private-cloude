FROM node:20-alpine

WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy package files for caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY artifacts/api-server/package.json ./artifacts/api-server/
COPY artifacts/cloud/package.json ./artifacts/cloud/
COPY lib/api-zod/package.json ./lib/api-zod/
COPY lib/api-client-react/package.json ./lib/api-client-react/
COPY lib/db/package.json ./lib/db/

# Install dependencies
RUN pnpm install

# Copy source code
COPY . .

# Build the workspace (API server and dependencies)
# We can skip building the frontend in the docker image to save time
RUN pnpm --filter @workspace/api-server... run build

# Expose port
EXPOSE 5000

# Start the API server
WORKDIR /app/artifacts/api-server
CMD ["pnpm", "run", "start"]

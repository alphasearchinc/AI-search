# Use a recent Node LTS image
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies first (better caching)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* .npmrc* ./ 
# Use npm by default – adjust to yarn/pnpm if needed
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the rest of the app
COPY . .

# Set env for production
ENV NODE_ENV=production
ENV PORT=9000

EXPOSE 9000

# Adjust this to whatever your Medusa start script is
# e.g. if package.json has "start": "medusa start"
CMD ["npm", "run", "start"]

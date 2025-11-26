# Use a recent Node LTS image
FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies (including devDependencies, needed for TS + Medusa CLI)
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* .npmrc* ./ 
RUN npm ci || npm install

# Copy the rest of the app
COPY . .

# Set env for production-ish runtime
ENV NODE_ENV=production
ENV PORT=9000

EXPOSE 9000

# For now, run the dev server (same as local `npm run dev`)
# Once everything works, we’ll switch this to `npm run start` with a proper build step.
CMD ["npm", "run", "dev"]

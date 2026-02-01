# Use an official Node runtime as a parent image
FROM node:18-alpine

# Set work directory
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json* ./
# Use --legacy-peer-deps if needed, or just install
RUN npm install

# Copy project
COPY . .

# Build the app
# Note: NEXT_PUBLIC_API_BASE will be baked in here. 
# If not set, it defaults to what's in .env or undefined (which falls back to localhost:8000 in api.ts)
RUN npm run build

# Expose port
EXPOSE 3000

# Run command
CMD ["npm", "start"]

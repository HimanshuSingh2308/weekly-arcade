FROM node:20-alpine

WORKDIR /app

# Copy package.json first for better caching
COPY package.json ./

# Install production dependencies
RUN npm install --omit=dev

# Copy the built API code (excluding node_modules from dist)
COPY dist/*.js ./
COPY dist/*.js.map ./

# Copy the shared package (after npm install so it doesn't get overwritten)
COPY dist/node_modules/@weekly-arcade ./node_modules/@weekly-arcade

# Expose port 8080
EXPOSE 8080

# Start the server
CMD ["node", "main.js"]

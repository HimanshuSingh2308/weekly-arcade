FROM node:20-alpine

WORKDIR /app

# Copy package.json and install prod deps
COPY package.json ./
RUN npm install --omit=dev

# Copy the pre-built files (must run nx build api before deploying)
COPY dist/main.js ./
COPY dist/main.js.map ./

EXPOSE 8080

CMD ["node", "main.js"]

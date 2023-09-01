# Base image
FROM node:18

# Use "node" user instead root user.
USER node

# Create app directory
WORKDIR /usr/app

# Copy package.json
COPY --chown=node:node package.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Bundle app source
COPY --chown=node:node . .

# Compile project and create "dist" folder
RUN npm run build

# Start the server using the production build
CMD [ "node", "dist/main.js" ]
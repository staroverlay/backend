# Base image
FROM node:18

# Use "node" user instead root user.
USER node

# Create app directory
WORKDIR /usr/app

# Copy package.json and yarn.lock
COPY --chown=node:node package.json yarn.lock ./

# Install dependencies
RUN yarn install --frozen-lockfile

# Bundle app source
COPY --chown=node:node . .

# Expose port (if applicable)
EXPOSE 3000

# Start the server using the production build
CMD [ "node", "dist/main.js" ]

# Base image
FROM node:20.14

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

# Build the app
RUN yarn build

# Expose port (if applicable)
EXPOSE 3000

# Start the server using the production build
CMD [ "yarn", "start" ]

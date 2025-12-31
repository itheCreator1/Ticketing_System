FROM node:20-slim

# Install required packages
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    postgresql-client \
    netcat-openbsd \
    bash \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /usr/src/app

# Configure npm to use HTTP registry (TLS issues in this environment)
RUN npm config set registry http://registry.npmjs.org/ && \
    npm config set strict-ssl false

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# Install dependencies
RUN npm install --legacy-peer-deps

# Bundle app source
COPY . .

# Copy and set permissions for entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# Use entrypoint script
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
CMD [ "node", "index.js" ]

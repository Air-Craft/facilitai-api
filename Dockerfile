FROM node:20-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json ./

#RUN npm install
RUN npm ci --only=production

# Bundle app source
COPY . .

EXPOSE 3000

# Default command
CMD [ "npm", "run", "start" ]
#CMD [ "node", "index.js" ]


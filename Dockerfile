FROM node:18-alpine AS base

WORKDIR /app

COPY package.json package-lock.json* ./

RUN npm install --production --ignore-scripts

COPY . .

ENV NODE_ENV=production \
    PORT=3001

EXPOSE 3001

CMD ["npm", "start"]

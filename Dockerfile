FROM node:22 as base

WORKDIR /home/node/app

COPY package.json ./

RUN npm i

COPY . .

CMD [ "npm", "run", "dev" ]

FROM base as production

ENV NODE_PATH=./build

RUN npm run build
CMD [ "npm", "run", "start"]
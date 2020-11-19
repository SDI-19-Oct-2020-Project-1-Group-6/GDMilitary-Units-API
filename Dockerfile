FROM node:current-alpine
RUN mkdir /app
COPY ./ /app
WORKDIR /app
RUN npm install

CMD ["npx","nodemon","node","."]
FROM nginx:1.12.0-alpine
RUN apk update && apk add bash
COPY . /microservice
WORKDIR  /microservice/service

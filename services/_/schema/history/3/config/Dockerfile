FROM giorgiocasciaro/ubuntu-node:v2
COPY ./package.json /microservice/package.json
COPY ./node_modules /microservice/node_modules
COPY ./service /microservice/service

WORKDIR  /microservice/
CMD ["sh","-c","'npm start'"]
# ENTRYPOINT ["bash"]

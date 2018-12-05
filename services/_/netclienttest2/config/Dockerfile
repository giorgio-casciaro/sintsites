FROM giorgiocasciaro/ubuntu-node:v3
COPY ./package.json /microservice/package.json
COPY ./node_modules /microservice/node_modules
COPY ./service /microservice/service

RUN mkdir /uploads
RUN chmod 777 /uploads

WORKDIR  /microservice/
CMD ["sh","-c","'npm start'"]
# ENTRYPOINT ["bash"]

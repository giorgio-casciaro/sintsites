FROM klokantech/tileserver-gl:latest
# RUN apt-get install -y libssl1.0.0 libssl-dev liblua5.1-dev
COPY ./data /microservice/data
WORKDIR  /microservice/
CMD ["sh","-c","'/usr/src/app/run.sh'"]

FROM giorgiocasciaro/alpine-node-lua-aerospike:v1

ENV LUA_VERSION 5.1
ENV LUA_PACKAGE lua${LUA_VERSION}

RUN apk add --no-cache \
    ${LUA_PACKAGE} ${LUA_PACKAGE}-dev \
    build-base bash git linux-headers \
    libuv libuv-dev openssl openssl-dev python-dev python
RUN apk add --update --no-cache zeromq-dev
RUN apk add --update --no-cache mc
RUN apk add --update --repository http://nl.alpinelinux.org/alpine/edge/main libwebp-dev fftw-dev  && \
  apk add --update \
  --repository http://dl-3.alpinelinux.org/alpine/edge/testing \
  libwebp-dev fftw-dev vips-dev \
  && rm -rf /var/cache/apk/*
#
# COPY ./service /service
# WORKDIR  /service/

COPY ./scripts /scripts

ENTRYPOINT ["/scripts/start.sh"]
# ENTRYPOINT ["bash"]

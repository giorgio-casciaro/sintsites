FROM node:7-alpine
USER root

# PREPARE AEROSPIKE CLIENT FOR NODE ON ALPINE
WORKDIR /src

# Version of Lua we're building the image for.
ENV LUA_VERSION 5.1
ENV LUA_PACKAGE lua${LUA_VERSION}

# Update apk index.
RUN apk update
ENV EVENT_LIB libuv

ENV PREFIX /src/aerospike-client-c/target/Linux-x86_64
ENV AEROSPIKE_LUA_PATH /src/aerospike-client-c/modules/lua-core/src

RUN apk add --no-cache \
    ${LUA_PACKAGE} ${LUA_PACKAGE}-dev \
    build-base bash git linux-headers \
    libuv libuv-dev openssl openssl-dev python-dev python &&\
    git clone https://github.com/aerospike/aerospike-client-c &&\
    cd aerospike-client-c &&\
    git submodule update --init &&\
    make &&\
    npm install aerospike -g &&\
    apk del build-base linux-headers bash git libuv libuv-dev openssl openssl-dev python-dev python  && \
    apk add --update --repository http://nl.alpinelinux.org/alpine/edge/main libwebp-dev fftw-dev  && \
    apk add --update \
    --repository http://dl-3.alpinelinux.org/alpine/edge/testing \
    libwebp-dev fftw-dev vips-dev \
    && rm -rf /var/cache/apk/*

RUN apk add bash --no-cache

WORKDIR /
RUN npm link aerospike

ENTRYPOINT ["bash"]

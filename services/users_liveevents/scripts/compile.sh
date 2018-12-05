#!/bin/bash
#set -x
DIR=$(dirname "$(readlink -f "$0")")
docker run -v "$DIR/..":"/microservice" -v "/npm_cache":"/npm_cache"  giorgiocasciaro/ubuntu-node-compiler-10:0.0.1 sh -c "cd /microservice && npm install --production --cache /npm_cache/ && npm audit fix"
# docker run -v "$DIR/..":"/microservice" -v "/npm_cache":"/npm_cache"  giorgiocasciaro/ubuntu-node-compiler-10:0.0.1 sh -c "cd /microservice &&  npm update --save/--save-dev"
# docker run -v "$DIR/..":"/microservice"  giorgiocasciaro/ubuntu-node-compiler-10:0.0.1 sh -c "cd /microservice && npm install --production  && npm rebuild "

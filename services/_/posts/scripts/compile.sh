#!/bin/bash
#set -x
DIR=$(dirname "$(readlink -f "$0")")
docker run -v "$DIR/..":"/microservice" -v "$DIR/../../../npm_cache":"/npm_cache"  giorgiocasciaro/ubuntu-node-compiler:v4 sh -c "cd /microservice && npm install --production --cache /npm_cache/"

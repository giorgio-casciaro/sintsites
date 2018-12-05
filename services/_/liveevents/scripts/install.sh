#!/bin/bash
#set -x
DIR=$(dirname "$(readlink -f "$0")")
docker run -v "$DIR/../service":"/microservice/service" -v "$DIR/../package.json":"/microservice/package.json" -v "$DIR/../../../../civil_microservices_shared_modules":"/microservice/node_modules"  giorgiocasciaro/ubuntu-node-compiler:v4 sh -c "cd /microservice && npm install --production"

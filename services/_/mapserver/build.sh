#!/bin/bash
set -x
DIR=$(dirname "$(readlink -f "$0")")
VERSION="test"
RAW_IMAGE_NAME="giorgiocasciaro/civil-microservices-map"
IMAGE_NAME="$RAW_IMAGE_NAME:$VERSION";
IMAGE_NAME_LATEST="$RAW_IMAGE_NAME:latest";

#  docker update
echo  "Docker build and push"
docker build -t $IMAGE_NAME  -t $IMAGE_NAME_LATEST  -f "$DIR/config/Dockerfile" $DIR
# docker push $IMAGE_NAME

echo "docker push $IMAGE_NAME"

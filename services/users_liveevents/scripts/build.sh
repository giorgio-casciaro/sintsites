#!/bin/bash
set -x
DIR=$(dirname "$(readlink -f "$0")")
VERSION=$(cat "$DIR/../info/service.version")
RAW_IMAGE_NAME=$(cat "$DIR/../info/service.image")
IMAGE_NAME="$RAW_IMAGE_NAME:$VERSION";
IMAGE_NAME_LATEST="$RAW_IMAGE_NAME:latest";

sh $DIR/compile.sh

#  docker update
echo  "Docker build and push"
docker build -t $IMAGE_NAME  -t $IMAGE_NAME_LATEST  -f "$DIR/../config/Dockerfile" $DIR/..

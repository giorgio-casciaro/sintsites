#!/bin/bash
#set -x
DIR=$(dirname "$(readlink -f "$0")")
RAW_VERSION=$(cat "./service.version")
RAW_IMAGE_NAME=$(cat "./service.image")
IMAGE_NAME="$RAW_IMAGE_NAME:version-$RAW_VERSION";
echo $IMAGE_NAME
docker build -t $IMAGE_NAME  -f "./docker/Dockerfile" .

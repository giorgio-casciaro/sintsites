#!/bin/bash
set -x
DIR=$(dirname "$(readlink -f "$0")")
VERSION=$(cat "$DIR/../info/service.version")
RAW_IMAGE_NAME=$(cat "$DIR/../info/service.image")
IMAGE_NAME="$RAW_IMAGE_NAME:$VERSION";
IMAGE_NAME_LATEST="$RAW_IMAGE_NAME:latest";

sh $DIR/build.sh

#  docker update
echo  "Docker push"
docker push $IMAGE_NAME

echo  "Update config"
LAST_VERSION=$((VERSION - 1))
RAW_IMAGE_NAME_ESCAPED=$(echo $RAW_IMAGE_NAME | sed -e 's/[\/&]/\\&/g' )
LAST_IMAGE_NAME_ESCAPED="$RAW_IMAGE_NAME_ESCAPED:[0-9]*";
ACTUAL_IMAGE_NAME_ESCAPED=$(echo $IMAGE_NAME | sed -e 's/[\/&]/\\&/g')
sed -i -e "s/${LAST_IMAGE_NAME_ESCAPED}/${ACTUAL_IMAGE_NAME_ESCAPED}/g" $DIR/../config/*

echo  "Update History"
HISTORY_DIR="$DIR/../history/$VERSION"
mkdir -p "$HISTORY_DIR"
cp -R "$DIR/../config" "$HISTORY_DIR/config"
cp -R "$DIR/../info" "$HISTORY_DIR/info"

echo  "Update version"
NEW_VERSION=$((VERSION + 1))
echo "$NEW_VERSION" > $DIR/../info/service.version

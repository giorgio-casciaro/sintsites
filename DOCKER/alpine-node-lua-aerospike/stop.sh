#!/bin/sh
set -x
MICROSERVICE_ID="`cat ./dev/docker/MICROSERVICE_ID`"
echo $MICROSERVICE_ID;
docker stop $MICROSERVICE_ID


rm ./dev/docker/docker.cid
rm ./dev/docker/MICROSERVICE_ID
rm ./dev/docker/MICROSERVICE_INDEX
rm ./dev/docker/MICROSERVICE_SLUG

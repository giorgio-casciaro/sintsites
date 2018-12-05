#!/bin/bash
#set -x
MICROSERVICE_NAME=${PWD##*/};
MICROSERVICE_SLUG=$(echo "$MICROSERVICE_NAME" | tr '[:upper:]' '[:lower:]') ;
MICROSERVICE_ID=${PWD##*/};
MICROSERVICE_LOCAL_PATH="$PWD/docker/service";
MICROSERVICE_DOCKER_PATH="/service";
MICROSERVICE_DOCKER_IMAGE_NAME="giorgiocasciaro/$MICROSERVICE_ID:v2";
MICROSERVICE_USER="root";

reset;
echo "";
echo "************************************************************************************************************";
echo MICROSERVICE_ID $MICROSERVICE_ID
echo MICROSERVICE_DOCKER_IMAGE_NAME $MICROSERVICE_DOCKER_IMAGE_NAME
echo MICROSERVICE_LOCAL_PATH $MICROSERVICE_LOCAL_PATH
echo MICROSERVICE_DOCKER_PATH $MICROSERVICE_DOCKER_PATH
echo MICROSERVICE_USER $MICROSERVICE_USER
echo "************************************************************************************************************";
echo "";


cd docker
docker build  -t $MICROSERVICE_DOCKER_IMAGE_NAME  -f "./Dockerfile" .
docker stop $MICROSERVICE_ID
docker rm $MICROSERVICE_ID
#DOCKER CONTAINER
echo "docker exec -i -t --user $MICROSERVICE_USER $MICROSERVICE_ID /bin/bash "
echo "docker push $MICROSERVICE_DOCKER_IMAGE_NAME "

docker run -it --name $MICROSERVICE_ID   -v "$MICROSERVICE_LOCAL_PATH":"$MICROSERVICE_DOCKER_PATH"  $MICROSERVICE_DOCKER_IMAGE_NAME
# docker run -it --name $MICROSERVICE_ID -v "$MICROSERVICE_LOCAL_PATH:$MICROSERVICE_DOCKER_PATH"  $MICROSERVICE_DOCKER_IMAGE_NAME


#gnome-terminal -e "docker exec -i -t --user $MICROSERVICE_USER $MICROSERVICE_ID /bin/bash "  2>/dev/null
# lxterminal -e "docker exec -i -t --user $MICROSERVICE_USER   $MICROSERVICE_ID  /bin/bash  -c 'cd $MICROSERVICE_DOCKER_PATH && bash'"  2>/dev/null
# docker exec -i -t --user $MICROSERVICE_USER  $MICROSERVICE_ID bash
#npm run dev
#npm start

# docker stop $MICROSERVICE_ID

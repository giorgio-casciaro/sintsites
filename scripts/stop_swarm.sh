#/bin/bash
set +e

docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)
DIR=$(dirname "$(readlink -f "$0")")

CIVIL_SERV=""

docker stop $(docker ps -a -q)
docker rm $(docker ps -a -q)
docker system prune  --force --volumes
# docker network prune --force
docker swarm leave --force


# reset
# echo "docker-compose $CIVIL_SERV exec $1 /bin/bash" > $DIR/config/dev_service_string

# bash -c "docker-compose $CIVIL_SERV up $1  --remove-orphans --force-recreate"
# bash -c "docker swarm init"
#
# bash -c "docker stack deploy -c /service_deploy.yml civil-microservices"

#/bin/bash


DIR=$(dirname "$(readlink -f "$0")")

CIVIL_SERV=""


if [ -z "$1" ];
  then
    cd $DIR
    # $TERM -e 'sh webpack.sh' &
    cd $DIR/..

    for dir in ./services/*
    do
     serviceName=$(basename $dir)
     file="${dir}/config/docker-compose.yml"
     if [ -f "$file" ]; then
     # bash -c "docker stack deploy -c $file civil-microservices"
     CIVIL_SERV="$CIVIL_SERV docker service logs --follow civil-microservices_$serviceName &"

     fi
    done
    # sleep 5
    # xdg-open http://127.0.0.1:9000
    # reset
    echo $CIVIL_SERV
    bash -c "$CIVIL_SERV& fg"

    # sudo sysctl -w vm.max_map_count=262144
fi
# reset
# echo "docker-compose $CIVIL_SERV exec $1 /bin/bash" > $DIR/config/dev_service_string

# bash -c "docker-compose $CIVIL_SERV up $1  --remove-orphans --force-recreate"
# bash -c "docker swarm init"
#
# bash -c "docker stack deploy -c /service_deploy.yml civil-microservices"

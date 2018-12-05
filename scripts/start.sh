#/bin/bash
DIR=$(dirname "$(readlink -f "$0")")

CIVIL_SERV=""
for dir in ./services/*
do
 serviceName=$(basename $dir)
 file="${dir}/config/docker-compose.yml"
 if [ -f "$file" ]; then CIVIL_SERV="$CIVIL_SERV -f $file" ;fi
done

if [ -z "$1" ];
  then
    cd $DIR
    $TERM -e 'sh webpack.sh' &
    cd $DIR/..
    bash -c "docker-compose $CIVIL_SERV down"
    docker network prune --force
    sleep 1
    # sudo sysctl -w vm.max_map_count=262144
fi

reset
echo "docker-compose $CIVIL_SERV exec $1 /bin/bash" > $DIR/config/dev_service_string

bash -c "docker-compose $CIVIL_SERV up $1  --remove-orphans --force-recreate"

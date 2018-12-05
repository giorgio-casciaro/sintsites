#/bin/bash
DIR=$(dirname "$(readlink -f "$0")")
cd $DIR/..

services_compose=""
for dir in ./services/*
do
 serviceName=$(basename $dir)
 file="${dir}/config/docker-compose.yml"
 if [ -f "$file" ]; then services_compose="$services_compose -f $file" ;fi
done
bash -c "docker-compose $services_compose down"

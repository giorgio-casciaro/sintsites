#!/bin/bash

echo "\n------ ${1} --------"
file="$PWD/scripts/${1}"
if [ -f "$file" ]
then
  echo "ALL APP: OK"
  echo $file
  sh $file ${2} ${3}
fi


for dir in ./services/*
do
 # do something on "$file"
 # cat "$file" >> /var/www/cdn.example.com/cache/large.css
 serviceName=$(basename $dir)
 file="${dir}/scripts/${1}"
 # echo "CHECK: $file"
 if [ -f "$file" ]
  then
      echo "$serviceName: OK"
      sh $file ${2} ${3}
  # else
      # echo "$serviceName: SKIPPED"
  fi
done
echo "\n"

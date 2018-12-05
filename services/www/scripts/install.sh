#!/bin/bash
#set -x
DIR=$(dirname "$(readlink -f "$0")")
cd $DIR/../webpack
npm install
cd $DIR

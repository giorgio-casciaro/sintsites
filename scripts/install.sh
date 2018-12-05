#!/bin/bash
#set -x
DIR=$(dirname "$(readlink -f "$0")")
cd $DIR/../NPM
git clone --depth 1 git@github.com:giorgio-casciaro/jesus.git
git clone --depth 1 git@github.com:giorgio-casciaro/cqrs.git
git clone --depth 1 git@github.com:giorgio-casciaro/sint-bit-utils.git

# cd $DIR/../NPM/jesus
# npm install
#
# cd $DIR/../NPM/cqrs
# npm install

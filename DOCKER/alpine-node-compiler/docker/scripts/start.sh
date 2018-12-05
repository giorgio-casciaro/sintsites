#!/bin/bash
cd /service/
# rm -r ./node_modules_compiled
mv ./node_modules ./node_modules_original
mv ./node_modules_compiled ./node_modules
export NODE_ENV="production"
export USELUA=1
npm install --production
mv ./node_modules ./node_modules_compiled
mv ./node_modules_original ./node_modules

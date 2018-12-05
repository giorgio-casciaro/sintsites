#/bin/bash
#/
DIR=$(dirname "$(readlink -f "$0")")
cd $DIR/..

# while true; do sleep 120; echo " api.schema.json update "; wget -q https://127.0.0.1/api/getPublicMethodsSchema -O $DIR/../services/www/webpack/src/api.schema.json; done &
# xdg-open https://127.0.0.1/api_static/app/
# xdg-open https://127.0.0.1/api/app/getPublicApiSchema
# xdg-open https://127.0.0.1/api/getPublicMethodsSchema
# xdg-open http://0.0.0.0:8091
# xdg-open http://0.0.0.0:8025
cd webpack
npm run dev
cd ..

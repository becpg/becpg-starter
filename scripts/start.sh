#!/usr/bin/env bash
# Starts beCPG Community, waits until its API answers, then loads the sample data.
set -euo pipefail
cd "$(dirname "$0")/.."

[ -f .env ] || cp .env.example .env
set -a; . ./.env; set +a

REGISTRY="${BECPG_IMAGE_REGISTRY:-becpg-community}"
VERSION="${BECPG_VERSION:-local}"

if ! docker image inspect "$REGISTRY/becpg-test-core:$VERSION" >/dev/null 2>&1 \
   && ! docker pull "$REGISTRY/becpg-test-core:$VERSION" >/dev/null 2>&1; then
  echo "Image $REGISTRY/becpg-test-core:$VERSION not found: building it from the sources."
  ./scripts/build-images.sh
fi

docker compose up -d

URL="${BECPG_URL:-http://localhost:8080/alfresco}"
AUTH="${BECPG_USER:-admin}:${BECPG_PASSWORD:-becpg}"
echo -n "Waiting for beCPG at $URL "
until curl -sf -o /dev/null "$URL/api/-default-/public/alfresco/versions/1/probes/-ready-"; do
  echo -n "."; sleep 10
done
echo " ready."

# Creates the system folders and lists on the first start; does nothing on the next ones.
echo "Initialising the beCPG repository"
curl -sf -o /dev/null -u "$AUTH" "$URL/service/becpg/admin/repository/init-repo" \
  || { echo "The initialisation failed, see: docker compose logs becpg"; exit 1; }

node scripts/seed.mjs

echo
echo "beCPG API : $URL/service/becpg/remote/"
echo "beCPG UI  : http://localhost:${SHARE_PORT:-8180}/share (${BECPG_USER:-admin} / ${BECPG_PASSWORD:-becpg})"
echo "Dashboard : cd app && npm install && npm run dev, then http://localhost:3000"

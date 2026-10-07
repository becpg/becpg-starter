#!/usr/bin/env bash
# Builds the beCPG Community Docker images from the open source repository.
# Needed until prebuilt Community images are published on a public registry.
# Requires git and Docker only: Maven runs in a Java 21 container. Takes 10 to 20 minutes.
set -euo pipefail

REPO_URL="${BECPG_COMMUNITY_REPO:-https://github.com/becpg/becpg-community.git}"
REF="${BECPG_COMMUNITY_REF:-master}"
WORKDIR="${BECPG_BUILD_DIR:-$HOME/.cache/becpg-starter/becpg-community}"
# Local image namespace, kept apart from the official beCPG images.
REGISTRY="${BECPG_IMAGE_REGISTRY:-becpg-community}"

if [ ! -d "$WORKDIR/.git" ]; then
  echo "Cloning $REPO_URL into $WORKDIR"
  git clone --depth 1 --branch "$REF" "$REPO_URL" "$WORKDIR"
else
  echo "Updating $WORKDIR"
  git -C "$WORKDIR" fetch --depth 1 origin "$REF"
  git -C "$WORKDIR" checkout -q FETCH_HEAD
fi

cd "$WORKDIR"
mkdir -p "$HOME/.m2"
mvn() {
  # Runs as root to install git (the build reads its revision), then gives the files back.
  # The sources keep their host path: the generated compose files refer to it.
  docker run --rm -v "$WORKDIR":"$WORKDIR" -v "$HOME/.m2":/m2 -w "$WORKDIR" eclipse-temurin:21-jdk bash -c '
    apt-get -qq update >/dev/null && apt-get -qq install -y git >/dev/null
    git config --global --add safe.directory "$PWD"
    ./mvnw -B -Dmaven.repo.local=/m2/repository "$@"; status=$?
    chown -R '"$(id -u):$(id -g)"' "$PWD" /m2
    exit $status' mvn "$@"
}
mvn clean package -DskipTests -Djacoco.skip=true -Dcheckstyle.skip=true \
  -Dbecpg.dockerbuild.name=test -Ddocker.becpg.url="$REGISTRY"

COMPOSE_FILE=./becpg-integration-runner/target/docker-compose-build.yml
docker compose -f "$COMPOSE_FILE" build becpg-base-core becpg-base-share
docker compose -f "$COMPOSE_FILE" build becpg-test-core becpg-test-share

# Also tag the build as "local", the tag docker-compose.yml uses by default.
JAR=$(ls becpg-integration-runner/target/becpg-integration-runner-*.jar | head -1)
VERSION=$(basename "$JAR" .jar | sed 's/^becpg-integration-runner-//')
docker tag "$REGISTRY/becpg-test-core:$VERSION" "$REGISTRY/becpg-test-core:local"
docker tag "$REGISTRY/becpg-test-share:$VERSION" "$REGISTRY/becpg-test-share:local"
echo
echo "Images built: $REGISTRY/becpg-test-core:$VERSION and $REGISTRY/becpg-test-share:$VERSION (tagged local)"

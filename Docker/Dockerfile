ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION}

# git is not a convenience here: scripts/pull-docs.mjs clones the package
# repositories to collect their documentation, so it is part of the build.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates git \
    && rm -rf /var/lib/apt/lists/*

ARG LOCAL_UID=1000
ARG LOCAL_GID=1000

# The base image ships a `node` account that already holds uid and gid 1000,
# which is exactly what a Linux host hands its first user. Releasing those ids
# lets the developer account claim them, so files this container writes into the
# bind mount belong to you rather than to root.
RUN if id node > /dev/null 2>&1; then userdel --remove node > /dev/null 2>&1 || true; fi \
    && if getent group node > /dev/null 2>&1; then groupdel node || true; fi \
    && groupadd --gid "${LOCAL_GID}" developer \
    && useradd --uid "${LOCAL_UID}" --gid developer --create-home developer

# node_modules is a named volume. Creating it here, owned by the developer,
# means Docker seeds the volume with the right ownership on first run.
RUN mkdir -p /app/node_modules && chown -R developer:developer /app

USER developer

WORKDIR /app

ENV npm_config_update_notifier=false

EXPOSE 3000

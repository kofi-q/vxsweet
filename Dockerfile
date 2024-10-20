# Docker Image for CI

FROM bitnami/minideb:bookworm

# Essentials
RUN apt update && apt install -y --no-install-recommends \
  ca-certificates \
  curl \
  git \
  ssh \
  sudo \
  tar \
  xz-utils \
  zip

# VxSuite transitive deps:
RUN sudo apt update && apt install -y --no-install-recommends \
  build-essential \
  g++ \
  gcc \
  libasound2  \
  libatspi2.0-0 \
  libcairo2-dev \
  libdrm2\
  libgbm1 \
  libgif-dev \
  libglib2.0-bin \
  libgtk-3-0 \
  libjpeg-dev \
  libnotify4 \
  libpango1.0-dev \
  libpcsclite-dev \
  libpcsclite1 \
  libpixman-1-dev \
  libpng-dev \
  libsane \
  libsane-common \
  libsane-hpaio \
  libsane1 \
  libudev-dev \
  libusb-1.0-0-dev \
  libxss1 \
  libxtst6 \
  libzbar-dev \
  linux-kbuild-6.1 \
  make \
  pkg-config \
  poppler-utils \
  python3

# Bazel (via Bazelisk):
ENV BAZELISK_VERSION=1.22.0
ARG TARGETARCH
RUN curl -L -o bazel "https://github.com/bazelbuild/bazelisk/releases/download/v${BAZELISK_VERSION}/bazelisk-linux-${TARGETARCH}" && \
  chmod +x bazel && \
  mv ./bazel /usr/local/bin/bazel && \
  bazel version

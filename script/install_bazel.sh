#!/usr/bin/env bash

set -euo pipefail

if [[ -n $(which bazel) ]] || [[ -n $(which bazelisk) ]]; then
  echo
  echo "💚 Bazel already installed. You're good to go!"
  echo "Get started by running 'bazel run //:dev_env'"
  exit 0
fi

echo
echo "No previous Bazel/Bazelisk installation detected. Checking OS/architecture..."

if [[ $(uname) == "Linux" ]]; then
  BAZELISK_VERSION=1.22.0
  [[ $(uname -m) == "x86_64" ]] && ARCH="amd64" || ARCH="arm64"

  echo "Linux (${ARCH}) detected."

  echo "[Linux] About to install Bazelisk v${BAZELISK_VERSION} for ${ARCH} as /usr/local/bin/bazel..."
  echo "Would you like to continue? [y/N]:"

  read -r answer

  if [[ $answer != 'y' && $answer != 'Y' ]]; then
    echo "👋 Bazel installation aborted. Exiting..."
    exit 0
  fi

  echo "⬇️ [Linux] Installing Bazelisk v${BAZELISK_VERSION} for ${ARCH} as /usr/local/bin/bazel"
  curl -L -o bazel "https://github.com/bazelbuild/bazelisk/releases/download/v${BAZELISK_VERSION}/bazelisk-linux-${ARCH}" &&
    chmod +x bazel &&
    mv ./bazel /usr/local/bin/bazel

  echo
  echo "💚 All done! Get started by running 'bazel run //:dev_env'"
  exit 0
fi

if [[ $(uname) == "Darwin" ]]; then
  echo "MacOS detected."

  if [[ -z $(which brew) ]]; then
    echo "🍎 [MacOS] Homebrew not found. Recommend installing Bazelisk, the \
      version manager for Bazel, via Homebrew ('brew install bazelisk'), or \
      download it directly from the github releases page: \
      https://github.com/bazelbuild/bazelisk/releases"

    exit 1
  fi

  echo "[MacOS] About to install Bazelisk (Bazel version manager) via Homebrew..."
  echo "Would you like to continue? [y/N]:"

  read -r answer

  if [[ $answer != 'y' && $answer != 'Y' ]]; then
    echo "👋 Bazel installation aborted. Exiting..."
    exit 0
  fi

  echo "⬇️ [MacOS] Installing Bazelisk (Bazel version manager) via Homebrew..."
  brew install bazelisk

  echo
  echo "💚 All done! Get started by running 'bazel run //:dev_env'"
  exit 0
fi

echo "🔴 Sorry, this OS is not supported by this quickly-hacked-together script."
echo
echo "You may download Bazelisk manually from the releases page:"
echo "https://github.com/bazelbuild/bazelisk/releases"
exit 1

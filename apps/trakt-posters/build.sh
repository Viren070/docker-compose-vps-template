#!/bin/bash

# Build script for Trakt Posters Stremio Addon

set -e

echo "Building Trakt Posters Docker image..."

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

# Build the Docker image
docker build -t trakt-posters:latest "$DIR"

echo "Build completed successfully!"
echo "Image: trakt-posters:latest"

# Optional: Tag with version if provided
if [ ! -z "$1" ]; then
    echo "Tagging with version: $1"
    docker tag trakt-posters:latest "trakt-posters:$1"
fi

echo "To run the container:"
echo "docker-compose up -d trakt-posters"
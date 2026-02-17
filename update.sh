#!/bin/bash

git pull
go get -u
gofumpt -l -w ../
go mod tidy

(cd ./website && npx npm-check-updates -u && npm i --force)

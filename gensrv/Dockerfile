# syntax=docker/dockerfile:1
FROM golang:1.24-alpine AS compiler
WORKDIR /app
COPY . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build go install .

FROM alpine:latest
COPY --from=compiler /go/bin/gensrv /usr/local/bin/
EXPOSE 8080
ENTRYPOINT [ "gensrv" ]

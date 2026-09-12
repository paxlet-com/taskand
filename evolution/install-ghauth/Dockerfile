# taskand · install-ghauth — sprawdza uwierzytelnienie gh hosta
FROM alpine:3.20
RUN apk add --no-cache github-cli
ENTRYPOINT ["gh", "auth", "status"]

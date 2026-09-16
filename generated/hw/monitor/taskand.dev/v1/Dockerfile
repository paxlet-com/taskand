# Standalone Docker container for proc://taskand.dev/hw/monitor/v1
FROM node:20-alpine

LABEL org.taskand.uri="proc://taskand.dev/hw/monitor/v1"
LABEL org.taskand.organism="hw"
LABEL org.taskand.kind="task"

RUN apk add --no-cache lm-sensors coreutils

WORKDIR /app
COPY package.json bin.mjs proc.yaml test.mjs README.md ./
RUN chmod +x bin.mjs

ENTRYPOINT ["node", "/app/bin.mjs"]

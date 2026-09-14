FROM python:3.12-alpine@sha256:b64631e04e4920160c50fbe8d8df828f7f35f06f425cb44aa09bca53e708a35a

# Network/package resolution happens at build time, never at gateway startup.
RUN apk add --no-cache nodejs \
    && addgroup -g 10001 taskand \
    && adduser -D -u 10001 -G taskand taskand \
    && mkdir -p /taskand/log \
    && chown 10001:10001 /taskand/log

WORKDIR /taskand
COPY gateway.py /app/server.py
COPY gateway/ /app/gateway/
COPY generated/ /taskand/generated/

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TASKAND_BIND=0.0.0.0 PORT=8077
USER 10001:10001
EXPOSE 8077
ENTRYPOINT ["python3", "/app/server.py"]

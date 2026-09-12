# taskand · install-answers — answers.yaml pisze proces, nie skrypt hosta
FROM alpine:3.20
WORKDIR /taskand
COPY <<'W' /entry.sh
#!/bin/sh
cat > /taskand/answers/taskand.answers.yaml <<'A'
# taskand · answers · bootstrap v0.4
cel: ci-cd
org: semcod
limit_wersji: 4
llm: tak
A
cat /taskand/answers/taskand.answers.yaml
W
RUN chmod +x /entry.sh
ENTRYPOINT ["/entry.sh"]

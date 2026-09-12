FROM fedora:40
RUN dnf install -y openssh-server docker-cli nodejs git curl make procps-ng && dnf clean all
RUN mkdir -p /root/.ssh && chmod 700 /root/.ssh && ssh-keygen -A
RUN useradd -m -s /bin/bash taskand && mkdir -p /home/taskand/.ssh
COPY ./authorized_keys /home/taskand/.ssh/
RUN chmod 600 /home/taskand/.ssh/authorized_keys && chown -R taskand:taskand /home/taskand
RUN mkdir -p /opt/taskand && chown taskand:taskand /opt/taskand
EXPOSE 22
CMD ["/usr/sbin/sshd", "-D"]

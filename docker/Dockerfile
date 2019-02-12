FROM ubuntu:16.04
MAINTAINER Xiaoming Wang <xiaoming.wang@lexisnexis.com>
RUN rm -rf /var/lib/apt/lists/*
RUN apt-get clean
RUN apt-get update
RUN apt-get install -y curl git openssh-server openssh-client net-tools
RUN apt-get install -y python-dev python3.5-dev python3-pip apt-utils --fix-missing
RUN pip3 install jupyter

RUN curl -sL https://deb.nodesource.com/setup_8.x | bash -
RUN apt-get install -y nodejs

RUN whoami

#RUN yes Y | ssh-keygen -q -t rsa -N '' -f ~/.ssh/id_rsa

RUN mkdir ~/.npm-global
RUN npm config set prefix '~/.npm-global'
RUN npm config set unsafe-perm true
RUN echo "export PATH=~/.npm-global/bin:\$PATH" >> ~/.profile

RUN npm install -g itsecl

RUN mkdir -p ~/Jupyter
RUN cd ~/Jupyter

RUN ~/.npm-global/bin/itsecl --ts-install=global
EXPOSE 8010 8002 8015 9876

#CMD ["jupyter", "notebook", "--no-browser", "--allow-root"]


RUN mkdir -p /var/run/sshd
CMD ["bash", "-c", "sudo /usr/sbin/sshd -D"]

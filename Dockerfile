# flint
# https://github.com/nmarus/flint
# Nicholas Marus <nmarus@gmail.com>

FROM node:latest
MAINTAINER Nicholas Marus <nmarus@gmail.com>

# Setup APT
RUN echo 'debconf debconf/frontend select Noninteractive' | debconf-set-selections

# Update, Install Prerequisites, Clean Up APT
RUN DEBIAN_FRONTEND=noninteractive apt-get -y update && \
  apt-get -y install apt-utils software-properties-common && \
  apt-get -y install git curl vim && \
  rm -rf /var/lib/apt/lists/*

# Install npm globals
RUN npm install nodemon -g

# Setup app folder
COPY /app /app
WORKDIR /app
RUN find /app -type f -exec chmod 666 {} +
RUN find /app -type d -exec chmod 777 {} +

# install dependencies
RUN npm install

# Run node app
CMD DEBUG=* nodemon index.js

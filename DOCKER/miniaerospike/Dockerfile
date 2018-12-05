FROM blitznote/debootstrap-amd64:16.10
# RUN  mkdir /aerospike
# COPY ./aerospike /aerospike
# WORKDIR /aerospike/aerospike-server

ENV AEROSPIKE_VERSION 3.12.1
ENV AEROSPIKE_SHA256 16ceb0d131892c3caab31ee031f7e37d7a611c22686fec2692facde87ac69a00

RUN \
  apt-get update -y \
  && apt-get install -y ca-certificates  wget python python-argparse python-bcrypt python-openssl logrotate net-tools iproute2 iputils-ping \
  && wget "https://www.aerospike.com/artifacts/aerospike-server-community/${AEROSPIKE_VERSION}/aerospike-server-community-${AEROSPIKE_VERSION}-ubuntu16.04.tgz" -O aerospike-server.tgz --no-check-certificate \
  && echo "$AEROSPIKE_SHA256 *aerospike-server.tgz" | sha256sum -c - \
  && mkdir aerospike \
  && tar xzf aerospike-server.tgz --strip-components=1 -C aerospike \
  && dpkg -i aerospike/aerospike-server-*.deb \
  && dpkg -i aerospike/aerospike-tools-*.deb \
  && mkdir -p /var/log/aerospike/ \
  && mkdir -p /var/run/aerospike/ \
  && rm -rf aerospike-server.tgz aerospike /var/lib/apt/lists/* \
  && dpkg -r wget \
  && dpkg --purge wget \
  && apt-get autoremove -y \
  && apt-get purge -y

  # Execute the run script in foreground mode
  COPY ./scripts /scripts
  ENTRYPOINT ["/scripts/start.sh"]
  CMD ["asd"]

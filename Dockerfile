# Pin ES; override with --build-arg ES_VERSION=...
ARG ES_VERSION=9.2.1
FROM docker.elastic.co/elasticsearch/elasticsearch:${ES_VERSION}

# Optional plugins (toggle at build time)
ARG INSTALL_ICU=true
ARG INSTALL_INGEST_ATTACHMENT=false
RUN if [ "$INSTALL_ICU" = "true" ]; then elasticsearch-plugin install --batch analysis-icu; fi && \
    if [ "$INSTALL_INGEST_ATTACHMENT" = "true" ]; then elasticsearch-plugin install --batch ingest-attachment; fi

# Config (dev defaults live in your repo)
COPY config/elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml

# Healthcheck script needs root to write into /usr/local/bin
USER root
COPY docker/healthcheck.sh /usr/local/bin/healthcheck.sh
RUN chmod 0755 /usr/local/bin/healthcheck.sh
USER elasticsearch

EXPOSE 9200
HEALTHCHECK --interval=10s --timeout=2s --retries=12 CMD /usr/local/bin/healthcheck.sh
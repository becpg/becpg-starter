# Alfresco Search Services with the beCPG index settings.
# The entrypoint edits these files in place, so they are copied, not mounted.
FROM alfresco/alfresco-search-services:2.0.17

ENV DIST_DIR=/opt/alfresco-search-services

COPY --chown=solr:solr solrcore.properties solrconfig.xml $DIST_DIR/solrhome/templates/rerank/conf/
COPY --chown=solr:solr shared.properties $DIST_DIR/solrhome/conf/

# Grafana Setup

This document explains the Grafana configuration for monitoring search and embedding metrics.

## File Structure

```
grafana/
└── provisioning/
    ├── datasources/
    │   └── postgres.yml       # TimescaleDB connection config
    └── dashboards/
        ├── dashboards.yml     # Dashboard provider config
        └── metrics.json       # Search & Embedding Metrics dashboard
```

## Files

### `datasources/postgres.yml`
Configures the TimescaleDB (PostgreSQL) datasource.

- **UID**: `postgres` - referenced by all dashboard panels
- **Database**: `medusa_hovedopgave`
- **Default**: Set as the default datasource
- **Auto-provisioned**: Loads on Grafana startup

### `dashboards/dashboards.yml`
Tells Grafana where to find dashboard JSON files.

- **Path**: `/etc/grafana/provisioning/dashboards`
- **Updates**: Checks for changes every 30 seconds

### `dashboards/metrics.json`
Dashboard definition with 5 panels:

1. **Search Volume** - Time-series graph of search counts
2. **Avg Search Duration** - Average query latency (24h)
3. **Embedding Success Rate** - Percentage of successful embeddings (24h)
4. **Search Duration Breakdown** - Embedding vs Elasticsearch query times
5. **Top Search Queries** - Most frequently searched terms (24h)

## Docker Setup

```yaml
grafana:
  image: grafana/grafana:latest
  ports:
    - "3000:3000"
  volumes:
    - grafana-data:/var/lib/grafana
    - ./grafana/provisioning:/etc/grafana/provisioning
```

The volume mount at `/etc/grafana/provisioning` auto-loads datasources and dashboards.

## Access

- **URL**: http://localhost:3000
- **Login**: admin / admin
- **Location**: Dashboards → Search & Embedding Metrics

## Adding New Dashboards

1. Create dashboard in Grafana UI
2. Export as JSON (Share → Export)
3. Set `"id": null` and unique `"uid"`
4. Save to `grafana/provisioning/dashboards/`
5. Restart: `docker compose restart grafana`

## Troubleshooting

**Tables have no data**: Generate search activity via `/admin/embeddings/search` or `/store/search` endpoints.
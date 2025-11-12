# `docs/local-elasticsearch.md`

```md
# Elasticsearch – Local Dev

Single-node Elasticsearch with optional plugins for product indexing and vector search. Works on macOS/Windows with Docker Desktop.

---

## Prereqs

- **Docker Desktop** installed and running.
- Set Linux kernel `vm.max_map_count` **inside** Docker Desktop’s VM/WSL before starting ES:
  make es-host-sysctl
  ```
-(Our Makefile does the platform-specific work for macOS/Windows. You don’t run sudo on your host.)

### Build & Run

# Build the custom image (pins ES version by default)
make es-build

# Start ES (automatically applies vm.max_map_count in Docker Desktop VM/WSL)
make es-up

# Check cluster health from host
make es-health

# Follow logs
make es-logs

# Stop & remove the container (data persists in "esdata" volume)
make es-down

### Verify manually


- curl http://localhost:9200
- curl 'http://localhost:9200/_cluster/health?pretty'


## Using docker-compose (with Postgres)

We ship docker-compose.yml that includes **Postgres** and **Elasticsearch**. To start both:
```bash
# Ensure kernel prereq is set in Docker Desktop VM/WSL
make es-host-sysctl

# Bring up services
docker compose up -d postgres elasticsearch
```

Optional Make targets:

```bash
make compose-up     # calls es-host-sysctl then docker compose up -d postgres elasticsearch
make compose-down   # docker compose down
```

### Quick reference

```bash
make es-build        # build the ES image
make es-up           # set vm.max_map_count in Docker Desktop VM/WSL, then start ES
make es-health       # check health from host
make es-logs         # follow ES logs
make es-down         # stop & remove container (data remains in "esdata")

# compose (if you added the helpers)
make compose-up
make compose-down
```
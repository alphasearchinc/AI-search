# -------- Config --------
ES_IMG  ?= search/elasticsearch:9.2-local
ES_NAME ?= es-local
ES_PORT ?= 9200
ES_HEAP ?= 1g

# Detect OS (Darwin / Windows_NT / Linux)
OS ?= $(shell uname -s)

# -------- Targets --------
.PHONY: es-build es-up es-down es-logs es-health es-status es-host-sysctl es-wsl-persist

es-build:
	docker build -t $(ES_IMG) .

# Ensure vm.max_map_count is set in Docker Desktop VM/WSL2 before starting ES
es-up: es-host-sysctl
	docker run -d --name $(ES_NAME) \
		-p $(ES_PORT):9200 \
		-e ES_JAVA_OPTS="-Xms$(ES_HEAP) -Xmx$(ES_HEAP)" \
		-e bootstrap.memory_lock=true \
		--ulimit memlock=-1:-1 \
		-v esdata:/usr/share/elasticsearch/data \
		$(ES_IMG)

es-down:
	-@docker rm -f $(ES_NAME)

es-logs:
	docker logs -f $(ES_NAME)

es-health:
	curl -fsS "http://localhost:$(ES_PORT)/_cluster/health?wait_for_status=yellow&pretty" || true

# Show container health status if HEALTHCHECK is defined in the image
es-status:
	@docker inspect --format='{{.Name}} -> {{index .State "Health"}}' $(ES_NAME) 2>/dev/null || \
	echo "$(ES_NAME) not running"

# -------- Host prerequisites (Docker Desktop VM / WSL2) --------
# Sets vm.max_map_count=262144 where ES actually runs.
es-host-sysctl:
ifeq ($(OS),Darwin)
	@echo ">> macOS: setting vm.max_map_count inside Docker Desktop VM…"
	@docker run --rm --privileged --pid=host justincormack/nsenter1 /sbin/sysctl -w vm.max_map_count=262144
	@docker run --rm --privileged --pid=host justincormack/nsenter1 /sbin/sysctl vm.max_map_count
	@echo ">> Done."
else ifeq ($(OS),Windows_NT)
	@echo ">> Windows: setting vm.max_map_count inside WSL2 docker-desktop…"
	@powershell -NoProfile -Command ^
	  "wsl -d docker-desktop -u root -- sh -lc 'sysctl -w vm.max_map_count=262144 && sysctl vm.max_map_count'"
	@echo ">> Done. (To persist, run: make es-wsl-persist)"
else
	@echo ">> Linux host detected."
	@echo "   Run once (requires sudo): sudo sysctl -w vm.max_map_count=262144"
	@echo "   Persist via /etc/sysctl.conf: vm.max_map_count=262144"
endif

# Optional helper (Windows): make it persistent in docker-desktop WSL2 if supported
es-wsl-persist:
ifeq ($(OS),Windows_NT)
	@echo ">> Windows: adding vm.max_map_count to /etc/sysctl.conf in docker-desktop…"
	@powershell -NoProfile -Command ^
	  "wsl -d docker-desktop -u root -- sh -lc \"grep -q 'vm.max_map_count' /etc/sysctl.conf || echo 'vm.max_map_count=262144' >> /etc/sysctl.conf\""
	@echo ">> Done. You may need 'wsl --shutdown' for it to apply on next start."
else
	@echo "es-wsl-persist is Windows-only."
endif

compose-up: es-host-sysctl
	docker compose up -d postgres elasticsearch redis

compose-down:
	docker compose down
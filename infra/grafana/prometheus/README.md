# Prometheus stack for Grafana VM (backend VM monitoring)

Use this compose + config on the Grafana VM to scrape the backend VM exporters.

## Steps
1) Set the backend VM IP in `prometheus.yml` (replace `<BACKEND_VM_IP>`). Keep the exporter ports (`9100`, `9121`, `9114`) as-is unless you changed them in Ansible.
2) From this directory on the Grafana VM, run:
   ```bash
   docker compose up -d
   ```
3) Open Prometheus UI at `http://<grafana-vm-ip>:9090` and verify all targets are `UP`.
4) In Grafana, add a Prometheus datasource pointing to `http://localhost:9090` (or the Prometheus host/port you choose).
5) Import dashboards for node_exporter, redis_exporter, and elasticsearch_exporter. Build a “Backend VM Health” dashboard that uses this datasource.
6) Configure Grafana alerting (email/Teams) using these metrics. Start with node down, high CPU, disk nearly full, and exporter-down alerts.

## Ports
- Prometheus: 9090 (host-published)
- node_exporter (backend VM): 9100
- redis_exporter (backend VM): 9121
- elasticsearch_exporter (backend VM): 9114

Ensure your backend VM NSG/firewall allows the Grafana VM to reach 9100/9121/9114 and blocks public access.

# Ansible – Medusa Stack Provisioning

This document explains the Ansible setup under `infra/ansible` that provisions a VM and deploys the Medusa + Elasticsearch + Redis stack via Docker Compose.

---

## Structure

```text
infra/
└── ansible/
    ├── ansible.cfg          # Local Ansible config (inventory, defaults)
    ├── inventory.ini        # Hosts (group: medusa)
    ├── group_vars/
    │   └── all.yml          # Shared variables (image, ports, env)
    └── roles/
        ├── common/          # Base OS prep
        │   └── tasks/main.yml
        ├── docker/          # Docker + Compose install
        │   └── tasks/main.yml
        └── medusa_stack/    # Medusa + infra deployment
            ├── tasks/main.yml
            └── templates/
                ├── docker-compose.yml.j2
                └── medusa.env.j2
```

The entrypoint playbook is `infra/ansible/site.yml`.

---

## What the Playbook Does

`site.yml` runs three roles against the `medusa` host group:

```yaml
- name: Provision Medusa hybrid search VM
  hosts: medusa
  become: true
  roles:
    - common
    - docker
    - medusa_stack
```

### Role: `common`

File: `infra/ansible/roles/common/tasks/main.yml`

- Updates the apt cache and performs a safe upgrade.
- Installs baseline tools: `curl`, `git`, `ca-certificates`, `htop`.

This gives the VM a clean, patched base with standard troubleshooting tools.

### Role: `docker`

File: `infra/ansible/roles/docker/tasks/main.yml`

- Enables Ubuntu `universe` and `multiverse` repositories.
- Installs `docker.io` from the Ubuntu repos.
- Ensures the Docker service is enabled and running.
- Creates `/usr/lib/docker/cli-plugins` and installs Docker Compose v2 as a CLI plugin (`docker compose`).
- Adds the current Ansible user (default `aleksander`) to the `docker` group so Docker can be used without `sudo`.

After this role, the VM can run `docker` and `docker compose` commands, which the Medusa stack role depends on.

### Role: `medusa_stack`

File: `infra/ansible/roles/medusa_stack/tasks/main.yml`

- Creates the project root directory (default: `/opt/medusa`).
- Creates data directories under `{{ medusa_project_root }}/data` for:
  - `elasticsearch`
  - `redis`
  - `medusa`
- Templates:
  - `docker-compose.yml` from `templates/docker-compose.yml.j2`
  - `.env` from `templates/medusa.env.j2`
- Runs:
  - `docker compose pull` to fetch the latest images.
  - `docker compose up -d` to start the stack.

The Docker Compose template defines three services:

- `elasticsearch`: single-node ES with configurable heap via `es_heap`.
- `redis`: Redis 7 with AOF persistence.
- `medusa`: Your Medusa backend image from GHCR, using the templated `.env`.

---

## Configuration

### Inventory

File: `infra/ansible/inventory.ini`

```ini
[medusa]
4.235.109.136 ansible_user=aleksander ansible_ssh_private_key_file=~/.ssh/id_rsa
```

- Group name: `medusa` (referenced by `site.yml`).
- Replace the IP, user, and SSH key path with your own VM details when needed.

### Ansible Defaults

File: `infra/ansible/ansible.cfg`

```ini
[defaults]
inventory = ./inventory.ini
remote_user = aleksander
host_key_checking = False
interpreter_python = auto_silent
```

When you `cd infra/ansible`, Ansible will automatically pick up this config, so you can just run `ansible-playbook site.yml`.

### Shared Variables

File: `infra/ansible/group_vars/all.yml`

Key variables:

- `medusa_project_root`: Where the stack lives on the VM (default `/opt/medusa`).
- `medusa_image`: GHCR image for the Medusa backend, e.g. `ghcr.io/<org>/<repo>`.
- `medusa_image_tag`: Image tag (e.g. `latest`, `main`, or a specific version).
- `medusa_port`: Host port for the Medusa container (default `9000`).
- `es_heap`: Elasticsearch heap size (e.g. `"512m"`).
- `medusa_database_url`: Full Postgres connection string.
- `medusa_redis_url`: Redis URL used by Medusa/worker.
- `node_env`: Typically `"production"` on the VM.

These values are rendered into:

- `docker-compose.yml` (`medusa_image`, `medusa_image_tag`, `medusa_port`, `es_heap`)
- `.env` (`DATABASE_URL`, `REDIS_URL`, `NODE_ENV`, plus any extra Medusa envs you add).

> Note: `medusa_database_url` and other secrets should be moved into Ansible Vault later; they’re plain-text placeholders for now.

---

## How to Run It

From the repo root:

```bash
cd infra/ansible

# Optional dry-run (no changes)
ansible-playbook site.yml --check

# Actual provisioning + deployment
ansible-playbook site.yml
```

What happens when you run the playbook:

1. The VM is updated and basic tools are installed (`common`).
2. Docker and Docker Compose v2 are installed and configured (`docker`).
3. The Medusa project folder and data directories are created (`medusa_stack`).
4. `docker-compose.yml` and `.env` are rendered from templates.
5. `docker compose pull && docker compose up -d` is executed to deploy/start the stack.

The playbook is idempotent: you can rerun it to upgrade images, apply new env vars, or re-create the stack after changes.

---

## Typical Workflow

- **First-time setup**
  - Update `infra/ansible/inventory.ini` with your VM IP and SSH key.
  - Set `medusa_image`, `medusa_image_tag`, and env vars in `group_vars/all.yml`.
  - Run `ansible-playbook site.yml` from `infra/ansible`.

- **Deploy a new backend version**
  - Build and push a new GHCR image.
  - Update `medusa_image_tag` (or the image name) in `group_vars/all.yml`.
  - Rerun `ansible-playbook site.yml` to pull and restart the stack.

- **Change infra configuration**
  - Adjust `es_heap`, `medusa_port`, or secrets in `group_vars/all.yml`.
  - Rerun the playbook; it will re-template configs and restart containers as needed.

This gives a repeatable, documented way to stand up the Medusa hybrid search stack on a remote VM using Ansible.


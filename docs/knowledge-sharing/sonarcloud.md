# SonarCloud in Our Monorepo — Setup & How It Works

**Scope:** Medusa admin backend (`my-medusa-store`), Next.js storefront (`my-medusa-store-storefront`), and (later) Python embedder (`python`) under one GitHub repo.  
**Goal:** Automated static analysis on every push/PR with PR decoration and a quality gate, using the free SonarCloud plan.

---

## What SonarCloud Gives Us

- **PR decoration:** inline comments + “Quality Gate” check on pull requests.  
- **Static analysis:** bugs, code smells, security hotspots, duplication.  
- **Monorepo aware:** separate projects per subfolder, one repo.  
- **No tests required initially:** coverage can be excluded and added later.

---

## Project Mapping (Monorepo)

We created **three** SonarCloud projects, each pointing to a subdirectory:

| Repo subfolder               | SonarCloud projectKey | SonarCloud projectName |
|---|---|---|
| `my-medusa-store`            | `admin-api-backend`   | `admin-api-backend`    |
| `my-medusa-store-storefront` | `medusa-storefront`   | `medusa-storefront`    |
| `python` (later)             | `embedder`            | `embedder`             |

> The subfolder is wired at scan time via `projectBaseDir`, **not** by the project key/name.

---

## Prerequisites

1. **SonarCloud org key:** `alphasearchinc` (replace if your org key differs).  
2. **GitHub App installed:** GitHub → Marketplace → **SonarQube Cloud** → *Install* (select this repository).  
3. **Repo secret:** `SONAR_TOKEN` created in SonarCloud (*Account → Security*) by a user who is a **member** of `alphasearchinc`.  
4. **Projects in SonarCloud:** `admin-api-backend`, `medusa-storefront`, `embedder` (last one can wait until `python/` exists).  
5. **PR decoration binding (recommended):** In each SonarCloud project → *Administration → Pull Request Decoration*:  
   - Provider: **GitHub**  
   - Repository: `<owner>/<repo>`  
   - **Base directory**: the subfolder (e.g., `my-medusa-store`)

---

## GitHub Actions Workflow

**File:** `.github/workflows/ci-sonarcloud.yml`  
This variant runs **analysis only** (no installs, no tests). Adjust the org key if needed.

```yaml
name: SonarCloud

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

permissions:
  contents: read
  pull-requests: write

concurrency:
  group: ci-sonarcloud-${{ github.ref }}
  cancel-in-progress: true

jobs:
  analyze:
    name: Analyze ${{ matrix.name }}
    runs-on: ubuntu-latest
    # Skip matrix item when its directory doesn't exist (e.g., 'python' not yet created)
    if: ${{ hashFiles(format('{0}/**', matrix.path)) != '' }}

    strategy:
      fail-fast: false
      matrix:
        include:
          - name: admin-api-backend
            path: my-medusa-store
            language: node
            sonar_project_key: admin-api-backend
            sonar_project_name: admin-api-backend
          - name: medusa-storefront
            path: my-medusa-store-storefront
            language: node
            sonar_project_key: medusa-storefront
            sonar_project_name: medusa-storefront
          - name: embedder
            path: python
            language: python
            sonar_project_key: embedder
            sonar_project_name: embedder

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # required for reliable PR decoration

      - name: Setup Java (Sonar scanner requirement)
        uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: '17'

      - name: SonarCloud Scan
        uses: SonarSource/sonarcloud-github-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}
        with:
          projectBaseDir: ${{ matrix.path }}
          args: >
            -Dsonar.organization=alphasearchinc
            -Dsonar.projectKey=${{ matrix.sonar_project_key }}
            -Dsonar.projectName=${{ matrix.sonar_project_name }}
            -Dsonar.sources=.
            -Dsonar.exclusions=**/node_modules/**,**/.next/**,**/dist/**,**/build/**,**/__pycache__/**
            -Dsonar.coverage.exclusions=**/*   # remove when tests/coverage are added
## Why this setup?

- **Matrix** runs one scan per subfolder → clean separation of results per app.  
- **`projectBaseDir`** ties each scan to its subdirectory.  
- **No tests required** right now. We’ll enable coverage later when tests exist.

---

## Adding Coverage Later (Recommended)

Once tests exist, remove the blanket coverage exclusion and output coverage where Sonar expects:

### Node / TypeScript (Medusa + Next.js)
- Use Jest or Vitest to emit `coverage/lcov.info`.
- Add: -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info


### Python (Flask embedder)
- Use: pytest --cov . --cov-report=xml:coverage.xml
- Add: -Dsonar.python.coverage.reportPaths=coverage.xml


---

## Optional: Project Files for Cleaner Config

Add `sonar-project.properties` in each subfolder so the YAML stays minimal.

### `my-medusa-store/sonar-project.properties` (similar for storefront)
```properties
sonar.organization=alphasearchinc
sonar.projectKey=admin-api-backend
sonar.projectName=admin-api-backend

sonar.sources=.
sonar.exclusions=**/node_modules/**,**/dist/**,**/build/**

# When tests exist:
# sonar.javascript.lcov.reportPaths=coverage/lcov.info

# Stronger TS rules (optional):
sonar.javascript.tsconfigPaths=tsconfig.json


sonar.organization=alphasearchinc
sonar.projectKey=embedder
sonar.projectName=embedder

sonar.sources=.
sonar.exclusions=**/__pycache__/**,**/build/**,**/dist/**

# When tests exist:
# sonar.python.coverage.reportPaths=coverage.xml



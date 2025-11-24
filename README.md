![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/alphasearchinc/AI-search?utm_source=oss&utm_medium=github&utm_campaign=alphasearchinc%2FAI-search&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)


## Local Search Stack (Elasticsearch)

Reproducible Elasticsearch for indexing + kNN testing.

**Quick start**
```bash
make es-build && make es-up && make es-health
````

- Data persists in the esdata volume.

- If Docker Desktop updated and ES fails to start, re-run make es-up (it reapplies vm.max_map_count).


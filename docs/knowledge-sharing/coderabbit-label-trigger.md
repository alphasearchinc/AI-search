# CodeRabbit – Label-Based & Incremental Reviews

Configure CodeRabbit so it **only runs reviews on pull requests that have a specific label**, and continues reviewing automatically whenever new commits are pushed.  
This prevents unwanted reviews on every PR while still giving continuous feedback when desired.

---

## Why we changed this

Previously, CodeRabbit ran on every pull request or minor change, which caused:

- Long-running reviews on small updates  
- Noise and delays in workflow  
- Reviews running even when not needed  

We fixed this by requiring a **label** to start reviews, and enabling **incremental reviews** only after that label is present.

---

## Final `.coderabbit.yml` configuration

```yml
language: "en-US"

reviews:
  auto_review:
    enabled: true
    auto_incremental_review: true
    base_branches:
      - dev
    labels:
      - "coderabbit-review"

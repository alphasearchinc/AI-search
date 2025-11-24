# CodeRabbit – Label-Triggered Reviews

Configure CodeRabbit so it **only runs code reviews when a specific label is added** to a pull request.  
Prevents CodeRabbit from scanning every tiny change and reduces noise in the workflow.

---

## Why we changed this

By default, CodeRabbit reviews **every PR automatically**, which caused issues:

- Reviews triggered on very small changes.
- Long-running checks slowed down workflow.
- Noise on pull requests targeting `dev`.

To fix this, we configured CodeRabbit to run **only when we explicitly request it** using a label.

---

## Final `.coderabbit.yml` configuration

```yml
language: "en-US"

reviews:
  review_status: true
  commit_status: true

  auto_review:
    enabled: true
    auto_incremental_review: false
    base_branches:
      - dev
    labels:
      - "coderabbit-review"

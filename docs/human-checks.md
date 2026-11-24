# Human Evaluation Checks

<!-- DOC_META: status=ready version=2 -->

`HUMAN_CHECK:` marks text that a human must verify or replace before the final
evaluation. It is intentionally plain text so it works in Markdown, source,
configuration, and comments.

```console
git grep -n 'HUMAN_CHECK:'
```

## Open checks

| ID | Owner | Required action |
| --- | --- | --- |
| `README_TEAM` | Project Manager | Replace team rows with real people, roles, and responsibilities. |
| `README_PROJECT_PROCESS` | Project Manager | Document meeting cadence, communication, and review process. |
| `README_MODULES` | Product Owner + Technical Lead | List only tested, demonstrable modules and contributors. |
| `PRIVACY_EFFECTIVE_DATE` | Product Owner | Verify the supplied local-demo policy effective date. |
| `PRIVACY_RETENTION_AND_HOSTING` | Product Owner | Verify local hosting and approve a concrete retention/deletion schedule. |
| `PRIVACY_CONTACT` | Product Owner | Verify the supplied contact mailbox is monitored. |
| `TERMS_EFFECTIVE_DATE` | Product Owner | Verify the supplied local-demo terms effective date. |
| `TERMS_CONTACT` | Product Owner | Verify the supplied contact mailbox is monitored. |

Remove a marker and its row only after the named owner has verified it.

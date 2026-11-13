# Human Evaluation Checks

<!-- DOC_META: status=ready version=1 -->

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
| `PRIVACY_EFFECTIVE_DATE` | Product Owner | Set the policy effective date at release. |
| `PRIVACY_RETENTION_AND_HOSTING` | Product Owner | State the actual hosting location and retention/deletion policy. |
| `PRIVACY_CONTACT` | Product Owner | Add a working contact address. |
| `TERMS_EFFECTIVE_DATE` | Product Owner | Set the terms effective date at release. |
| `TERMS_CONTACT` | Product Owner | Add a working contact address. |

Remove a marker and its row only after the named owner has verified it.

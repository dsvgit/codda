# Метки триажа

Скиллы говорят о пяти канонических ролях триажа. В локальном трекере метка — это значение строки `**Status:**` тикета (см. `docs/agents/issue-tracker.md`). Названия совпадают с каноническими.

| Метка в mattpocock/skills | Значение `Status:` у нас | Смысл |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | Человеку нужно оценить тикет |
| `needs-info` | `needs-info` | Ждём уточнений от автора тикета |
| `ready-for-agent` | `ready-for-agent` | Полностью описан, агент может брать |
| `ready-for-human` | `ready-for-human` | Нужен человек |
| `wontfix` | `wontfix` | Делать не будем |

Сверх ролей триажа тикет проходит `in-progress` и `done`.

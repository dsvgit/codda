# Собственный браузерный Runtime вместо Sandpack/CodeSandbox

Мы исполняем код студента на собственном Runtime (CodeMirror 6 → Web Worker с esbuild-wasm → sandboxed iframe → Test Harness), а не через Sandpack. Sandpack по умолчанию опирается на bundler и npm-резолвинг CodeSandbox, а требование полностью внутренней инфраструктуры (ADR-0002) делает эту зависимость неприемлемой; self-host bundler'а Sandpack сложнее и менее контролируем, чем узкий Runtime под наши задачи.

## Considered Options

- **Sandpack (hosted)** — отвергнут: внешний сервис в критическом пути.
- **Sandpack с self-hosted bundler** — отвергнут: тащит чужую архитектуру целиком, тяжело аудировать.
- **WebContainers / Node в браузере** — отвергнут для MVP: лицензирование, вес, не нужен Node.
- **Server-side execution (Judge0 и т.п.)** — отложен, см. ADR-0004.

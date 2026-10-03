# Код студента исполняется в iframe sandbox="allow-scripts" без allow-same-origin

Скомпилированный код студента и Lesson Tests исполняются в `<iframe sandbox="allow-scripts">` с opaque origin; parent и Sandbox общаются только через `postMessage`, parent проверяет форму каждого сообщения. Комбинация `allow-scripts` + `allow-same-origin` позволила бы коду снять sandbox и добраться до parent, cookies и storage — поэтому `allow-same-origin` запрещён, даже если без него что-то неудобно (например, модульные скрипты с parent origin требуют CORS).

## Consequences

- Код в Sandbox доставляется через `srcdoc` или blob, Dependency Artifacts — либо вшиваются в бандл Compiler'ом, либо отдаются с `Access-Control-Allow-Origin`.
- Это не полная security-модель: CSP, отдельный origin для Sandbox, лимиты ресурсов — отдельный этап (см. roadmap, блок Security).

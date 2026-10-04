# Код студента исполняется в iframe sandbox="allow-scripts" без allow-same-origin

Скомпилированный код студента и Lesson Tests исполняются в `<iframe sandbox="allow-scripts">` с opaque origin; parent и Sandbox общаются только через `postMessage`, parent проверяет форму каждого сообщения. Комбинация `allow-scripts` + `allow-same-origin` позволила бы коду снять sandbox и добраться до parent, cookies и storage — поэтому `allow-same-origin` запрещён, даже если без него что-то неудобно (например, модульные скрипты с parent origin требуют CORS).

## Consequences

- Код в Sandbox доставляется через `srcdoc` или blob, Dependency Artifacts — либо вшиваются в бандл Compiler'ом, либо отдаются с `Access-Control-Allow-Origin`.
- Это не полная security-модель: CSP, отдельный origin для Sandbox, лимиты ресурсов — отдельный этап (см. roadmap, блок Security).
- Opaque origin не закрывает Sandbox от сети (найдено в PoC, см. [PoC Report, R2](../poc-report.md#что-обязательно-решить-в-mvp)): `fetch` уходит наружу с `Origin: null`, CORS отрезает только чтение ответа, а `mode: "no-cors"` проходит. Закрывает это CSP `connect-src` или отдельный origin, а не sandbox-атрибуты.
- Типы сообщений Sandbox → parent в MVP: `codda:report` (Test Report) и `codda:console` (строка Console). Runner проверяет `event.source`, `runId` и форму полей, остальное игнорирует (фича `runtime-hardening`). Канал — `MessagePort`: Sandbox передаёт порт первым сообщением `codda:port`, у него проверяются `event.source` и `runId`; `codda:report` и `codda:console` идут через порт. Причина: Chrome не доставляет `window.postMessage` от iframe, пока тот крутит синхронный цикл, и console до timeout терялась. Доверие то же: порт есть только у кода внутри Sandbox, как раньше `window.parent` (решение человека, 2026-10-04).

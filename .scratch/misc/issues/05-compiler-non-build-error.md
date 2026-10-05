# 05: «Внутренняя ошибка» `errors.map` вместо настоящей ошибки esbuild

**What to build:** Если `esbuild.build()` отклоняется не `BuildFailure`, а обычным `Error`, студент должен увидеть настоящую причину в «Внутренней ошибке», а не `TypeError` нашего же кода.

Сейчас `catch` в `packages/codda/src/runtime/compiler.worker.ts:155-170` считает любую ошибку `BuildFailure` и вызывает `errors.map(...)`. У обычного `Error` поля `errors` нет, поэтому `errors.map` бросает `TypeError`. Его ловит `onmessage` Worker'а и отправляет как `error`, а `compiler.ts` уничтожает Worker. В итоге `runner.ts:57` даёт `internal-error`, и вкладка «Тесты» показывает:

```
Внутренняя ошибка
undefined is not an object (evaluating 'errors.map')
Запустите тесты ещё раз.
```

Обычный `Error` из `esbuild-wasm` 0.28.2 (`lib/browser.js`) бывает в двух случаях. Первый — wasm-процесс esbuild завершился: `"The service was stopped: …"` / `"The service is no longer running"`. Это паника Go или нехватка памяти wasm. Второй — ошибка в опциях `build()`, но у нас они одинаковые на каждый Run. Вероятная причина в нашем случае — первая, см. [тикет 06](06-safari-wasm-worker-leak.md).

Как встретили (2026-10-05, человек): `npm run dev`, Safari. Текст ошибки в формате JavaScriptCore, а имя `errors` не минифицировано, значит, код не из `dist-tool/`. Стабильного сценария воспроизведения нет.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] `catch` вокруг `esbuild.build()` разбирает `errors` только у ошибки с массивом `errors`. Любую другую ошибку бросает дальше как есть, и в «Внутренней ошибке» виден её текст, например `The service was stopped: …`
- [ ] Тест Runner: `esbuild.build` отклоняется обычным `Error("The service was stopped: boom")`, Test Report — `internal-error` с этим текстом. Тест красный до правки
- [ ] После такой ошибки следующий Run поднимает новый Worker и проходит, как в runtime-hardening/05
- [ ] `npm run typecheck`, `npm test`, `npm run test:e2e` зелёные

## Comments

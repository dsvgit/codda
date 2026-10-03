# 02: TypeScript language service в Web Worker для CodeMirror 6 без сети

Type: research
Status: resolved
Blocked by: None

## Question

Как дать студенту diagnostics и autocomplete (в т.ч. по React) в CodeMirror 6 так, чтобы всё работало с нашего origin и без CDN (ADR-0002)?

- Какие есть готовые решения (`@typescript/vfs`, `@valtown/codemirror-ts`, другие) и что они тянут из сети по умолчанию (lib-файлы `lib.dom.d.ts` и др., `.d.ts` пакетов)?
- Language service в отдельном Worker или в том же, что esbuild-wasm (Compiler)? Размер `typescript.js`, время холодного старта, память.
- Как подложить `.d.ts` зависимостей Lesson (`react`, `@types/react`) из Dependency Artifacts.
- Какие `compilerOptions` нужны, чтобы diagnostics совпадали с тем, что собирает Compiler (JSX `react-jsx`, `strict`).
- Совместимость с текущим редактором в `src/Editor.tsx`.

Ответ — сравнение вариантов с рекомендацией и ссылками на первоисточники.

Research: docs/research/ts-language-service.md (ветка research/ts-language-service)

## Answer

Факты и замеры — в [docs/research/ts-language-service.md](../../../docs/research/ts-language-service.md). Это рекомендация; продуктовые вопросы вынесены в тикет «Type Checker: поведение в редакторе».

- **TS 7 (`typescript@^7` в проекте) в браузере не запускается**: нативный Go-порт без JS-API и без WASM. Language service — на **TypeScript 6.0.x** отдельным npm-алиасом; TS 7 остаётся для `tsc -b`.
- **Вариант B:** отдельный Web Worker «Type Checker» (не вместе с esbuild-wasm) на `typescript@6.0.3` + `@typescript/vfs` без CDN-функций и ATA.
- lib-файлы — JSON-артефакт с нашего origin; `.d.ts` зависимостей — типовой Dependency Artifact рядом с JS в общем манифесте (см. «Как собирать и доставлять Dependency Artifacts», п. 7).
- `compilerOptions` — research §6 (`react-jsx`, `strict`, `isolatedModules`, `bundler`, `skipLibCheck`, `types: []`).
- К CodeMirror 6 — своя тонкая обвязка (lint + autocomplete + hover) по образцу архивированного `@valtown/codemirror-ts`, с узким интерфейсом под будущую замену на TS 7 через `@codemirror/lsp-client`.
- Цена: ~1.1 МБ br загрузки (воркер + lib + типы React), холодный старт ~0.7 с в Node (в браузере ожидать 1–2 с), ~70 МБ heap, перепроверка после правки ~50 мс.

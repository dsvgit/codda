# 02: TypeScript language service в Web Worker для CodeMirror 6 без сети

Type: research
Status: open
Blocked by: None

## Question

Как дать студенту diagnostics и autocomplete (в т.ч. по React) в CodeMirror 6 так, чтобы всё работало с нашего origin и без CDN (ADR-0002)?

- Какие есть готовые решения (`@typescript/vfs`, `@valtown/codemirror-ts`, другие) и что они тянут из сети по умолчанию (lib-файлы `lib.dom.d.ts` и др., `.d.ts` пакетов)?
- Language service в отдельном Worker или в том же, что esbuild-wasm (Compiler)? Размер `typescript.js`, время холодного старта, память.
- Как подложить `.d.ts` зависимостей Lesson (`react`, `@types/react`) из Dependency Artifacts.
- Какие `compilerOptions` нужны, чтобы diagnostics совпадали с тем, что собирает Compiler (JSX `react-jsx`, `strict`).
- Совместимость с текущим редактором в `src/Editor.tsx`.

Ответ — сравнение вариантов с рекомендацией и ссылками на первоисточники.

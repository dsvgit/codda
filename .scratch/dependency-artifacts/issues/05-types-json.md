# 05: `types.json` — типы зависимостей для Type Checker

**What to build:** В `deps/<hash>/` рядом с `importmap.json` лежит `types.json`: плоский объект «виртуальный путь → содержимое» с `package.json` и `.d.ts` пакетов из `dependencies`, объявленных `@types/*` и их транзитивных зависимостей с типами, по путям `/node_modules/<пакет>/…`. Пакет без своих типов и без объявленного `@types` даёт предупреждение и заглушку `any` в `types.json`. Потребитель файла — фича `ts-tooling`; здесь он только собирается. Формат — в [спеке](../spec.md).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Тест CLI: фикстура с пакетом со своими типами — в `types.json` его `package.json` и все `.d.ts`/`.d.mts`/`.d.cts`, JS-файлов нет
- [ ] Тест CLI: пакет без типов + объявленный `@types/<имя>` — в `types.json` файлы `/node_modules/@types/<имя>/…` и их транзитивная зависимость с типами (как `csstype` у `@types/react`); предупреждения нет
- [ ] Тест CLI: пакет без типов, `@types/<имя>` не объявлен — предупреждение «у пакета `<имя>` нет типов: объявите `@types/<имя>` в dependencies, если он есть, иначе в редакторе он будет `any`», код `0`; в `types.json` заглушка `/node_modules/@types/<имя>/…d.ts` на каждую точку входа этого пакета (включая subpath)
- [ ] Тест CLI: scoped-пакет без типов — заглушка по правилу имён `@types` (`@scope/pkg` → `@types/scope__pkg`)
- [ ] Пилотный Course: в `types.json` есть `/node_modules/@types/react/index.d.ts`, `/node_modules/@types/react-dom/client.d.ts` и `/node_modules/csstype/index.d.ts`
- [ ] Повышена константа версии пайплайна, так что артефакты в `.codda/deps/`, собранные до этого тикета без `types.json`, пересобираются

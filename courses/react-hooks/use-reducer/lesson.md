---
title: useReducer
---

Допишите редьюсер `counterReducer(state, action)` для состояния `{ count: number }`:

- `{ type: "increment" }` увеличивает `count` на 1;
- `{ type: "decrement" }` уменьшает `count` на 1;
- `{ type: "reset" }` возвращает `count` в 0.

Редьюсер не меняет `state`, а возвращает новый объект.

Затем подключите его в `Counter` через `useReducer`: кнопки «+», «−» и «Reset» отправляют действия, `<output>` показывает `count`.

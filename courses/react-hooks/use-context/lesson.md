---
title: useContext
---

`ThemeContext` уже создан со значением по умолчанию `"light"`. Допишите `ThemedButton`: он читает тему из `ThemeContext` через `useContext` и рендерит `<button>` с классом, равным теме, и текстом «`Theme: <тема>`». Без провайдера кнопка светлая, внутри `<ThemeContext value="dark">` — тёмная.

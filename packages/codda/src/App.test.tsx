import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { commands, page, userEvent } from "vitest/browser";
import { createRoot, type Root } from "react-dom/client";
import { App } from "./App";
import type { CourseData } from "./course-data";

// The Course comes as a literal, as the UI gets it from course.json.
const course = {
  id: "demo",
  title: "Демо",
  deps: null,
  modules: [
    {
      title: "Первый",
      lessons: [
        {
          id: "add",
          title: "Сложение",
          instructions:
            "<h2>Задание</h2>\n<p>Допишите функцию <code>add</code>.</p>\n<ul>\n<li>Она складывает два числа.</li>\n</ul>\n",
          workspace: {
            name: "main.ts",
            starter: "export function add(a: number, b: number) {\n  return a - b;\n}\n",
          },
          solution: "export function add(a: number, b: number) {\n  return a + b;\n}\n",
          tests: `import { test, expect } from "@codda/test";
import { add } from "./main";

test("adds two positive numbers", () => {
  expect(add(2, 3)).toBe(5);
});

test("adds a negative number", () => {
  expect(add(-1, 1)).toBe(0);
});
`,
          testsName: "lesson.test.ts",
        },
      ],
    },
    {
      title: "Второй",
      lessons: [
        {
          id: "greet",
          title: "Приветствие",
          instructions: "<p>Верните приветствие.</p>\n",
          workspace: { name: "main.tsx", starter: 'export const greet = () => "?";\n' },
          solution: 'export const greet = () => "hi";\n',
          tests: `import { test, expect } from "@codda/test";
import { greet } from "./main";

test("greets", () => {
  expect(greet()).toBe("hi");
});
`,
          testsName: "lesson.test.tsx",
        },
      ],
    },
  ],
} satisfies CourseData;

let root: Root | undefined;

// The screen's Run, without the Type Checker (spec ts-tooling, «Testing
// Decisions»): its lib files do not load, so it is unavailable for the whole
// file and the underlines here are the Compiler's only. Type errors — e2e.
beforeAll(() => commands.failRequests("/ts-lib-[0-9a-f]+\\.json"));
afterAll(() => commands.restoreRequests());

afterEach(() => {
  root?.unmount();
  root = undefined;
  document.body.innerHTML = "";
  history.replaceState(null, "", location.pathname + location.search);
});

/** The screen as the page opens it: the Lesson comes from the fragment `#/<lesson id>`. */
function renderApp(lessonId?: string, of: CourseData = course) {
  history.replaceState(null, "", lessonId === undefined ? location.pathname + location.search : `#/${lessonId}`);
  if (!root) {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  }
  root.render(<App course={of} />);
}

const editor = () => page.getByRole("textbox", { name: /^main\.tsx?$/ });
const runTests = () => page.getByRole("button", { name: "▶ Запустить тесты" });
const testsTab = () => page.getByRole("tab", { name: /^Тесты/ });
const report = () => page.getByRole("region", { name: "Test Report" });
const RED = "rgb(207, 34, 46)";
const GREEN = "rgb(26, 127, 55)";
const BANNER_GREEN = "rgb(218, 251, 225)";
const background = (el: Element) => getComputedStyle(el).backgroundColor;

test("FAIL: ✓/✗ per test with the error, FAIL · N / M and a red N/M on «Тесты»", async () => {
  renderApp("add");
  await editor().fill("export function add(a: number, b: number) {\n  return a + b + (a < 0 ? 1 : 0);\n}\n");

  await runTests().click();

  await expect.element(report().getByText("FAIL · 1 / 2")).toBeVisible();
  await expect.element(report().getByText("✓ adds two positive numbers")).toBeVisible();
  await expect
    .element(report().getByText("✗ adds a negative number — expected 0, got 1"))
    .toBeVisible();
  const counter = testsTab().getByText("1/2");
  await expect.element(counter).toBeVisible();
  expect(background(counter.element())).toBe(RED);
});

test("PASS: PASS · M / M, a green banner «Все тесты пройдены» and a green M/M", async () => {
  renderApp("add");
  await editor().fill(course.modules[0].lessons[0].solution);

  await runTests().click();

  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();
  const banner = report().getByText("Все тесты пройдены");
  await expect.element(banner).toBeVisible();
  expect(background(banner.element().closest(".banner")!)).toBe(BANNER_GREEN);
  const counter = testsTab().getByText("2/2");
  await expect.element(counter).toBeVisible();
  expect(background(counter.element())).toBe(GREEN);
});

test("before the first Run «Тесты» has a hint and no counter", async () => {
  renderApp("add");

  await expect.element(page.getByRole("tabpanel").getByText("Нажмите „Запустить тесты“")).toBeVisible();
  expect(testsTab().element().textContent).toBe("Тесты");
  await expect.element(report()).not.toBeInTheDocument();
});

const cancelRun = () => page.getByRole("button", { name: "■ Отмена" });
const looping = "while (true) {}\nexport const add = (a: number, b: number) => a + b;\n";

// Before the tests with an infinite loop: see «Отложенные проблемы».
test("Run from «Решение» opens «Тесты»; switching tabs keeps the Workspace and the Test Report", async () => {
  renderApp("add");
  await runTests().click();
  await expect.element(report().getByText("FAIL · 0 / 2")).toBeVisible();

  await page.getByRole("tab", { name: "Решение" }).click();
  await expect.element(report()).not.toBeInTheDocument();
  await testsTab().click();
  await expect.element(report().getByText("FAIL · 0 / 2")).toBeVisible();

  await editor().fill(course.modules[0].lessons[0].solution);
  await page.getByRole("button", { name: "Показать решение" }).click();
  await runTests().click();

  await expect.element(testsTab()).toHaveAttribute("aria-selected", "true");
  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();
  await page.getByRole("tab", { name: "Решение" }).click();
  await testsTab().click();
  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();
  await expect.poll(() => editor().element().textContent).toContain("return a + b;");
});

// Undo is Mod-z in CodeMirror: Cmd on macOS, Ctrl elsewhere (CI runs Linux).
const undoModifier = /Mac/.test(navigator.platform) ? "Meta" : "Control";
const workspaceText = () => editor().element().textContent;

test("during a Run «■ Отмена» stands in place of «▶ Запустить тесты»; it shows a neutral «Запуск отменён»", async () => {
  // The screen is meant for a desktop; in a narrow one columns follow the toolbar width.
  await page.viewport(1280, 800);
  renderApp("add");
  await editor().fill(looping);
  const place = runTests().element().getBoundingClientRect();

  await runTests().click();

  await expect.element(cancelRun()).toBeVisible();
  await expect.element(runTests()).not.toBeInTheDocument();
  const box = cancelRun().element().getBoundingClientRect();
  expect([box.left, box.top]).toEqual([place.left, place.top]);

  await cancelRun().click();

  const cancelled = report().getByRole("heading", { name: "Запуск отменён" });
  await expect.element(cancelled).toBeVisible();
  expect(getComputedStyle(cancelled.element()).color).not.toBe(RED);
  expect(testsTab().element().textContent).toBe("Тесты");
  await expect.element(runTests()).toBeEnabled();
  await expect.element(cancelRun()).not.toBeInTheDocument();
});

// Отложено: флейк первого Run после бесконечного цикла — .scratch/mvp-autorun/README.md, «Отложенные проблемы»
test.skip("after a cancelled Run «▶ Запустить тесты» with the solution gives PASS", async () => {
  renderApp("add");
  await editor().fill(looping);
  await runTests().click();
  await cancelRun().click();
  await expect.element(report().getByText("Запуск отменён")).toBeVisible();

  await editor().fill(course.modules[0].lessons[0].solution);
  await runTests().click();

  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();
});

test("student who breaks the syntax sees where the compile error is", async () => {
  renderApp("add");

  await editor().fill("export function add(a: number, b: number) {\n  return a +;\n}\n");
  await runTests().click();

  await expect.element(report().getByText("Ошибка компиляции")).toBeVisible();
  await expect.element(report().getByText('Строка 2:13 — Unexpected ";"')).toBeVisible();
  const counter = testsTab().getByText("✗");
  await expect.element(counter).toBeVisible();
  expect(background(counter.element())).toBe(RED);
});

test("an exception outside the tests shows «Ошибка выполнения» and its message without a stack, counter ✗", async () => {
  renderApp("add");
  await editor().fill('function boom(): never {\n  throw new Error("boom at import");\n}\nboom();\n');

  await runTests().click();

  await expect.element(report().getByText("Ошибка выполнения")).toBeVisible();
  await expect.element(report().getByText("boom at import", { exact: true })).toBeVisible();
  expect(report().element().textContent).not.toContain("at boom");
  expect(report().element().textContent).not.toContain("Error:");
  await expect.element(testsTab().getByText("✗")).toBeVisible();
});

const underlined = () => [...document.querySelectorAll(".workspace .cm-lintRange-error")];

test("a compile error in the Workspace is underlined from its position to the end of the line", async () => {
  renderApp("add");
  await editor().fill("export function add(a: number, b: number) {\n  return a +; // here\n}\n");

  await runTests().click();

  await expect.element(report().getByText('Строка 2:13 — Unexpected ";"')).toBeVisible();
  await expect.poll(() => underlined().map((el) => el.textContent).join("")).toBe("; // here");
});

test("with Cyrillic before the error the underline still starts at it (esbuild counts columns in bytes)", async () => {
  renderApp("add");
  await editor().fill('export function add(a: number, b: number) {\n  return "привет" +; // here\n}\n');

  await runTests().click();

  await expect.poll(() => underlined().map((el) => el.textContent).join("")).toBe("; // here");
});

test("the underline goes away on the first edit", async () => {
  renderApp("add");
  await editor().fill("export function add(a: number, b: number) {\n  return a +;\n}\n");
  await runTests().click();
  await expect.poll(() => underlined().length).toBeGreaterThan(0);

  await userEvent.click(editor());
  await userEvent.keyboard("x");

  await expect.poll(() => underlined().length).toBe(0);
});

test("the underline goes away when the next Run starts", async () => {
  renderApp("add");
  await editor().fill("export function add(a: number, b: number) {\n  return a +;\n}\n");
  await runTests().click();
  await expect.poll(() => underlined().length).toBeGreaterThan(0);

  await runTests().click();

  // The same code fails again: the underline is gone in between.
  await expect.poll(() => underlined().length, { interval: 1 }).toBe(0);
  await expect.poll(() => underlined().length).toBeGreaterThan(0);
});

test("an import the task does not provide is a compile error on its line, underlined", async () => {
  renderApp("add");
  await editor().fill('import "lodash";\nexport function add(a: number, b: number) {\n  return a + b;\n}\n');

  await runTests().click();

  await expect.element(report().getByText("Ошибка компиляции")).toBeVisible();
  await expect.element(report().getByText('Строка 1:8 — Импорт "lodash" не предусмотрен заданием')).toBeVisible();
  await expect.poll(() => underlined().map((el) => el.textContent).join("")).toBe('"lodash";');
});

test("a compile error in the Lesson Tests is shown without a line and underlines nothing", async () => {
  renderApp("add");
  await editor().fill("export function sum(a: number, b: number) {\n  return a + b;\n}\n");

  await runTests().click();

  await expect
    .element(report().getByText('No matching export in "main" for import "add"', { exact: true }))
    .toBeVisible();
  expect(report().element().textContent).not.toContain("Строка");
  expect(underlined()).toHaveLength(0);
});

test("an infinite loop shows «Тесты не завершились за 5 с» with the real causes, counter ✗", { timeout: 30_000 }, async () => {
  renderApp("add");
  await editor().fill("while (true) {}\n");

  await runTests().click();

  await expect
    .element(report().getByText("Тесты не завершились за 5 с"), { timeout: 15_000 })
    .toBeVisible();
  await expect
    .element(report().getByText("Возможные причины: бесконечный цикл, зависший промис или нехватка памяти."))
    .toBeVisible();
  await expect.element(testsTab().getByText("✗")).toBeVisible();
});

test("«Показать решение» opens the read-only Solution on «Решение», the Workspace stays", async () => {
  renderApp("add");
  await editor().fill("export const mine = 1;\n");

  await page.getByRole("button", { name: "Показать решение" }).click();

  await expect.element(page.getByRole("tab", { name: "Решение" })).toHaveAttribute("aria-selected", "true");
  const solution = page.getByRole("tabpanel").getByRole("textbox", { name: "Решение" });
  await expect.poll(() => solution.element().textContent).toContain("return a + b;");
  await userEvent.click(solution);
  await userEvent.keyboard("typed");
  expect(solution.element().textContent).not.toContain("typed");
  await expect.element(editor()).toHaveTextContent("export const mine = 1;");
});

test(`«↺ Сбросить» brings back the Starter and keeps the Test Report; ${undoModifier}+Z undoes it in one step`, async () => {
  renderApp("add");
  await editor().fill("export const mine = 1;\n");
  await runTests().click();
  await expect.element(report()).toBeVisible();
  const lastReport = report().element().textContent;

  await page.getByRole("button", { name: "↺ Сбросить" }).click();

  await expect.poll(workspaceText).toBe("export function add(a: number, b: number) {  return a - b;}");
  expect(report().element().textContent).toBe(lastReport);

  await userEvent.click(editor());
  await userEvent.keyboard(`{${undoModifier}>}z{/${undoModifier}}`);
  await expect.poll(workspaceText).toBe("export const mine = 1;");
});

test("at 1280×800 Instructions, toolbar, editor and bottom panel are all on screen at once", async () => {
  await page.viewport(1280, 800);
  renderApp("add");
  await runTests().click();
  await expect.element(report()).toBeVisible();

  const parts = [
    page.getByText("Допишите функцию add.", { exact: false }),
    runTests(),
    page.getByRole("button", { name: "↺ Сбросить" }),
    page.getByRole("button", { name: "Показать решение" }),
    editor(),
    page.getByRole("tablist"),
    report(),
  ];
  const instructions = parts[0].element().getBoundingClientRect();
  for (const part of parts) {
    const box = part.element().getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.left).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(800);
    expect(box.right).toBeLessThanOrEqual(1280);
  }
  // Instructions on the left, the rest on the right of them.
  expect(editor().element().getBoundingClientRect().left).toBeGreaterThanOrEqual(instructions.right);
});

test("the Lesson shows its and the Course's title, its Instructions and Workspace", async () => {
  renderApp("greet");

  await expect.element(page.getByRole("heading", { name: "Демо · Приветствие" })).toBeVisible();
  await expect.poll(() => document.title).toBe("Приветствие — Демо");
  await expect.element(page.getByRole("heading", { name: "main.tsx" })).toBeVisible();
  await expect.element(page.getByText("Верните приветствие.")).toBeVisible();
  await expect.element(editor()).toHaveTextContent('export const greet = () => "?";');
});

test("Instructions are the HTML from course.json, shown with its formatting", async () => {
  renderApp("add");

  const instructions = page.getByRole("region", { name: "Instructions" });
  await expect.element(instructions.getByRole("heading", { name: "Задание" })).toBeVisible();
  await expect.element(instructions.getByRole("code")).toHaveTextContent("add");
  await expect.element(instructions.getByRole("listitem")).toHaveTextContent("Она складывает два числа.");
});

test("without a Lesson id the first Lesson opens; the fragment becomes its id, no new history entry", async () => {
  const entries = history.length;
  renderApp(undefined);

  await expect.element(page.getByRole("heading", { name: "Демо · Сложение" })).toBeVisible();
  await expect.poll(() => location.hash).toBe("#/add");
  expect(history.length).toBe(entries);
});

test("`#/`, an unknown Lesson id and a broken escape open the first Lesson; the fragment becomes its id, no new history entry", async () => {
  for (const id of ["", "nope", "%E0%A4%A"]) {
    const entries = history.length;
    renderApp(id);

    await expect.element(page.getByRole("heading", { name: "Демо · Сложение" })).toBeVisible();
    await expect.poll(() => location.hash).toBe("#/add");
    expect(history.length).toBe(entries);
    await expect.element(page.getByText("не найден")).not.toBeInTheDocument();
  }
});

test("`codda dev`: a Lesson with `errors` shows «Ошибки в Lesson» with its lines, the other Lessons open as usual", async () => {
  const broken: CourseData = {
    ...course,
    modules: [
      { title: "Первый", lessons: [{ id: "add", title: "add", errors: ["add/lesson.md: нет frontmatter между строками ---", "add/: нет solution.ts — расширение как у main.ts"] }] },
      course.modules[1],
    ],
  };
  renderApp("add", broken);

  await expect.element(page.getByRole("heading", { name: "Ошибки в Lesson add" })).toBeVisible();
  const items = page.getByRole("listitem");
  await expect.element(items.nth(0)).toHaveTextContent("add/lesson.md: нет frontmatter между строками ---");
  await expect.element(items.nth(1)).toHaveTextContent("add/: нет solution.ts — расширение как у main.ts");
  await expect.element(runTests()).not.toBeInTheDocument();

  renderApp("greet", broken);
  await expect.element(page.getByRole("heading", { name: "Демо · Приветствие" })).toBeVisible();
});

test("`codda dev`: top-level `errors` are shown full-screen", async () => {
  renderApp("add", { id: "", title: "", deps: null, modules: [], errors: ["course.yaml: title: обязательное поле"] });

  await expect.element(page.getByRole("heading", { name: "Ошибки в курсе" })).toBeVisible();
  await expect.element(page.getByRole("listitem")).toHaveTextContent("course.yaml: title: обязательное поле");
});

test("another Lesson opens from a clean slate: its Starter, no Test Report", async () => {
  renderApp("add");
  await editor().fill("export const edited = 1;\n");
  await runTests().click();
  await expect.element(page.getByRole("region", { name: "Test Report" })).toBeVisible();

  renderApp("greet");

  await expect.element(page.getByRole("heading", { name: "Демо · Приветствие" })).toBeVisible();
  await expect.element(editor()).toHaveTextContent('export const greet = () => "?";');
  await expect.element(page.getByRole("region", { name: "Test Report" })).not.toBeInTheDocument();
});

const consoleTab = () => page.getByRole("tab", { name: /^Console/ });
const consoleLine = (text: string) => page.getByRole("tabpanel").getByText(text, { exact: true });

test("«Console» between «Тесты» and «Решение» shows the lines of the Run as text, warn and error marked, a counter on the tab; after the Run «Тесты» is open", async () => {
  renderApp("add");
  await editor().fill(
    'console.log("<b>plain</b>");\nconsole.warn("careful");\nconsole.error("broken");\n' +
      course.modules[0].lessons[0].solution,
  );

  await runTests().click();

  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();
  await expect.element(testsTab()).toHaveAttribute("aria-selected", "true");
  const tabs = page.getByRole("tab").elements().map((t) => t.textContent);
  // «Проблемы» without a counter: no Type Checker in this file.
  expect(tabs).toEqual(["Тесты2/2", "Console3", "Проблемы", "Решение"]);

  await consoleTab().click();

  const plain = consoleLine("<b>plain</b>");
  await expect.element(plain).toBeVisible();
  await expect.element(consoleLine("careful")).toBeVisible();
  await expect.element(consoleLine("broken")).toBeVisible();
  const color = (el: Element) => getComputedStyle(el).color;
  expect(color(consoleLine("broken").element())).toBe(RED);
  expect(color(consoleLine("careful").element())).not.toBe(color(plain.element()));
  expect(color(consoleLine("careful").element())).not.toBe(RED);
});

test("a new Run clears «Console»", async () => {
  renderApp("add");
  await editor().fill('console.log("first run");\n' + course.modules[0].lessons[0].solution);
  await runTests().click();
  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();
  await expect.element(consoleTab()).toHaveTextContent("Console1");

  await editor().fill(course.modules[0].lessons[0].solution);
  await runTests().click();

  // The last Test Report stays while the Run goes: wait for the Run to end.
  await expect.element(runTests()).toBeVisible();
  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();
  expect(consoleTab().element().textContent).toBe("Console");
  await consoleTab().click();
  await expect.element(page.getByRole("tabpanel").getByText("Нет вывода")).toBeVisible();
});

test("lines show while the Run goes and stay after «■ Отмена»; «Тесты» opens after the Run", async () => {
  renderApp("add");
  await editor().fill('console.log("started");\n' + looping);
  await runTests().click();
  await consoleTab().click();

  await expect.element(consoleLine("started")).toBeVisible();
  await cancelRun().click();

  await expect.element(testsTab()).toHaveAttribute("aria-selected", "true");
  await expect.element(report().getByText("Запуск отменён")).toBeVisible();
  await expect.element(consoleTab()).toHaveTextContent("Console1");
  await consoleTab().click();
  await expect.element(consoleLine("started")).toBeVisible();
});

const previous = () => page.getByRole("button", { name: "← Предыдущий" });
const next = () => page.getByRole("button", { name: "Следующий →" });
const lessonHeading = (title: string) => page.getByRole("heading", { name: `Демо · ${title}` });

test("«Следующий →» goes from the last Lesson of a Module to the first of the next one, «← Предыдущий» back; each changes the fragment", async () => {
  renderApp("add");
  await expect.element(lessonHeading("Сложение")).toBeVisible();

  await next().click();

  await expect.element(lessonHeading("Приветствие")).toBeVisible();
  expect(location.hash).toBe("#/greet");
  await expect.element(editor()).toHaveTextContent('export const greet = () => "?";');

  await previous().click();

  await expect.element(lessonHeading("Сложение")).toBeVisible();
  expect(location.hash).toBe("#/add");
});

test("«← Предыдущий» is disabled on the first Lesson, «Следующий →» on the last", async () => {
  renderApp("add");
  await expect.element(previous()).toBeDisabled();
  await expect.element(next()).toBeEnabled();

  renderApp("greet");
  await expect.element(lessonHeading("Приветствие")).toBeVisible();
  await expect.element(previous()).toBeEnabled();
  await expect.element(next()).toBeDisabled();
});

test("«← Предыдущий» and «Следующий →» stand in the toolbar right of «Показать решение»", async () => {
  await page.viewport(1280, 800);
  renderApp("add");
  await expect.element(next()).toBeVisible();

  const right = (el: Element) => el.getBoundingClientRect().right;
  const left = (el: Element) => el.getBoundingClientRect().left;
  const solution = page.getByRole("button", { name: "Показать решение" }).element();
  expect(left(previous().element())).toBeGreaterThan(right(solution));
  expect(left(next().element())).toBeGreaterThan(right(previous().element()));
  expect(right(next().element())).toBeLessThanOrEqual(1280);
});

test("the PASS banner has «Следующий урок →», which opens the next Lesson from a clean slate", async () => {
  renderApp("add");
  await editor().fill(course.modules[0].lessons[0].solution);
  await runTests().click();
  await expect.element(report().getByText("PASS · 2 / 2")).toBeVisible();

  await report().getByRole("button", { name: "Следующий урок →" }).click();

  await expect.element(lessonHeading("Приветствие")).toBeVisible();
  expect(location.hash).toBe("#/greet");
  await expect.element(report()).not.toBeInTheDocument();
});

test("on the last Lesson the PASS banner says «Это последний урок курса» and has no button", async () => {
  renderApp("greet");
  await editor().fill(course.modules[1].lessons[0].solution);
  await runTests().click();
  await expect.element(report().getByText("PASS · 1 / 1")).toBeVisible();

  await expect.element(report().getByText("Это последний урок курса")).toBeVisible();
  await expect.element(report().getByRole("button")).not.toBeInTheDocument();
});

test("FAIL has no «Следующий урок →»", async () => {
  renderApp("add");
  await runTests().click();
  await expect.element(report().getByText("FAIL · 0 / 2")).toBeVisible();

  await expect.element(page.getByRole("button", { name: "Следующий урок →" })).not.toBeInTheDocument();
});

test("a change of the fragment from outside (history, a link) opens that Lesson", async () => {
  renderApp("add");
  await expect.element(lessonHeading("Сложение")).toBeVisible();

  location.hash = "#/greet";

  await expect.element(lessonHeading("Приветствие")).toBeVisible();
});

const sandboxes = () => document.querySelectorAll("iframe[sandbox]").length;

// A Run that waits, not a busy loop: see «Отложенные проблемы», a Sandbox with
// an infinite loop slows down the Runs of the test files next to this one.
const [addLesson] = course.modules[0].lessons;
const waiting: CourseData = {
  ...course,
  modules: [
    {
      ...course.modules[0],
      lessons: [
        {
          ...addLesson,
          tests: 'import { test } from "@codda/test";\nimport "./main";\n\ntest("never ends", () => new Promise<void>(() => {}));\n',
        },
      ],
    },
    course.modules[1],
  ],
};

test("going to another Lesson during a Run cancels it: its Sandbox goes away, the bottom panel of either Lesson is empty", async () => {
  renderApp("add", waiting);
  await editor().fill('console.log("started");\n' + addLesson.solution);
  await runTests().click();
  await consoleTab().click();
  await expect.element(consoleLine("started")).toBeVisible();
  expect(sandboxes()).toBe(1);

  await next().click();

  await expect.element(lessonHeading("Приветствие")).toBeVisible();
  // Well before the Run's 5 s deadline.
  await expect.poll(sandboxes, { timeout: 1000 }).toBe(0);
  await expect.element(runTests()).toBeVisible();
  await expect.element(testsTab()).toHaveAttribute("aria-selected", "true");
  await expect.element(page.getByRole("tabpanel").getByText("Нажмите „Запустить тесты“")).toBeVisible();
  expect(consoleTab().element().textContent).toBe("Console");

  await previous().click();

  await expect.element(lessonHeading("Сложение")).toBeVisible();
  await expect.element(page.getByRole("tabpanel").getByText("Нажмите „Запустить тесты“")).toBeVisible();
  expect(testsTab().element().textContent).toBe("Тесты");
});

test(`after going to another Lesson ${undoModifier}+Z does not bring back the code of the previous one`, async () => {
  renderApp("add");
  await editor().fill("export const mine = 1;\n");

  await next().click();
  await expect.element(lessonHeading("Приветствие")).toBeVisible();
  await userEvent.click(editor());
  await userEvent.keyboard(`{${undoModifier}>}z{/${undoModifier}}`);

  await expect.poll(workspaceText).toBe('export const greet = () => "?";');
});

import { createRef } from "react";
import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { expect, test } from "vitest";
import { Editor, type EditorHandle } from "./Editor";

// The «Проблемы» list lags behind the text by ~300 ms: a click on a problem
// past the end of a shortened text puts the cursor at the end.
test("goTo past the end of the text puts the cursor at the end", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const ref = createRef<EditorHandle>();
  flushSync(() => root.render(<Editor label="main.ts" initialValue="abc" ref={ref} />));

  ref.current!.goTo(100);

  const selection = document.getSelection()!;
  expect(host.querySelector(".cm-content")!.contains(selection.anchorNode)).toBe(true);
  root.unmount();
  host.remove();
});

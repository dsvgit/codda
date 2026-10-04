import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { forceLinting, linter, type Diagnostic } from "@codemirror/lint";
import type { CompileError } from "./runtime/types";
import type { TypeCheckerStatus, TypeError } from "./type-checker/client";

type Props = {
  label: string;
  initialValue: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  /** Compile errors of the Workspace to underline; those without a line are not shown. */
  errors?: CompileError[];
  /** The type errors of a text, underlined ~300 ms after typing stops (Type Checker); none: not checked. */
  typeCheck?: (text: string) => Promise<TypeError[]>;
  /** The type errors once they are underlined: those of the current text only. */
  onTypeErrors?: (errors: TypeError[]) => void;
  /** A change re-checks at once: an unavailable Type Checker takes its underlines away. */
  typeCheckStatus?: TypeCheckerStatus;
  ref?: Ref<EditorHandle>;
};

/** The user event of the empty transaction that makes the linters run again: new compile errors or Type Checker status. */
const RELINT = "codda.relint";

export type EditorHandle = {
  /** Replaces the whole text in one transaction: Mod-z brings the old text back. */
  replaceAll: (text: string) => void;
  /** Puts the cursor at offset `pos` and focuses the editor. */
  goTo: (pos: number) => void;
};

export function Editor({
  label,
  initialValue,
  onChange,
  readOnly = false,
  errors = [],
  typeCheck,
  onTypeErrors,
  typeCheckStatus,
  ref,
}: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const typeCheckRef = useRef(typeCheck);
  typeCheckRef.current = typeCheck;
  const onTypeErrorsRef = useRef(onTypeErrors);
  onTypeErrorsRef.current = onTypeErrors;
  const checked = typeCheck !== undefined;
  // Until the next edit: then they no longer match the text.
  const compileErrors = useRef(errors);

  useEffect(() => {
    const editor = new EditorView({
      parent: host.current!,
      doc: initialValue,
      extensions: [
        basicSetup,
        javascript({ typescript: true, jsx: true }),
        EditorView.contentAttributes.of({ "aria-label": label }),
        EditorView.editable.of(!readOnly),
        EditorView.updateListener.of((update) => {
          if (!update.docChanged) return;
          compileErrors.current = [];
          onChangeRef.current?.(update.state.doc.toString());
        }),
        // Two sources of diagnostics: @codemirror/lint runs both and shows them together.
        linter((view) => compileErrors.current.flatMap((e) => toDiagnostic(view, e)), {
          needsRefresh: (update) => update.transactions.some((tr) => tr.isUserEvent(RELINT)),
        }),
        checked ? linter(typeErrorSource(typeCheckRef, onTypeErrorsRef), { delay: 300 }) : [],
      ],
    });
    view.current = editor;
    return () => editor.destroy();
  }, [label, initialValue, readOnly, checked]);

  useEffect(() => {
    compileErrors.current = errors;
    const editor = view.current!;
    editor.dispatch({ userEvent: RELINT });
    // Now, not after the type check's 300 ms: the start of a Run clears them at once.
    forceLinting(editor);
  }, [errors]);

  useEffect(() => {
    const editor = view.current!;
    editor.dispatch({ userEvent: RELINT });
    forceLinting(editor);
  }, [typeCheckStatus]);

  useImperativeHandle(ref, () => ({
    replaceAll: (text) => {
      const editor = view.current!;
      // A user event that is not "input.type…" or "delete…": the history does
      // not join it with typing done less than 500 ms before.
      editor.dispatch({
        changes: { from: 0, to: editor.state.doc.length, insert: text },
        userEvent: "reset",
      });
    },
    goTo: (pos) => {
      const editor = view.current!;
      editor.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
      editor.focus();
    },
  }));

  return <div className="editor" ref={host} />;
}

/** From the error's position to the end of its line. */
function toDiagnostic(editor: EditorView, { line, column, message }: CompileError): Diagnostic[] {
  if (line === undefined || column === undefined) return [];
  const { from, to } = editor.state.doc.line(line);
  return [{ from: from + column - 1, to, severity: "error", message }];
}

/**
 * A lint source asking the Type Checker. CodeMirror drops the answer if the
 * text changed meanwhile, and so does `onTypeErrors`: the next check follows.
 */
function typeErrorSource(typeCheck: { current: Props["typeCheck"] }, onTypeErrors: { current: Props["onTypeErrors"] }) {
  return async (view: EditorView): Promise<Diagnostic[]> => {
    const doc = view.state.doc;
    const errors = await typeCheck.current!(doc.toString());
    if (view.state.doc === doc) onTypeErrors.current?.(errors);
    return errors.map(({ from, to, message, code }) => ({
      from,
      to,
      severity: "error",
      message: `${message} (TS${code})`,
    }));
  };
}

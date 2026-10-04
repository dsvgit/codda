import { useEffect, useImperativeHandle, useRef, type Ref } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";

type Props = {
  label: string;
  initialValue: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  ref?: Ref<EditorHandle>;
};

export type EditorHandle = {
  /** Replaces the whole text in one transaction: Mod-z brings the old text back. */
  replaceAll: (text: string) => void;
};

export function Editor({ label, initialValue, onChange, readOnly = false, ref }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
          if (update.docChanged) onChangeRef.current?.(update.state.doc.toString());
        }),
      ],
    });
    view.current = editor;
    return () => editor.destroy();
  }, [label, initialValue, readOnly]);

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
  }));

  return <div className="editor" ref={host} />;
}

import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { javascript } from "@codemirror/lang-javascript";

type Props = { initialValue: string; onChange: (value: string) => void };

export function Editor({ initialValue, onChange }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const view = new EditorView({
      parent: host.current!,
      doc: initialValue,
      extensions: [
        basicSetup,
        javascript({ typescript: true, jsx: true }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) onChangeRef.current(update.state.doc.toString());
        }),
      ],
    });
    return () => view.destroy();
  }, [initialValue]);

  return <div className="editor" ref={host} />;
}

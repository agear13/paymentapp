import * as React from "react";
import { Upload, File as FileIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  label?: string;
  accept?: string;
  multiple?: boolean;
  onFiles?: (files: File[]) => void;
  hint?: string;
  className?: string;
}

export function FileUpload({ label, accept, multiple, onFiles, hint, className }: FileUploadProps) {
  const [files, setFiles] = React.useState<File[]>([]);
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const push = (list: FileList | null) => {
    if (!list) return;
    const next = multiple ? [...files, ...Array.from(list)] : Array.from(list);
    setFiles(next);
    onFiles?.(next);
  };

  return (
    <div className={cn("w-full", className)}>
      {label && <div className="mb-1.5 text-[12.5px] font-medium">{label}</div>}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          push(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors",
          drag ? "border-primary bg-accent/60" : "border-border bg-card hover:bg-secondary/50"
        )}
      >
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-ink-soft">
          <Upload className="size-4" />
        </div>
        <div className="text-[13px] font-medium">Drop files here or click to upload</div>
        {hint && <div className="text-[11.5px] text-ink-soft">{hint}</div>}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => push(e.target.files)}
        />
      </div>
      {files.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-2 rounded-lg border border-border bg-card px-2.5 py-1.5 text-[12.5px] shadow-soft">
              <FileIcon className="size-3.5 text-ink-soft" />
              <span className="flex-1 truncate">{f.name}</span>
              <span className="text-[11px] text-ink-soft">{(f.size / 1024).toFixed(1)} KB</span>
              <button
                type="button"
                aria-label={`Remove ${f.name}`}
                onClick={() => {
                  const next = files.filter((_, j) => j !== i);
                  setFiles(next);
                  onFiles?.(next);
                }}
                className="text-ink-soft hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

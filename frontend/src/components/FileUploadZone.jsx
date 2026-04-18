import { useRef, useState } from "react";

const ACCEPTED = ".pdf,.docx,.txt";
const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Extracts plain text from a File object.
 * - .txt  → reads as text
 * - .pdf  → uses pdf.js (loaded from CDN via dynamic import shim)
 * - .docx → extracts raw XML text (no external dep needed for snippets)
 */
async function extractText(file) {
  const name = file.name.toLowerCase();

  if (name.endsWith(".txt")) {
    return file.text();
  }

  if (name.endsWith(".pdf")) {
    // Dynamically load pdfjs from CDN to avoid bundler complexity
    const pdfjsLib = await import(
      /* @vite-ignore */
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.min.mjs"
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.mjs";

    const buffer = await file.arrayBuffer();
    const loadingTask = pdfjsLib.getDocument({ data: buffer });
    const pdf = await loadingTask.promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    return pages.join("\n\n");
  }

  if (name.endsWith(".docx")) {
    // DOCX is a ZIP. Extract word/document.xml and strip XML tags.
    const { default: JSZip } = await import(
      /* @vite-ignore */
      "https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"
    ).catch(() => ({ default: null }));

    if (!JSZip) {
      // Fallback: read as binary and hope it has usable text fragments
      const text = await file.text();
      return text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const docXml = await zip.file("word/document.xml")?.async("string");
    if (!docXml) throw new Error("Could not read word/document.xml from DOCX.");
    return docXml
      .replace(/<w:p[ >]/g, "\n<")
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  throw new Error(`Unsupported file type: ${file.name}`);
}

/**
 * Props:
 *   label       string  – field label shown above zone
 *   onTextExtracted  (text: string, fileName: string) => void
 *   disabled  *   className   string  – extra wrapper classes
 */
export default function FileUploadZone({ label, onTextExtracted, disabled, className = "" }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [fileName, setFileName] = useState(null);
  const [error, setError] = useState("");

  async function process(file) {
    if (!file) return;
    setError("");

    if (file.size > MAX_BYTES) {
      setError("File exceeds 10 MB limit.");
      return;
    }

    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt"].includes(ext)) {
      setError("Only PDF, DOCX, and TXT files are supported.");
      return;
    }

    setProcessing(true);
    setFileName(file.name);

    try {
      const text = await extractText(file);
      if (!text.trim()) {
        setError("No readable text found in this file.");
        setFileName(null);
      } else {
        onTextExtracted(text, file.name);
      }
    } catch (err) {
      setError(err.message || "Could not extract text from this file.");
      setFileName(null);
    } finally {
      setProcessing(false);
    }
  }

  function handleFiles(files) {
    if (files && files.length > 0) process(files[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e) {
    e.preventDefault();
    if (!disabled) setDragging(true);
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {label && (
        <span className="text-sm font-bold text-ink">{label}</span>
      )}
      <div
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-label="Upload file"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && !disabled && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        className={[
          "relative flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition",
          dragging
            ? "border-accent bg-accent/10 scale-[1.01]"
            : "border-line/70 bg-canvas/30 hover:border-line hover:bg-canvas/50",
          disabled ? "cursor-not-allowed opacity-50" : "",
        ].join(" ")}
      >
        <div className={`rounded-full p-3 transition ${dragging ? "bg-accent/20 text-accent" : "bg-panel border border-line text-muted shadow-sm"}`}>
          <svg
            className="h-7 w-7"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5v-9m0 0-3.75 3.75M12 7.5l3.75 3.75M20.25 16.5A4.5 4.5 0 0 0 15.75 12H15a6 6 0 1 0-5.812 7.5"
            />
          </svg>
        </div>

        {processing ? (
          <div className="flex items-center gap-2 text-sm font-bold text-ink">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
            Extracting text…
          </div>
        ) : fileName ? (
          <div className="flex flex-col items-center gap-1">
            <span className="max-w-[180px] truncate text-sm font-bold text-emerald-400">
              {fileName}
            </span>
            <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Successfully Loaded</span>
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-bold text-ink">
              Drop research paper or{" "}
              <span className="text-accent underline underline-offset-4 decoration-2">browse files</span>
            </p>
            <p className="text-[11px] font-bold text-muted uppercase tracking-tight">PDF · DOCX · TXT — up to 10 MB</p>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED}
          className="sr-only"
          disabled={disabled}
          onChange={(e) => handleFiles(e.target.files)}
        />
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          {error}
        </p>
      )}
    </div>
  );
}

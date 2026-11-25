import { ChangeEvent, useRef, useState } from "react";
import { FileCode2, Image as ImageIcon, Loader2, Upload } from "lucide-react";
import {
  extractLogicFromImageFile,
  readTextLogicFile,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_TEXT_EXTENSIONS,
} from "../../../services/logicMorphService";

interface FileUploadControllerProps {
  onPopulateLogic: (payload: {
    logicText: string;
    problemStatement?: string;
    exampleInput?: string;
    expectedOutput?: string;
    sourceLabel: string;
    sourceType: "file" | "image-ai";
  }) => void;
}

export function FileUploadController({ onPopulateLogic }: FileUploadControllerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badge, setBadge] = useState<{ label: string; type: "file" | "image-ai" } | null>(null);

  const acceptList = [...SUPPORTED_IMAGE_EXTENSIONS, ...SUPPORTED_TEXT_EXTENSIONS].join(",");

  const handleFileChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setError(null);
    const lowerName = file.name.toLowerCase();
    const isImage = SUPPORTED_IMAGE_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
    const isText = SUPPORTED_TEXT_EXTENSIONS.some((ext) => lowerName.endsWith(ext));

    if (!isImage && !isText) {
      setError(
        "Unsupported file format. Accepted: .png, .jpg, .jpeg, .webp, .txt, .md, .c, .cpp, .py, .java."
      );
      return;
    }

    if (isText) {
      try {
        const content = await readTextLogicFile(file);
        if (!content.trim()) {
          setError("Uploaded text/code file is empty.");
          return;
        }
        setBadge({ label: `File: ${file.name}`, type: "file" });
        onPopulateLogic({
          logicText: content,
          sourceLabel: file.name,
          sourceType: "file",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not read uploaded file.");
      }
      return;
    }

    // Image OCR via Gemini multimodal vision
    setLoading(true);
    try {
      const extracted = await extractLogicFromImageFile(file);
      setBadge({ label: "IMAGE EXTRACTED BY AI", type: "image-ai" });
      onPopulateLogic({
        logicText: extracted.plainEnglishLogic,
        problemStatement: extracted.problemStatement || undefined,
        exampleInput: extracted.exampleInput || undefined,
        expectedOutput: extracted.expectedOutput || undefined,
        sourceLabel: file.name,
        sourceType: "image-ai",
      });
    } catch (err) {
      setBadge(null);
      setError(
        err instanceof Error
          ? err.message
          : "Image extraction failed. Please try a clearer image or type your logic."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2.5">
        <input
          ref={inputRef}
          type="file"
          accept={acceptList}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload algorithm image, flowchart, or code file"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111624] border border-white/10 hover:border-[#00F5D4]/50 text-[#CBD5E1] hover:text-[#00F5D4] text-xs font-mono transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-[#00F5D4]" />
          ) : (
            <Upload className="w-3.5 h-3.5 text-[#00F5D4]" />
          )}
          {loading ? "Extracting Image..." : "Upload Flowchart / Code"}
        </button>

        {badge && (
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] font-mono ${
              badge.type === "image-ai" ? "text-[#00F5D4]" : "text-[#94A3B8]"
            }`}
          >
            {badge.type === "image-ai" ? (
              <ImageIcon className="w-3.5 h-3.5" />
            ) : (
              <FileCode2 className="w-3.5 h-3.5" />
            )}
            {badge.label}
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-lg bg-[#2A1215]/60 border border-[#EF4444]/40 px-3 py-2 text-xs text-[#FCA5A5]">
          {error}
        </div>
      )}
    </div>
  );
}

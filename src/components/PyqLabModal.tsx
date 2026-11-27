import { ChangeEvent, useEffect, useRef, useState } from "react";
import {
  Camera,
  Eraser,
  FileText,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from "lucide-react";
import { PyqLabConfig, SAMPLE_PYQ_CHIPS } from "../types/pyqLab";
import {
  extractPyqQuestionFromImage,
  generatePyqLab,
  generatePyqLabFromImage,
} from "../services/pyqLabService";
import { VoiceTextControls } from "./VoiceTextControls";

interface PyqLabModalProps {
  open: boolean;
  onClose: () => void;
  onLaunchLab: (config: PyqLabConfig) => void;
}

export function PyqLabModal({ open, onClose, onLaunchLab }: PyqLabModalProps) {
  const [query, setQuery] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [extractingText, setExtractingText] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  if (!open) return null;

  const clearImage = () => {
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(null);
    setImagePreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const lower = file.name.toLowerCase();
    const validExt =
      lower.endsWith(".png") ||
      lower.endsWith(".jpg") ||
      lower.endsWith(".jpeg") ||
      lower.endsWith(".webp") ||
      ["image/png", "image/jpeg", "image/webp"].includes(file.type);

    if (!validExt) {
      setErrorMsg("Unsupported file format. Upload a PNG, JPG, JPEG, or WEBP question photo.");
      e.target.value = "";
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setErrorMsg("Image is larger than 4 MB. Please crop or upload a smaller photo.");
      e.target.value = "";
      return;
    }

    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    setImageFile(file);
    setImagePreviewUrl(URL.createObjectURL(file));
    setErrorMsg(null);
  };

  const handleExtractOnly = async () => {
    if (!imageFile || extractingText || loading) return;
    setErrorMsg(null);
    setExtractingText(true);
    try {
      const extracted = await extractPyqQuestionFromImage(imageFile);
      setQuery(extracted);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not read question from image.";
      setErrorMsg(msg);
    } finally {
      setExtractingText(false);
    }
  };

  const handleGenerate = async () => {
    const trimmed = query.trim();
    if (!imageFile && trimmed.length < 4) {
      setErrorMsg(
        "Upload a PYQ question photo or enter a MAKAUT question/topic (at least 4 characters)."
      );
      return;
    }
    setErrorMsg(null);
    setLoading(true);
    try {
      const config = imageFile
        ? await generatePyqLabFromImage(imageFile, trimmed)
        : await generatePyqLab(trimmed);
      clearImage();
      onLaunchLab(config);
      onClose();
    } catch (err) {
      const msg =
        err instanceof Error && err.message
          ? err.message
          : "Unable to parse question. Try extracting the text or use a sample MAKAUT PYQ chip below.";
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#06080E]/82 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pyq-modal-title"
    >
      <div className="nexus-panel-solid rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 lg:p-7 border border-[#00F5D4]/35 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 text-xs font-mono text-[#00F5D4]">
              <Wand2 className="w-4 h-4" />
              <span>AI ENGINE ROUTER · GEMINI VISION + LOCAL FALLBACK</span>
            </div>
            <h2 id="pyq-modal-title" className="text-xl lg:text-2xl font-bold text-[#F4F7FB]">
              INSTANT 3D LAB GENERATOR
            </h2>
            <p className="text-sm text-[#94A3B8]">
              Upload a photo of any MAKAUT PYQ question or type it below to build a 3D lab.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="text-[#94A3B8] hover:text-[#F4F7FB] p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors cursor-pointer"
            aria-label="Close generator modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Direct PYQ Question Pic Upload */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>Upload PYQ Question Photo / Screenshot</span>
            <span className="text-[11px] text-[#64748B]">PNG, JPG, WEBP · Max 4 MB</span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />

          {!imageFile ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading || extractingText}
              className="w-full rounded-xl border border-dashed border-white/20 hover:border-[#00F5D4]/60 bg-[#090C14]/80 hover:bg-[#00F5D4]/[0.04] px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 transition-colors cursor-pointer text-left"
            >
              <div className="flex items-center gap-3">
                <span className="h-9 w-9 rounded-lg bg-[#00F5D4]/12 border border-[#00F5D4]/30 flex items-center justify-center text-[#00F5D4] shrink-0">
                  <ImagePlus className="w-4 h-4" />
                </span>
                <div>
                  <div className="text-xs font-semibold text-[#F4F7FB]">
                    Upload question picture or snap photo
                  </div>
                  <div className="text-[11px] text-[#94A3B8]">
                    Reads printed papers, screenshots, circuit diagrams, or handwritten PYQs
                  </div>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[11px] font-medium text-[#CBD5E1] whitespace-nowrap shrink-0">
                <Camera className="w-3.5 h-3.5 text-[#00F5D4]" />
                Choose Image
              </span>
            </button>
          ) : (
            <div className="rounded-xl border border-[#00F5D4]/35 bg-[#090C14] p-3 flex flex-col sm:flex-row sm:items-center gap-3">
              {imagePreviewUrl && (
                <img
                  src={imagePreviewUrl}
                  alt="Uploaded PYQ question preview"
                  className="h-20 w-28 object-cover rounded-lg border border-white/10 shrink-0 bg-black/40"
                />
              )}
              <div className="flex-1 min-w-0 space-y-1">
                <div className="text-xs font-semibold text-[#F4F7FB] truncate">
                  {imageFile.name}
                </div>
                <div className="text-[11px] font-mono text-[#94A3B8]">
                  {(imageFile.size / 1024).toFixed(0)} KB · Ready to build 3D lab directly
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleExtractOnly}
                    disabled={extractingText || loading}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/45 text-[11px] font-medium text-[#DDD6FE] hover:bg-[#8B5CF6]/25 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {extractingText ? (
                      <>
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Reading text...
                      </>
                    ) : (
                      <>
                        <FileText className="w-3 h-3" />
                        Extract Text to Edit
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading || extractingText}
                    className="px-2.5 py-1 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-[11px] text-[#CBD5E1] transition-colors cursor-pointer"
                  >
                    Replace
                  </button>
                  <button
                    type="button"
                    onClick={clearImage}
                    disabled={loading || extractingText}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#EF4444]/10 hover:bg-[#EF4444]/20 text-[11px] text-[#FCA5A5] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    Remove
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Multiline Input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-mono text-[#94A3B8]">
            <span>
              {imageFile ? "Optional Extra Notes / Extracted Question Text" : "MAKAUT PYQ / Syllabus Topic Input"}
            </span>
            {query.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setErrorMsg(null);
                }}
                className="inline-flex items-center gap-1 text-[#94A3B8] hover:text-[#00F5D4] transition-colors cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                Clear Input
              </button>
            )}
          </div>

          <textarea
            rows={3}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            placeholder={
              imageFile
                ? "Optional: add focus notes (e.g. 'Focus on question 3(b)') or click 'Extract Text to Edit' above..."
                : "Paste any MAKAUT PYQ, syllabus topic, or technical problem..."
            }
            className="w-full rounded-xl bg-[#090C14] border border-white/15 focus:border-[#00F5D4] focus:outline-none p-3.5 text-sm text-[#F4F7FB] placeholder:text-[#64748B] resize-y"
          />

          <VoiceTextControls
            value={query}
            onChange={(next) => {
              setQuery(next);
              if (errorMsg) setErrorMsg(null);
            }}
            contextHint="MAKAUT B.Tech IT Semester 3 PYQ exam question"
            speakLabel="Speak Question"
            uploadLabel="Upload Voice Note"
            disabled={loading || extractingText}
          />
        </div>

        {/* Sample PYQ Chips */}
        <div className="space-y-2">
          <p className="text-xs font-mono text-[#8B5CF6]">ONE-CLICK SAMPLE MAKAUT PYQS</p>
          <div className="flex flex-col gap-2">
            {SAMPLE_PYQ_CHIPS.map((sample) => (
              <button
                key={sample}
                type="button"
                onClick={() => {
                  clearImage();
                  setQuery(sample);
                  setErrorMsg(null);
                }}
                className={`text-left px-3.5 py-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                  query.trim() === sample
                    ? "bg-[#00F5D4]/12 border-[#00F5D4]/60 text-[#00F5D4]"
                    : "bg-[#0B0F18] border-white/[0.08] text-[#CBD5E1] hover:border-[#00F5D4]/45 hover:text-[#F4F7FB]"
                }`}
              >
                {sample}
              </button>
            ))}
          </div>
        </div>

        {errorMsg && (
          <div className="rounded-lg px-3.5 py-2 bg-[#2A1215] border border-[#EF4444]/45 text-xs text-[#FCA5A5]">
            {errorMsg}
          </div>
        )}

        {/* Primary Action */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] text-xs font-semibold text-[#CBD5E1] transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={loading || extractingText}
            className="px-5 py-2.5 rounded-xl bg-[#00F5D4] hover:bg-[#00DFC0] text-[#06080E] text-xs font-bold inline-flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {imageFile ? "Reading Question Photo & Building Lab..." : "Analyzing & Building 3D Scene..."}
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                {imageFile ? "GENERATE LAB FROM PHOTO" : "GENERATE PLAYABLE 3D LAB"}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

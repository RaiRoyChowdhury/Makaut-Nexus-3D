import { ChangeEvent, useEffect, useRef, useState } from "react";
import { AudioLines, Loader2, Mic, Square, Upload, X } from "lucide-react";
import { transcribeAudioBlob } from "../services/audioTranscribeService";

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionInstanceLike;

interface VoiceTextControlsProps {
  value: string;
  onChange: (nextValue: string) => void;
  contextHint?: string;
  speakLabel?: string;
  uploadLabel?: string;
  compact?: boolean;
  separator?: "newline" | "space" | "comma";
  disabled?: boolean;
}

function appendText(
  existing: string,
  addition: string,
  separator: "newline" | "space" | "comma"
): string {
  const cleanAdd = addition.trim();
  if (!cleanAdd) return existing;
  const trimmed = existing.trimEnd();
  if (!trimmed) return cleanAdd;
  if (separator === "comma") {
    const cleanBase = trimmed.replace(/,+\s*$/, "");
    return `${cleanBase}, ${cleanAdd}`;
  }
  if (separator === "space") {
    return `${trimmed} ${cleanAdd}`;
  }
  return `${trimmed}\n${cleanAdd}`;
}

export function VoiceTextControls({
  value,
  onChange,
  contextHint = "",
  speakLabel = "Speak",
  uploadLabel = "Upload Voice",
  compact = false,
  separator = "newline",
  disabled = false,
}: VoiceTextControlsProps) {
  const [speechSupported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });

  const [mediaRecordSupported] = useState<boolean>(() => {
    return (
      typeof window !== "undefined" &&
      typeof navigator !== "undefined" &&
      Boolean(navigator.mediaDevices?.getUserMedia) &&
      typeof MediaRecorder !== "undefined"
    );
  });

  const [mode, setMode] = useState<"idle" | "speech" | "recording" | "transcribing">("idle");
  const [interimText, setInterimText] = useState("");
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const cancelledRef = useRef<boolean>(false);

  const baseTextRef = useRef<string>(value);
  const finalizedRef = useRef<string>("");
  const processedIdxRef = useRef<number>(0);

  const valueRef = useRef(value);
  valueRef.current = value;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const stopMediaTracks = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
        recognitionRef.current = null;
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        try {
          mediaRecorderRef.current.stop();
        } catch {
          // ignore
        }
      }
      stopMediaTracks();
    };
  }, []);

  const startLiveSpeech = () => {
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return false;

    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      baseTextRef.current = valueRef.current;
      finalizedRef.current = "";
      processedIdxRef.current = 0;
      cancelledRef.current = false;

      rec.onresult = (event) => {
        let interim = "";
        let newlyFinal = "";
        for (let i = Math.max(event.resultIndex, processedIdxRef.current); i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript ?? "";
          if (result.isFinal) {
            newlyFinal += `${transcript.trim()} `;
            processedIdxRef.current = i + 1;
          } else {
            interim += transcript;
          }
        }
        if (newlyFinal.trim()) {
          finalizedRef.current = `${finalizedRef.current} ${newlyFinal.trim()}`.trim();
          onChangeRef.current(appendText(baseTextRef.current, finalizedRef.current, separator));
        }
        setInterimText(interim.trim());
      };

      rec.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setErrorMsg("Microphone permission denied. Allow mic access or upload an audio file.");
        } else if (event.error !== "aborted") {
          setErrorMsg(`Voice capture stopped (${event.error}). Try again or upload an audio clip.`);
        }
        setMode("idle");
        setInterimText("");
      };

      rec.onend = () => {
        if (cancelledRef.current) {
          onChangeRef.current(baseTextRef.current);
        }
        setMode("idle");
        setInterimText("");
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      rec.start();
      setMode("speech");
      return true;
    } catch {
      return false;
    }
  };

  const startMediaRecorder = async () => {
    if (!mediaRecordSupported) {
      setErrorMsg("Microphone recording is unavailable in this browser. Upload an audio file instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      chunksRef.current = [];
      cancelledRef.current = false;

      const mimeCandidate = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : MediaRecorder.isTypeSupported("audio/mp4")
        ? "audio/mp4"
        : "";
      const recorder = mimeCandidate
        ? new MediaRecorder(stream, { mimeType: mimeCandidate })
        : new MediaRecorder(stream);

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) {
          chunksRef.current.push(ev.data);
        }
      };

      recorder.onstop = async () => {
        stopMediaTracks();
        mediaRecorderRef.current = null;

        if (cancelledRef.current) {
          setMode("idle");
          return;
        }

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        chunksRef.current = [];

        setMode("transcribing");
        try {
          const ext = (recorder.mimeType || "").includes("mp4") ? "m4a" : "webm";
          const transcript = await transcribeAudioBlob(blob, `mic-recording.${ext}`, contextHint);
          onChangeRef.current(appendText(valueRef.current, transcript, separator));
          setStatusNotice("Voice clip transcribed.");
        } catch (err) {
          setErrorMsg(err instanceof Error ? err.message : "Could not transcribe mic recording.");
        } finally {
          setMode("idle");
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setMode("recording");
    } catch {
      stopMediaTracks();
      setErrorMsg("Microphone permission denied. Allow mic access or upload an audio file.");
      setMode("idle");
    }
  };

  const handleMicStart = () => {
    if (disabled || mode !== "idle") return;
    setErrorMsg(null);
    setStatusNotice(null);
    setInterimText("");

    if (speechSupported && startLiveSpeech()) {
      return;
    }
    void startMediaRecorder();
  };

  const handleStop = () => {
    cancelledRef.current = false;
    if (mode === "speech" && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        setMode("idle");
      }
    } else if (mode === "recording" && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        stopMediaTracks();
        setMode("idle");
      }
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setInterimText("");
    if (mode === "speech") {
      onChangeRef.current(baseTextRef.current);
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
      setMode("idle");
    } else if (mode === "recording" && mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch {
        stopMediaTracks();
        setMode("idle");
      }
    }
  };

  const handleAudioFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    setErrorMsg(null);
    setStatusNotice(null);
    setMode("transcribing");
    try {
      const transcript = await transcribeAudioBlob(file, file.name, contextHint);
      onChangeRef.current(appendText(valueRef.current, transcript, separator));
      setStatusNotice(`Transcribed ${file.name}`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Could not transcribe uploaded audio.");
    } finally {
      setMode("idle");
    }
  };

  const btnPad = compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs";

  return (
    <div className="space-y-1.5">
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.ogg,.webm,.aac"
        onChange={handleAudioFileUpload}
        className="hidden"
      />

      <div className="flex flex-wrap items-center gap-2">
        {mode === "idle" && (
          <>
            {(speechSupported || mediaRecordSupported) && (
              <button
                type="button"
                onClick={handleMicStart}
                disabled={disabled}
                className={`inline-flex items-center gap-1.5 rounded-lg bg-[#8B5CF6]/15 border border-[#8B5CF6]/45 text-[#DDD6FE] hover:bg-[#8B5CF6]/28 hover:text-white font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${btnPad}`}
              >
                <Mic className="w-3.5 h-3.5 text-[#00F5D4]" />
                {speakLabel}
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 rounded-lg bg-white/[0.05] border border-white/12 text-[#CBD5E1] hover:border-[#00F5D4]/50 hover:text-[#00F5D4] font-mono font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50 ${btnPad}`}
            >
              <Upload className="w-3.5 h-3.5 text-[#00F5D4]" />
              {uploadLabel}
            </button>
          </>
        )}

        {(mode === "speech" || mode === "recording") && (
          <>
            <span className={`inline-flex items-center gap-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/45 text-[#FCA5A5] font-mono font-semibold ${btnPad}`}>
              <AudioLines className="w-3.5 h-3.5 text-[#EF4444]" />
              {mode === "speech" ? "Listening..." : "Recording audio..."}
            </span>
            <button
              type="button"
              onClick={handleStop}
              className={`inline-flex items-center gap-1.5 rounded-lg bg-[#00F5D4] text-[#06080E] font-mono font-bold cursor-pointer whitespace-nowrap ${btnPad}`}
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className={`inline-flex items-center gap-1 rounded-lg bg-white/[0.06] border border-white/10 text-[#CBD5E1] hover:text-white font-mono cursor-pointer whitespace-nowrap ${btnPad}`}
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </>
        )}

        {mode === "transcribing" && (
          <span className={`inline-flex items-center gap-1.5 rounded-lg bg-[#00F5D4]/12 border border-[#00F5D4]/35 text-[#00F5D4] font-mono ${btnPad}`}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Transcribing audio...
          </span>
        )}

        {statusNotice && mode === "idle" && (
          <span className="text-[11px] font-mono text-[#10B981]">{statusNotice}</span>
        )}
      </div>

      {mode === "speech" && interimText && (
        <div className="rounded-lg bg-[#090C14] border border-[#00F5D4]/30 px-3 py-1.5 text-xs text-[#94A3B8]">
          <span className="font-mono text-[#00F5D4] mr-2">Interim:</span>
          <span className="italic text-[#CBD5E1]">{interimText}</span>
        </div>
      )}

      {errorMsg && <p className="text-xs text-[#F59E0B]">{errorMsg}</p>}
    </div>
  );
}

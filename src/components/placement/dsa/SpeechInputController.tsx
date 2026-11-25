import { useEffect, useRef, useState } from "react";
import { Mic, MicOff, Square, X } from "lucide-react";

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

interface SpeechInputControllerProps {
  currentText: string;
  onTextChange: (nextText: string) => void;
}

export function SpeechInputController({
  currentText,
  onTextChange,
}: SpeechInputControllerProps) {
  const [supported] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  });

  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null);
  const baseTextRef = useRef<string>("");
  const finalizedRef = useRef<string>("");
  const processedIdxRef = useRef<number>(0);
  const cancelledRef = useRef<boolean>(false);
  const onTextChangeRef = useRef(onTextChange);
  onTextChangeRef.current = onTextChange;

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup errors
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  const mergeText = (base: string, finalized: string) => {
    const trimmedBase = base.trimEnd();
    const trimmedFinal = finalized.trim();
    if (!trimmedFinal) return base;
    if (!trimmedBase) return trimmedFinal;
    return `${trimmedBase}\n${trimmedFinal}`;
  };

  const handleStart = () => {
    if (!supported || listening) return;
    setErrorMsg(null);
    setInterimText("");
    cancelledRef.current = false;

    const w = window as unknown as {
      SpeechRecognition?: SpeechRecognitionCtor;
      webkitSpeechRecognition?: SpeechRecognitionCtor;
    };
    const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!Ctor) return;

    try {
      const rec = new Ctor();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";

      baseTextRef.current = currentText;
      finalizedRef.current = "";
      processedIdxRef.current = 0;

      rec.onresult = (event) => {
        let interim = "";
        let newlyFinalized = "";

        for (let i = Math.max(event.resultIndex, processedIdxRef.current); i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result?.[0]?.transcript ?? "";
          if (result.isFinal) {
            newlyFinalized += `${transcript.trim()} `;
            processedIdxRef.current = i + 1;
          } else {
            interim += transcript;
          }
        }

        if (newlyFinalized.trim()) {
          finalizedRef.current = `${finalizedRef.current} ${newlyFinalized.trim()}`.trim();
          onTextChangeRef.current(mergeText(baseTextRef.current, finalizedRef.current));
        }
        setInterimText(interim.trim());
      };

      rec.onerror = (event) => {
        if (event.error === "not-allowed" || event.error === "service-not-allowed") {
          setErrorMsg("Microphone permission denied. Please allow mic access or type your logic.");
        } else if (event.error !== "aborted") {
          setErrorMsg(`Voice capture stopped (${event.error}). You can edit or continue typing.`);
        }
        setListening(false);
        setInterimText("");
      };

      rec.onend = () => {
        if (cancelledRef.current) {
          onTextChangeRef.current(baseTextRef.current);
        }
        setListening(false);
        setInterimText("");
        recognitionRef.current = null;
      };

      recognitionRef.current = rec;
      rec.start();
      setListening(true);
    } catch {
      setErrorMsg("Could not start microphone recognition. You can type or upload your logic instead.");
      setListening(false);
    }
  };

  const handleStop = () => {
    cancelledRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        setListening(false);
      }
    }
  };

  const handleCancel = () => {
    cancelledRef.current = true;
    setInterimText("");
    onTextChange(baseTextRef.current);
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        setListening(false);
      }
    }
    setListening(false);
  };

  if (!supported) {
    return (
      <div className="rounded-lg bg-[#090C14] border border-white/[0.07] px-3 py-2 flex items-center gap-2 text-xs text-[#94A3B8]">
        <MicOff className="w-3.5 h-3.5 text-[#F59E0B] shrink-0" />
        <span>Voice input is not supported in this browser. You can type or upload your logic instead.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {!listening ? (
          <button
            type="button"
            onClick={handleStart}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#8B5CF6]/18 border border-[#8B5CF6]/45 text-[#DDD6FE] hover:bg-[#8B5CF6]/30 hover:text-white text-xs font-mono font-semibold transition-colors cursor-pointer whitespace-nowrap"
          >
            <Mic className="w-3.5 h-3.5 text-[#00F5D4]" />
            SPEAK LOGIC
          </button>
        ) : (
          <>
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/45 text-[#FCA5A5] text-xs font-mono font-semibold">
              <Mic className="w-3.5 h-3.5 text-[#EF4444]" />
              Listening (en-US)
            </span>
            <button
              type="button"
              onClick={handleStop}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00F5D4] text-[#06080E] text-xs font-mono font-bold cursor-pointer whitespace-nowrap"
            >
              <Square className="w-3 h-3" />
              Stop
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.06] border border-white/10 text-[#CBD5E1] hover:text-white text-xs font-mono cursor-pointer whitespace-nowrap"
            >
              <X className="w-3.5 h-3.5" />
              Cancel
            </button>
          </>
        )}
      </div>

      {listening && interimText && (
        <div className="rounded-lg bg-[#090C14] border border-[#00F5D4]/30 px-3 py-2 text-xs text-[#94A3B8]">
          <span className="font-mono text-[#00F5D4] mr-2">Interim:</span>
          <span className="italic text-[#CBD5E1]">{interimText}</span>
        </div>
      )}

      {errorMsg && (
        <p className="text-xs text-[#F59E0B]">{errorMsg}</p>
      )}
    </div>
  );
}

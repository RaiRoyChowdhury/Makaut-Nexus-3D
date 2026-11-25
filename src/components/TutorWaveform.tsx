import { Volume2, VolumeX } from "lucide-react";

interface TutorWaveformProps {
  supported: boolean;
  enabled: boolean;
  speaking: boolean;
  onToggle?: () => void;
  compact?: boolean;
}

export function TutorWaveform({
  supported,
  enabled,
  speaking,
  onToggle,
  compact = false,
}: TutorWaveformProps) {
  const heights = speaking ? ["h-3", "h-4", "h-2.5", "h-3.5"] : ["h-1.5", "h-2", "h-1.5", "h-2"];

  return (
    <div className="inline-flex items-center gap-2 shrink-0">
      <div
        className="flex items-center gap-0.5 h-4 px-1.5 rounded bg-white/[0.04] border border-white/[0.06]"
        aria-label={
          !supported
            ? "Voice unsupported"
            : !enabled
            ? "Tutor voice muted"
            : speaking
            ? "Tutor speaking"
            : "Tutor idle"
        }
      >
        {heights.map((h, i) => (
          <span
            key={i}
            className={`w-0.5 rounded-full transition-all duration-150 ${
              !supported || !enabled
                ? "h-1 bg-[#475569]"
                : speaking
                ? `${h} bg-[#00F5D4] animate-pulse`
                : "h-1.5 bg-[#00F5D4]/45"
            }`}
            style={speaking ? { animationDelay: `${i * 110}ms` } : undefined}
          />
        ))}
      </div>

      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          disabled={!supported}
          title={
            !supported
              ? "Speech synthesis unavailable in this browser"
              : enabled
              ? "Mute AI Tutor Voice"
              : "Enable AI Tutor Voice"
          }
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[10px] font-mono font-semibold transition-colors whitespace-nowrap shrink-0 ${
            !supported
              ? "bg-white/[0.04] border-white/10 text-[#64748B] cursor-not-allowed"
              : enabled
              ? "bg-[#00F5D4]/15 border-[#00F5D4]/45 text-[#00F5D4] hover:bg-[#00F5D4]/25 cursor-pointer"
              : "bg-white/[0.05] border-white/15 text-[#94A3B8] hover:text-[#F4F7FB] cursor-pointer"
          }`}
        >
          {enabled && supported ? (
            <Volume2 className="w-3 h-3 shrink-0" />
          ) : (
            <VolumeX className="w-3 h-3 shrink-0" />
          )}
          {!compact && (
            <span>
              {!supported ? "VOICE N/A" : enabled ? "TUTOR VOICE ON" : "TUTOR VOICE MUTED"}
            </span>
          )}
        </button>
      )}
    </div>
  );
}

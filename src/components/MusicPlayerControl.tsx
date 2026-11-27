import { useEffect, useRef, useState } from "react";
import { ChevronDown, Disc3, Pause, Play, Volume1, Volume2 } from "lucide-react";
import {
  MUSIC_TRACKS,
  MusicEngineState,
  MusicTrackId,
  musicEngine,
} from "../services/musicEngine";

export function MusicPlayerControl() {
  const [state, setState] = useState<MusicEngineState>(() => musicEngine.getState());
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return musicEngine.subscribe(setState);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleEsc);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleEsc);
    };
  }, [open]);

  const activeTrack = MUSIC_TRACKS.find((t) => t.id === state.trackId) ?? MUSIC_TRACKS[0];
  const volumePct = Math.round(state.volume * 100);

  const handleSelectTrack = (id: MusicTrackId) => {
    musicEngine.setTrack(id);
    if (!state.playing) {
      void musicEngine.play();
    }
  };

  if (!state.supported) {
    return null;
  }

  return (
    <div ref={containerRef} className="relative shrink-0">
      <div
        className={`inline-flex items-center rounded-lg border transition-colors ${
          state.playing
            ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/45 text-[#E9D5FF]"
            : "bg-white/[0.05] border-white/15 text-[#94A3B8]"
        }`}
      >
        <button
          type="button"
          onClick={() => musicEngine.toggle()}
          aria-label={state.playing ? `Pause ${activeTrack.title}` : `Play ${activeTrack.title}`}
          title={
            state.playing
              ? `Playing ${activeTrack.title} — Click to pause`
              : `Play ambient focus music (${activeTrack.title})`
          }
          className="inline-flex items-center gap-1.5 pl-1.5 pr-1 py-1.5 sm:pl-2.5 sm:pr-2 sm:py-2 text-[11px] font-mono font-semibold hover:text-[#F4F7FB] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5D4] rounded-l-lg"
        >
          {state.playing ? (
            <Pause className="w-3.5 h-3.5 text-[#C4B5FD]" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          <span className="hidden 2xl:inline">
            {state.playing ? "MUSIC ON" : "MUSIC"}
          </span>
        </button>

        <span className="w-px h-4 bg-white/15" aria-hidden="true" />

        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label="Choose music track and volume"
          title="Music tracks & volume"
          className="inline-flex items-center px-1 sm:px-1.5 py-1.5 sm:py-2 hover:text-[#F4F7FB] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00F5D4] rounded-r-lg"
        >
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform duration-150 ${
              open ? "rotate-180" : ""
            }`}
          />
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-label="Focus Music Controls"
          className="fixed inset-x-4 top-[4.5rem] sm:inset-x-auto sm:top-auto sm:absolute sm:right-0 sm:mt-2 sm:w-72 rounded-xl border border-white/15 bg-[#0B0F19]/98 p-4 shadow-2xl z-50 backdrop-blur-md"
        >
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="flex items-center gap-2">
              <Disc3
                className={`w-4 h-4 ${
                  state.playing ? "text-[#C4B5FD]" : "text-[#94A3B8]"
                }`}
              />
              <span className="text-xs font-semibold text-[#F4F7FB]">
                Focus Soundtrack
              </span>
            </div>
            <button
              type="button"
              onClick={() => musicEngine.toggle()}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                state.playing
                  ? "bg-[#8B5CF6] text-white hover:bg-[#7C3AED]"
                  : "bg-white/10 text-[#F4F7FB] hover:bg-white/20"
              }`}
            >
              {state.playing ? (
                <>
                  <Pause className="w-3 h-3" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-3 h-3" />
                  Play
                </>
              )}
            </button>
          </div>

          <div className="space-y-1.5 mb-4">
            {MUSIC_TRACKS.map((track) => {
              const selected = track.id === state.trackId;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() => handleSelectTrack(track.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg border transition-colors cursor-pointer ${
                    selected
                      ? "bg-[#8B5CF6]/15 border-[#8B5CF6]/50 text-[#F4F7FB]"
                      : "bg-white/[0.02] border-white/[0.06] text-[#94A3B8] hover:bg-white/[0.06] hover:text-[#F4F7FB]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium">{track.title}</span>
                    <span className="text-[11px] font-mono tabular-nums text-[#94A3B8]">
                      {track.bpm} BPM
                    </span>
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">
                    {track.subtitle}
                  </p>
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-white/10">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <label
                htmlFor="nexus-music-volume"
                className="inline-flex items-center gap-1.5 text-[#94A3B8] font-medium"
              >
                {volumePct > 50 ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#C4B5FD]" />
                ) : (
                  <Volume1 className="w-3.5 h-3.5 text-[#C4B5FD]" />
                )}
                Music Volume
              </label>
              <span className="font-mono tabular-nums text-[#F4F7FB]">
                {volumePct}%
              </span>
            </div>
            <input
              id="nexus-music-volume"
              type="range"
              min={0}
              max={100}
              value={volumePct}
              onChange={(e) => musicEngine.setVolume(Number(e.target.value) / 100)}
              className="w-full accent-[#8B5CF6] cursor-pointer"
            />
            <p className="text-[11px] text-[#64748B] mt-2">
              {state.ducked && state.playing
                ? "Volume lowered while Tutor Voice speaks."
                : "Automatically lowers when Tutor Voice speaks."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

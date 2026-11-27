import { tutorVoice } from "./tutorVoice";

export type MusicTrackId = "nexus-orbital" | "deep-focus" | "boss-synth";

export interface MusicTrackMeta {
  id: MusicTrackId;
  title: string;
  subtitle: string;
  bpm: number;
}

export const MUSIC_TRACKS: MusicTrackMeta[] = [
  {
    id: "nexus-orbital",
    title: "Orbital Lo-Fi",
    subtitle: "Warm ambient pads for Sem 3 Labs",
    bpm: 76,
  },
  {
    id: "deep-focus",
    title: "Deep Logic Flow",
    subtitle: "Minimal harmonic focus for DSA & coding",
    bpm: 66,
  },
  {
    id: "boss-synth",
    title: "Arena Synth",
    subtitle: "Focused pulse for Aptitude & Boss Duel",
    bpm: 104,
  },
];

export interface MusicEngineState {
  playing: boolean;
  trackId: MusicTrackId;
  volume: number; // 0 to 1
  ducked: boolean;
  supported: boolean;
}

type MusicListener = (state: MusicEngineState) => void;

const STORAGE_KEY = "makaut_nexus_3d_music_v1";

interface SavedMusicPrefs {
  trackId?: MusicTrackId;
  volume?: number;
}

function loadPrefs(): Required<SavedMusicPrefs> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { trackId: "nexus-orbital", volume: 0.45 };
    const parsed = JSON.parse(raw) as SavedMusicPrefs;
    const validTrack = MUSIC_TRACKS.some((t) => t.id === parsed.trackId)
      ? (parsed.trackId as MusicTrackId)
      : "nexus-orbital";
    const validVol =
      typeof parsed.volume === "number" && Number.isFinite(parsed.volume)
        ? Math.min(1, Math.max(0, parsed.volume))
        : 0.45;
    return { trackId: validTrack, volume: validVol };
  } catch {
    return { trackId: "nexus-orbital", volume: 0.45 };
  }
}

function savePrefs(trackId: MusicTrackId, volume: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trackId, volume }));
  } catch {
    // ignore storage quota errors
  }
}

// MIDI note number to frequency in Hz
function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface TrackPattern {
  stepMs: number;
  chords: number[][]; // 4-bar chord progression (MIDI notes)
  arp: number[]; // step offsets/MIDI notes
  bass: number[]; // bass MIDI notes per chord
  padType: OscillatorType;
  arpType: OscillatorType;
  filterCutoff: number;
}

const PATTERNS: Record<MusicTrackId, TrackPattern> = {
  "nexus-orbital": {
    stepMs: Math.round((60 / 76 / 2) * 1000), // 8th notes at 76 BPM (~395ms)
    // F#m9 -> DM9 -> Bm7 -> C#m7
    chords: [
      [54, 61, 64, 68],
      [50, 57, 61, 66],
      [47, 54, 57, 62],
      [49, 56, 59, 64],
    ],
    arp: [73, 76, 80, 76, 78, 76, 73, 71],
    bass: [42, 38, 35, 37],
    padType: "triangle",
    arpType: "sine",
    filterCutoff: 1150,
  },
  "deep-focus": {
    stepMs: Math.round((60 / 66 / 2) * 1000), // 8th notes at 66 BPM (~455ms)
    // Cmaj9 -> Am9 -> Fmaj7 -> G6
    chords: [
      [48, 55, 59, 62],
      [45, 52, 55, 59],
      [41, 48, 52, 57],
      [43, 50, 55, 59],
    ],
    arp: [72, 76, 79, 83, 79, 76, 74, 71],
    bass: [36, 33, 29, 31],
    padType: "sine",
    arpType: "triangle",
    filterCutoff: 950,
  },
  "boss-synth": {
    stepMs: Math.round((60 / 104 / 2) * 1000), // 8th notes at 104 BPM (~288ms)
    // Em -> Cmaj7 -> D -> Bm
    chords: [
      [52, 59, 62, 67],
      [48, 55, 59, 64],
      [50, 57, 62, 66],
      [47, 54, 59, 62],
    ],
    arp: [64, 71, 74, 76, 79, 76, 74, 71],
    bass: [40, 36, 38, 35],
    padType: "sawtooth",
    arpType: "triangle",
    filterCutoff: 1450,
  },
};

class AmbientMusicEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private dryFilter: BiquadFilterNode | null = null;
  private delayNode: DelayNode | null = null;
  private delayFeedback: GainNode | null = null;

  private playing = false;
  private trackId: MusicTrackId;
  private volume: number;
  private ducked = false;
  private stepIndex = 0;
  private timerId: number | null = null;
  private listeners = new Set<MusicListener>();
  private unsubVoice: (() => void) | null = null;

  constructor() {
    const prefs = loadPrefs();
    this.trackId = prefs.trackId;
    this.volume = prefs.volume;

    if (typeof window !== "undefined") {
      this.unsubVoice = tutorVoice.subscribe((speaking) => {
        if (this.ducked !== speaking) {
          this.ducked = speaking;
          this.updateGainSmooth();
          this.emit();
        }
      });
    }
  }

  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      ("AudioContext" in window || "webkitAudioContext" in window)
    );
  }

  public getState(): MusicEngineState {
    return {
      playing: this.playing,
      trackId: this.trackId,
      volume: this.volume,
      ducked: this.ducked,
      supported: this.isSupported(),
    };
  }

  public subscribe(fn: MusicListener): () => void {
    this.listeners.add(fn);
    fn(this.getState());
    return () => {
      this.listeners.delete(fn);
    };
  }

  private emit() {
    const snapshot = this.getState();
    this.listeners.forEach((fn) => fn(snapshot));
  }

  private ensureGraph(): boolean {
    if (!this.isSupported()) return false;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0;

      this.dryFilter = this.ctx.createBiquadFilter();
      this.dryFilter.type = "lowpass";
      this.dryFilter.frequency.value = PATTERNS[this.trackId].filterCutoff;
      this.dryFilter.Q.value = 0.7;

      // Subtle warm stereo-like echo
      this.delayNode = this.ctx.createDelay(1.0);
      this.delayNode.delayTime.value = 0.36;

      this.delayFeedback = this.ctx.createGain();
      this.delayFeedback.gain.value = 0.26;

      const delayFilter = this.ctx.createBiquadFilter();
      delayFilter.type = "lowpass";
      delayFilter.frequency.value = 900;

      const wetGain = this.ctx.createGain();
      wetGain.gain.value = 0.28;

      this.dryFilter.connect(this.masterGain);
      this.dryFilter.connect(this.delayNode);
      this.delayNode.connect(delayFilter);
      delayFilter.connect(this.delayFeedback);
      this.delayFeedback.connect(this.delayNode);
      delayFilter.connect(wetGain);
      wetGain.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);
    }
    return true;
  }

  private targetGain(): number {
    if (!this.playing) return 0;
    const base = this.volume * 0.42; // calibrated comfortable headroom
    return this.ducked ? base * 0.22 : base;
  }

  private updateGainSmooth() {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setTargetAtTime(this.targetGain(), now, 0.14);
  }

  public async play(): Promise<void> {
    if (!this.ensureGraph() || !this.ctx) return;
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        return;
      }
    }
    if (this.dryFilter) {
      this.dryFilter.frequency.setTargetAtTime(
        PATTERNS[this.trackId].filterCutoff,
        this.ctx.currentTime,
        0.15
      );
    }
    this.playing = true;
    this.updateGainSmooth();
    this.startScheduler();
    this.emit();
  }

  public pause(): void {
    this.playing = false;
    this.stopScheduler();
    this.updateGainSmooth();
    this.emit();
  }

  public toggle(): void {
    if (this.playing) {
      this.pause();
    } else {
      void this.play();
    }
  }

  public setTrack(trackId: MusicTrackId): void {
    if (this.trackId === trackId) return;
    this.trackId = trackId;
    this.stepIndex = 0;
    savePrefs(this.trackId, this.volume);
    if (this.ctx && this.dryFilter) {
      this.dryFilter.frequency.setTargetAtTime(
        PATTERNS[trackId].filterCutoff,
        this.ctx.currentTime,
        0.2
      );
    }
    if (this.playing) {
      this.startScheduler();
    }
    this.emit();
  }

  public setVolume(vol: number): void {
    const clamped = Math.min(1, Math.max(0, vol));
    this.volume = clamped;
    savePrefs(this.trackId, this.volume);
    this.updateGainSmooth();
    this.emit();
  }

  private startScheduler() {
    this.stopScheduler();
    const pattern = PATTERNS[this.trackId];
    // Trigger immediately on start for zero perceived latency
    this.triggerStep();
    this.timerId = window.setInterval(() => {
      if (this.playing) {
        this.triggerStep();
      }
    }, pattern.stepMs);
  }

  private stopScheduler() {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  private triggerStep() {
    if (!this.ctx || !this.dryFilter || !this.playing) return;
    const pattern = PATTERNS[this.trackId];
    const now = this.ctx.currentTime;
    const stepInBar = this.stepIndex % 8;
    const chordIdx = Math.floor(this.stepIndex / 8) % pattern.chords.length;

    // 1. Warm chord pad on beat 0 of every 8-step bar
    if (stepInBar === 0) {
      const chord = pattern.chords[chordIdx];
      const padDuration = (pattern.stepMs * 8) / 1000;
      chord.forEach((midi, i) => {
        this.playVoice(
          midiToFreq(midi),
          pattern.padType,
          0.075,
          0.25,
          padDuration * 0.95,
          (i - 1.5) * 2.2 // subtle detune in cents
        );
      });

      // Soft sub bass root
      this.playVoice(
        midiToFreq(pattern.bass[chordIdx]),
        "sine",
        0.16,
        0.08,
        padDuration * 0.85,
        0
      );
    }

    // 2. Boss Synth extra rhythmic bass pulse on even 8th notes
    if (this.trackId === "boss-synth" && stepInBar % 2 === 0 && stepInBar > 0) {
      this.playVoice(
        midiToFreq(pattern.bass[chordIdx] + (stepInBar === 4 ? 12 : 0)),
        "triangle",
        0.11,
        0.015,
        (pattern.stepMs * 1.4) / 1000,
        0
      );
    }

    // 3. Delicate melodic pluck / arpeggio
    const playArp =
      this.trackId === "boss-synth"
        ? true
        : this.trackId === "nexus-orbital"
        ? stepInBar % 2 === 0 || stepInBar === 5
        : stepInBar === 0 || stepInBar === 3 || stepInBar === 6;

    if (playArp) {
      const arpNote = pattern.arp[(this.stepIndex + chordIdx) % pattern.arp.length];
      // Slight pentatonic transpose based on chord index for natural movement
      const chordShift = chordIdx === 1 ? -2 : chordIdx === 2 ? -4 : chordIdx === 3 ? -3 : 0;
      const freq = midiToFreq(arpNote + (this.trackId === "deep-focus" ? chordShift : 0));
      const arpDur = this.trackId === "boss-synth" ? 0.24 : 0.65;
      this.playVoice(freq, pattern.arpType, 0.085, 0.015, arpDur, 0, now);
    }

    this.stepIndex = (this.stepIndex + 1) % (pattern.chords.length * 8);
  }

  private playVoice(
    freq: number,
    type: OscillatorType,
    peakGain: number,
    attackSec: number,
    durationSec: number,
    detuneCents: number,
    startTime?: number
  ) {
    if (!this.ctx || !this.dryFilter) return;
    const t0 = startTime ?? this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const env = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (detuneCents !== 0) {
      osc.detune.setValueAtTime(detuneCents, t0);
    }

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peakGain, t0 + attackSec);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + durationSec);

    osc.connect(env);
    env.connect(this.dryFilter);

    osc.start(t0);
    osc.stop(t0 + durationSec + 0.04);
  }

  public dispose() {
    this.stopScheduler();
    if (this.unsubVoice) {
      this.unsubVoice();
      this.unsubVoice = null;
    }
    if (this.ctx) {
      void this.ctx.close();
      this.ctx = null;
    }
  }
}

export const musicEngine = new AmbientMusicEngine();

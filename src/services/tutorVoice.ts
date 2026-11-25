type SpeakingListener = (speaking: boolean) => void;

class TutorVoiceController {
  private speaking = false;
  private listeners = new Set<SpeakingListener>();
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private fallbackTimer: number | null = null;

  public isSupported(): boolean {
    return (
      typeof window !== "undefined" &&
      "speechSynthesis" in window &&
      typeof SpeechSynthesisUtterance !== "undefined"
    );
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public subscribe(fn: SpeakingListener): () => void {
    this.listeners.add(fn);
    fn(this.speaking);
    return () => {
      this.listeners.delete(fn);
    };
  }

  private setSpeaking(val: boolean) {
    if (this.speaking === val) return;
    this.speaking = val;
    this.listeners.forEach((fn) => fn(val));
  }

  private clearFallbackTimer() {
    if (this.fallbackTimer !== null) {
      window.clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private pickClearEnglishVoice(): SpeechSynthesisVoice | null {
    if (!this.isSupported()) return null;
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) return null;
    return (
      voices.find((v) => v.lang.startsWith("en") && /google|natural|samantha|daniel|aria/i.test(v.name)) ||
      voices.find((v) => v.lang.startsWith("en-")) ||
      voices[0]
    );
  }

  public cancel(): void {
    this.clearFallbackTimer();
    this.currentUtterance = null;
    this.setSpeaking(false);
    if (this.isSupported()) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore speechSynthesis errors on restricted environments
      }
    }
  }

  public speak(text: string, enabled: boolean): void {
    this.cancel();
    if (!enabled || !text.trim() || !this.isSupported()) {
      return;
    }

    try {
      const cleanText = text.trim().replace(/\s+/g, " ");
      const utterance = new SpeechSynthesisUtterance(cleanText);
      utterance.lang = "en-US";
      utterance.rate = 1.02;
      utterance.pitch = 1.0;

      const voice = this.pickClearEnglishVoice();
      if (voice) utterance.voice = voice;

      this.currentUtterance = utterance;

      utterance.onstart = () => {
        if (this.currentUtterance !== utterance) return;
        this.setSpeaking(true);
      };

      utterance.onend = () => {
        if (this.currentUtterance !== utterance) return;
        this.clearFallbackTimer();
        this.currentUtterance = null;
        this.setSpeaking(false);
      };

      utterance.onerror = () => {
        if (this.currentUtterance !== utterance) return;
        this.clearFallbackTimer();
        this.currentUtterance = null;
        this.setSpeaking(false);
      };

      // Safety watchdog in case a browser swallows onend
      this.fallbackTimer = window.setTimeout(() => {
        if (this.currentUtterance === utterance) {
          this.currentUtterance = null;
          this.setSpeaking(false);
        }
      }, Math.min(14000, Math.max(4000, cleanText.length * 95)));

      this.setSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      this.cancel();
    }
  }
}

export const tutorVoice = new TutorVoiceController();

import { markClientRateLimited } from "./aiService";

const ALLOWED_AUDIO_MIMES = new Set([
  "audio/mp3",
  "audio/mpeg",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/webm",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/flac",
]);

export function resolveAudioMime(blob: Blob, fileName?: string): string {
  const rawType = (blob.type || "").split(";")[0].trim().toLowerCase();
  if (rawType && ALLOWED_AUDIO_MIMES.has(rawType)) {
    return rawType;
  }
  const lower = (fileName || "").toLowerCase();
  if (lower.endsWith(".mp3")) return "audio/mp3";
  if (lower.endsWith(".wav")) return "audio/wav";
  if (lower.endsWith(".webm")) return "audio/webm";
  if (lower.endsWith(".ogg")) return "audio/ogg";
  if (lower.endsWith(".m4a") || lower.endsWith(".mp4")) return "audio/mp4";
  if (lower.endsWith(".aac")) return "audio/aac";
  if (lower.endsWith(".flac")) return "audio/flac";
  return rawType;
}

export async function transcribeAudioBlob(
  blob: Blob,
  fileName = "voice-note.webm",
  contextHint = ""
): Promise<string> {
  const mimeType = resolveAudioMime(blob, fileName);
  if (!ALLOWED_AUDIO_MIMES.has(mimeType)) {
    throw new Error("Unsupported audio format. Use MP3, WAV, M4A, WEBM, OGG, or AAC.");
  }
  if (blob.size > 4 * 1024 * 1024) {
    throw new Error("Audio file exceeds the 4 MB size limit.");
  }
  if (blob.size < 200) {
    throw new Error("Audio clip was too short or empty.");
  }

  const base64Data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const idx = dataUrl.indexOf(",");
      if (idx === -1) {
        reject(new Error("Could not encode audio data."));
        return;
      }
      resolve(dataUrl.slice(idx + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read audio clip."));
    reader.readAsDataURL(blob);
  });

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 22000);

  try {
    const res = await fetch("/api/ai/transcribe-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        mimeType,
        base64Data,
        fileName,
        contextHint,
      }),
    });

    if (res.status === 429) {
      const errData = await res.clone().json().catch(() => ({}));
      markClientRateLimited(errData?.retryAfterSeconds ?? 15);
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.transcript) {
      throw new Error(data?.error || "Could not transcribe audio. Try speaking again or typing.");
    }
    return String(data.transcript).trim();
  } finally {
    window.clearTimeout(timer);
  }
}

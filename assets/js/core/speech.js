let enabled = true;
let selectedVoiceName = "Zira";

export function setSpeechEnabled(value) {
  enabled = Boolean(value);
  if (!enabled && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeechSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function setPreferredVoice(name) {
  selectedVoiceName = typeof name === "string" ? name : "";
}

export function getEnglishVoices() {
  if (!isSpeechSupported()) return [];
  return window.speechSynthesis.getVoices()
    .filter(voice => /^en[-_]/i.test(voice.lang || ""))
    .filter((voice, index, voices) => voices.findIndex(item => item.name === voice.name) === index)
    .sort((a, b) => {
      const quality = voice => /natural|neural|enhanced|premium/i.test(voice.name) ? 1 : 0;
      return quality(b) - quality(a) || a.name.localeCompare(b.name);
    });
}

export function speak(text, { lang = "en-US", rate = 0.56, pitch = 1.04 } = {}) {
  if (!enabled || !text || !isSpeechSupported()) return false;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(String(text));
  utterance.lang = lang;
  utterance.rate = rate;
  utterance.pitch = pitch;

  const voices = window.speechSynthesis.getVoices();
  const exactCandidates = voices.filter(voice => voice.lang?.toLowerCase() === lang.toLowerCase());
  const candidates = exactCandidates.length
    ? exactCandidates
    : voices.filter(voice => voice.lang?.toLowerCase().startsWith(lang.slice(0, 2).toLowerCase()));

  const preferredVoice = candidates.find(voice => /microsoft zira/i.test(voice.name))
    || candidates.find(voice => /^zira/i.test(voice.name))
    || candidates.find(voice => voice.name === selectedVoiceName);

  if (preferredVoice) utterance.voice = preferredVoice;
  window.speechSynthesis.speak(utterance);
  return true;
}

export function stopSpeech() { if (isSpeechSupported()) window.speechSynthesis.cancel(); }

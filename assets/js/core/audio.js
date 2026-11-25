let enabled = true;
let audioContext;

export function setAudioEnabled(value) {
  enabled = Boolean(value);
}

function getAudioContext() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ||= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function playTone(frequency, startTime, duration, type = "sine") {
  const context = getAudioContext();
  if (!context || !enabled) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(0.12, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

export function playCorrectSound() {
  if (!enabled) return;
  const context = getAudioContext();
  if (!context) return;
  playTone(660, context.currentTime, 0.12);
  playTone(880, context.currentTime + 0.12, 0.18);
}

export function playTryAgainSound() {
  if (!enabled) return;
  const context = getAudioContext();
  if (!context) return;
  playTone(330, context.currentTime, 0.16, "triangle");
}

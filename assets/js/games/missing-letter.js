import { pickRandom, shuffle } from "../core/random.js";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

export function createMissingLetterQuestion() {
  const start = Math.floor(Math.random() * (ALPHABET.length - 3));
  const sequence = ALPHABET.slice(start, start + 4);
  const missingIndex = 1 + Math.floor(Math.random() * 2);
  const answer = sequence[missingIndex];
  const visible = sequence.map((letter, index) => index === missingIndex ? "?" : letter);
  const distractors = shuffle(ALPHABET.filter((letter) => !sequence.includes(letter))).slice(0, 2);

  return {
    type: "choice",
    prompt: "Which letter is missing?",
    instruction: "Tìm chữ cái còn thiếu trong dãy nhé.",
    sequence: visible,
    options: shuffle([answer, ...distractors]),
    answer,
    speak: "Which letter is missing?",
    success: `Great! The missing letter is ${answer}.`,
    hint: "Say the alphabet slowly from left to right."
  };
}

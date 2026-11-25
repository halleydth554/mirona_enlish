import { LESSON_WORDS } from "../data/lesson.js";
import { pickRandom, shuffle } from "../core/random.js";

export function createPictureQuestion(usedWords = []) {
  const available = LESSON_WORDS.filter((item) => !usedWords.includes(item.word));
  const item = pickRandom(available.length ? available : LESSON_WORDS);
  const distractors = shuffle(LESSON_WORDS.filter((entry) => entry.word !== item.word)).slice(0, 2);

  return {
    type: "choice",
    prompt: "What is it?",
    instruction: "Nhìn hình và chọn từ tiếng Anh đúng nhé.",
    display: item.emoji,
    displayLabel: "MYSTERY PICTURE",
    options: shuffle([item.word, ...distractors.map((entry) => entry.word)]),
    answer: item.word,
    speak: item.word,
    success: item.word.toUpperCase(),
    hint: "Listen again and choose the picture word.",
    detail: `${item.upper} ${item.lower} · ${item.word}`
  };
}

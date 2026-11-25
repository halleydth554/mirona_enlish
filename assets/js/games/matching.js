import { LESSON_WORDS } from "../data/lesson.js";
import { pickRandom, shuffle } from "../core/random.js";

export function createMatchingQuestion(usedLetters = [], round = 1) {
  const available = LESSON_WORDS.filter(({ upper }) => !usedLetters.includes(upper));
  const item = pickRandom(available.length ? available : LESSON_WORDS);
  const distractors = shuffle(LESSON_WORDS.filter(({ upper }) => upper !== item.upper)).slice(0, 2);
  const mode = round <= 4 ? "lower" : round <= 8 ? "upper" : "listen";
  const format = (entry) => mode === "listen" ? `${entry.upper}${entry.lower}` : entry[mode];
  const settings = {
    lower: { prompt: `Find the small letter ${item.upper}!`, instruction: "Chọn chữ thường tương ứng nhé.", display: item.upper, displayLabel: "CAPITAL LETTER", optionLabel: "SMALL LETTER", speak: `Find the small letter ${item.upper}.` },
    upper: { prompt: `Find the capital letter ${item.upper}!`, instruction: "Chọn chữ hoa tương ứng nhé.", display: item.lower, displayLabel: "SMALL LETTER", optionLabel: "CAPITAL LETTER", speak: `Find the capital letter ${item.upper}.` },
    listen: { prompt: "Listen and choose!", instruction: "Bấm loa, nghe tên chữ cái rồi chọn cặp chữ đúng.", display: "", displayLabel: "LISTEN", optionLabel: "LETTER PAIR", speak: `The letter is ${item.upper}. ${item.upper}.` }
  };
  return {
    type: "choice", mode, letterId: item.upper, ...settings[mode],
    options: shuffle([item, ...distractors].map(format)),
    answer: format(item),
    success: `It's letter ${item.upper}. Great job!`,
    hint: mode === "listen" ? "Hear the question again and say the letter out loud." : "Look at the letter shape and the writing lines."
  };
}

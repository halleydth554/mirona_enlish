export function pickRandom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

export function shuffle(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function sample(items, count, excluded = []) {
  const available = items.filter((_, index) => !excluded.includes(index));
  return shuffle(available).slice(0, count);
}

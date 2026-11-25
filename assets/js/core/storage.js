const STORAGE_KEY = "my-alphabet-world:v1";

const DEFAULT_STATE = {
  learnerName: "",
  soundEnabled: true,
  voiceName: "Zira",
  completedGames: {},
  totalStars: 0
};

function safeParse(value) {
  try {
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

export function loadSavedState() {
  if (typeof window === "undefined" || !window.localStorage) {
    return { ...DEFAULT_STATE };
  }

  const saved = safeParse(window.localStorage.getItem(STORAGE_KEY));
  return {
    ...DEFAULT_STATE,
    ...(saved && typeof saved === "object" ? saved : {}),
    completedGames: saved?.completedGames && typeof saved.completedGames === "object"
      ? saved.completedGames
      : {}
  };
}

export function saveState(state) {
  if (typeof window === "undefined" || !window.localStorage) return false;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
      learnerName: state.learnerName || "",
      soundEnabled: Boolean(state.soundEnabled),
      voiceName: "Zira",
      completedGames: state.completedGames || {},
      totalStars: Number(state.totalStars) || 0
    }));
    return true;
  } catch {
    return false;
  }
}

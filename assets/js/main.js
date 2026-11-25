import { online, db, check, login, identity, saveAttempt, logoutStudent, getProgress } from "./services/backend.js";
import { speakingRounds, mountSpeaking, stopRecording } from "./games/speaking.js";
import { LESSON_WORDS, GAME_CATALOG, LESSON_QUESTION } from "./data/lesson.js";
import { loadSavedState, saveState } from "./core/storage.js";
import { speak, setSpeechEnabled, stopSpeech, setPreferredVoice } from "./core/speech.js";
import { playCorrectSound, playTryAgainSound, setAudioEnabled } from "./core/audio.js";
import { createMatchingQuestion } from "./games/matching.js";
import { createPictureQuestion } from "./games/picture-quest.js";
import { createMissingLetterQuestion } from "./games/missing-letter.js";

import { renderHome, renderLibrary, renderGameView, renderCompletion, calculateStars } from "./ui/templates.js";

let student = null;
const app = document.querySelector("#app");
const soundToggle = document.querySelector("#sound-toggle");
const soundIcon = document.querySelector("#sound-icon");
const soundLabel = document.querySelector("#sound-label");

const saved = loadSavedState();
const state = {
  screen: "home",
  learnerName: saved.learnerName || "",
  soundEnabled: saved.soundEnabled !== false,
  voiceName: "Zira",
  completedGames: Object.fromEntries(Object.entries(saved.completedGames || {}).filter(([key])=>key!=="spelling")),
  totalStars: saved.totalStars || 0,
  session: null
};

const GAME_ROUNDS = {
  matching: 10,
  picture: 10,
  missing: 10,
  speaking: 5
};

setAudioEnabled(state.soundEnabled);
setSpeechEnabled(state.soundEnabled);
setPreferredVoice("Zira");
syncSoundButton();
initialize();

async function initialize(){
 if(!online){render();return;}
 try{student=await identity();if(student){state.learnerName=student.display_name||state.learnerName;persist();const rows=await getProgress();state.completedGames={};for(const r of rows){const old=state.completedGames[r.challenge];if(!old||r.stars>old.stars)state.completedGames[r.challenge]={stars:r.stars,bestScore:r.score};}render();return;}}catch(e){console.error(e);}
 render();
 showNameEntry();
}

function showNameEntry(){
 const existing=app.querySelector('#student-name-entry');
 if(existing){existing.querySelector('input')?.focus();existing.scrollIntoView({behavior:'smooth',block:'center'});return;}
 const panel=document.createElement('section');
 panel.id='student-name-entry';
 panel.className='game-card';
 panel.innerHTML=`<h2>Enter student name</h2><form id="student-name-form"><input class="name-input" name="name" placeholder="Student name" maxlength="40" value="${String(state.learnerName||'').replace(/[&<>"']/g,'')}" required><button class="button button-primary">Save name &amp; start</button><p id="login-error" role="status"></p></form>`;
 app.prepend(panel);
 panel.querySelector('form').onsubmit=async e=>{
  e.preventDefault();
  const name=new FormData(e.target).get('name');
  try{await login(name);student=await identity();state.learnerName=student?.display_name||String(name).trim();persist();await initialize();}
  catch(err){panel.querySelector('#login-error').textContent=err.message;}
 };
 panel.querySelector('input')?.focus();
}

function persist() {
  state.totalStars = Object.values(state.completedGames).reduce((sum, game) => sum + (game.stars || 0), 0);
  saveState(state);
}

function syncSoundButton() {
  soundToggle.setAttribute("aria-pressed", String(state.soundEnabled));
  soundIcon.textContent = state.soundEnabled ? "🔊" : "🔇";
  soundLabel.textContent = state.soundEnabled ? "Sound on" : "Sound off";
}

function render() {
  if (state.screen === "home") {
    app.innerHTML = renderHome(state);
    if(online){const toolbar=document.createElement("div");toolbar.className="student-name-toolbar";const b=document.createElement("button");b.className="button student-name-button";b.type="button";b.textContent="Change student name";b.onclick=()=>showNameEntry();toolbar.append(b);app.append(toolbar);}else{app.insertAdjacentHTML("afterbegin",'<p class="parent-note">Local demo – kết quả chưa gửi giáo viên.</p>');}
  } else if (state.screen === "library") {
    app.innerHTML = renderLibrary();
  } else if (state.screen === "game") {
    if(state.session.game.id === "speaking") mountSpeaking(app,state.session,{student,next:nextRound,render});
    else app.innerHTML = renderGameView(state.session);
  } else if (state.screen === "complete") {
    app.innerHTML = renderCompletion(state.session);
  }
}

function startGame(gameId) {
  stopRecording();
  const game = GAME_CATALOG.find((item) => item.id === gameId);
  if (!game) return;

  const totalRounds = GAME_ROUNDS[gameId];
  const words = gameId === "speaking" ? speakingRounds() : [];

  state.session = {
    game,
    round: 1,
    totalRounds,
    score: 0,
    attempts: 0,
    answered: false,
    feedback: null,
    hintVisible: false,
    used: [],
    question: null,
    chosen: [],
    words, id: crypto.randomUUID(), startedAt:new Date().toISOString(), results:[]
  };

  loadQuestion();
  state.screen = "game";
  render();
  speakCurrentQuestion();
}

function loadQuestion() {
  const session = state.session;
  session.questionStarted=Date.now();
  session.answered = false;
  session.feedback = null;
  session.hintVisible = false;
  session.attempts = 0;
  session.chosen = [];
  session.listening = false;
  session.voiceStatus = "";
  session.voiceTranscript = "";

  if (session.game.id === "matching") {
    session.question = createMatchingQuestion(session.used, session.round);
  } else if (session.game.id === "picture") {
    session.question = createPictureQuestion(session.used);
  } else if (session.game.id === "missing") {
    session.question = createMissingLetterQuestion();
  } else if (session.game.id === "speaking") {
    session.question = session.words[session.round - 1];
  }

  if (session.game.id === "matching") {
    session.used.push(session.question.letterId);
  } else if (session.game.id === "picture") {
    session.used.push(session.question.answer);
  }
}

function speakCurrentQuestion() {
  const { game, question } = state.session;
  if (game.id === "speaking") {
    const letters = question.word.toUpperCase().split("").join(" - ");
    const word = question.word.charAt(0).toUpperCase() + question.word.slice(1);
    speak(`${word} - ${letters} - ${word}`, { lang: "en-US", rate: 0.56, pitch: 1.04 });
    return;
  }
  speak(question.speak, { lang: "en-US", rate: 0.56, pitch: 1.04 });
}

function showFeedback(kind, title, message) {
  state.session.feedback = { kind, title, message };
  render();
}

function answerChoice(value) {
  const session = state.session;
  if (!session || session.answered) return;

  session.results.push({round:session.round,question:session.question.prompt,display:session.question.display||session.question.sequence||null,expected:session.question.answer,answer:value,correct:value===session.question.answer,try:session.attempts+1,elapsed_ms:Date.now()-session.questionStarted});
  if (value === session.question.answer) {
    session.answered = true;
    session.score += 10;
    session.feedback = {
      kind: "success",
      title: "Wonderful! That's right!",
      message: session.question.success
    };
    playCorrectSound();
    speak(session.question.success || "Wonderful! That's right!", { lang: "en-US" });
  } else {
    session.attempts += 1;
    session.hintVisible = session.attempts >= 2;
    session.feedback = {
      kind: "try",
      title: "Good try! Have another go!",
      message: session.attempts >= 2 ? `Here's a little hint: ${session.question.hint}` : "It's okay. Take your time and try again."
    };
    playTryAgainSound();
    speak("Good try. Have another go!", { lang: "en-US" });
  }
  render();
}

async function nextRound() {
  const session = state.session;
  if (!session?.answered) return;

  if(session.saving)return;session.saving=true;
  try{if(online){if(session.round===session.totalRounds){session.completedAt=new Date().toISOString();session.stars=calculateStars(session.score,session.totalRounds);}await saveAttempt(session);}}catch(e){alert("Chưa lưu được kết quả. Bấm Next để thử lại: "+e.message);session.saving=false;session.completedAt=null;return false;}
  session.saving=false;if(state.session!==session)return false;stopRecording();
  if (session.round >= session.totalRounds) {
    finishGame();
    return true;
  }

  session.round += 1;
  loadQuestion();
  render();
  speakCurrentQuestion();
  return true;
}

function finishGame() {
  const session = state.session;
  const stars = calculateStars(session.score, session.totalRounds);
  const previous = state.completedGames[session.game.id];
  state.completedGames[session.game.id] = {
    stars: Math.max(stars, previous?.stars || 0),
    bestScore: Math.max(session.score, previous?.bestScore || 0),
    completedAt: new Date().toISOString()
  };
  persist();

  session.stars = stars;
  state.screen = "complete";
  render();
  speak("Congratulations! You finished the island!", { lang: "en-US" });
}

function goHome() {
  stopRecording();
  state.screen = "home";
  state.session = null;
  render();
  speak("Welcome back to My Alphabet World!", { lang: "en-US" });
}

function handleClick(event) {
  const button = event.target.closest("[data-action]");
  if (!button || button.disabled) return;

  const { action, game, value, id, index, letter, word } = button.dataset;

  switch (action) {
    case "start":
    case "replay":
      startGame(game);
      break;
    case "home":
      goHome();
      break;
    case "library":
      state.screen = "library";
      render();
      speak("Let's meet the alphabet. Tap a letter to hear it.", { lang: "en-US" });
      break;
    case "answer":
      answerChoice(value);
      break;
    case "next":
      nextRound();
      break;
    case "repeat-question":
      speakCurrentQuestion();
      break;
    case "repeat-options":
      speak(state.session.question.options.map(option => state.session.game.id === "matching" ? option[0].toUpperCase() : option).join(", "), { lang: "en-US", rate: 0.58, pitch: 1.02 });
      break;
    case "speak-letter":
      speak(`${letter} - ${word}`, { lang: "en-US", rate: 0.56, pitch: 1.04 });
      break;
    case "speak-qa":
      speak(`${LESSON_QUESTION.question} ${LESSON_QUESTION.answer}`, { lang: "en-US" });
      break;
    default:
      break;
  }
}

app.addEventListener("click", handleClick);

app.addEventListener("input", (event) => {
  if (event.target.id !== "learner-name") return;
  state.learnerName = event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 10);
  persist();
});

soundToggle.addEventListener("click", () => {
  state.soundEnabled = !state.soundEnabled;
  setAudioEnabled(state.soundEnabled);
  setSpeechEnabled(state.soundEnabled);
  persist();
  syncSoundButton();
  if (state.soundEnabled && !state.session?.listening) {
    speak("Sound is on. Let's play!", { lang: "en-US" });
  }
});

window.addEventListener("pagehide", () => { stopRecording(); persist(); });


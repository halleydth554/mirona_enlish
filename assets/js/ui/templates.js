import { LESSON_WORDS, GAME_CATALOG } from "../data/lesson.js";

const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
})[character]);

function starsFor(score, total) {
  const ratio = total ? score / (total * 10) : 0;
  return ratio >= 0.8 ? 3 : ratio >= 0.5 ? 2 : 1;
}

export function renderHome(state) {
  const completedCount = Object.keys(state.completedGames || {}).length;
  const totalStars = Object.values(state.completedGames || {}).reduce((sum, game) => sum + (game.stars || 0), 0);

  return `
    <section class="hero-card">
      <div class="hero-copy">
        <span class="eyebrow">A LITTLE ADVENTURE FOR BIG LEARNERS</span>
        <h1>Welcome to<br><span>My Alphabet World!</span></h1>
        <p>Explore four magical islands, practise your ABCs and collect shiny stars.</p>
        <div class="hero-actions">
          <button class="button button-primary button-large" data-action="start" data-game="matching">Start my adventure <span>🚀</span></button>
          <button class="button button-soft" data-action="library">Explore A–Z <span>📚</span></button>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="sun-sparkle">✦</div>
        <div class="rainbow">🌈</div>
        <div class="hero-character">🦊</div>
        <div class="cloud cloud-one">☁️</div>
        <div class="cloud cloud-two">☁️</div>
        <div class="hero-ground"></div>
      </div>
      <div class="hero-stats">
        <div><strong>${completedCount}/4</strong><span>islands explored</span></div>
        <div><strong>⭐ ${totalStars}</strong><span>stars collected</span></div>
        <div><strong>🔤 26</strong><span>letters to learn</span></div>
      </div>
    </section>

    <section class="section-heading">
      <div>
        <span class="eyebrow">CHOOSE YOUR ISLAND</span>
        <h2>Where shall we go today?</h2>
      </div>
      <span class="section-note">Play at your own speed 💛</span>
    </section>

    <section class="island-grid" aria-label="Adventure islands">
      ${GAME_CATALOG.map((game, index) => {
        const saved = state.completedGames?.[game.id];
        return `
          <article class="island-card island-${game.color}">
            <div class="island-topline"><span class="island-number">ISLAND 0${index + 1}</span>
              ${saved ? `<span class="completed-pill">✓ Completed</span>` : `<span class="new-pill">Let's play!</span>`}
            </div>
            <div class="island-illustration" aria-hidden="true">
              <span class="island-cloud">☁️</span><span class="island-icon">${game.icon}</span>
              <span class="island-bush">🌿</span>
            </div>
            <h3>${game.title}</h3>
            <p>${game.subtitle}</p>
            <div class="island-footer">
              <span class="island-stars">${saved ? "⭐".repeat(saved.stars || 1) : "☆☆☆"}</span>
              <button class="button button-card" data-action="start" data-game="${game.id}">
                ${saved ? "Play again" : "Let's go"} <span aria-hidden="true">→</span>
              </button>
            </div>
          </article>
        `;
      }).join("")}
    </section>

    <section class="parent-note">
      <span class="parent-note-icon">💡</span>
      <div><strong>A little note for grown-ups</strong>
        <p>Turn on the sound, let your child tap the big buttons, and encourage them to say each letter out loud. No pressure — mistakes are part of learning!</p>
      </div>
    </section>
  `;
}

export function renderLibrary() {
  return `
    <section class="subpage-header">
      <button class="back-button" data-action="home">← Home</button>
      <div><span class="eyebrow">THE ALPHABET LIBRARY</span><h1>Meet all 26 letters!</h1>
        <p>Tap any card to hear its letter and word.</p></div>
      <span class="library-mascot" aria-hidden="true">🦉</span>
    </section>
    <section class="letter-grid" aria-label="All 26 letters">
      ${LESSON_WORDS.map((item) => `
        <button class="letter-card" data-action="speak-letter" data-letter="${item.upper}" data-word="${item.word}">
          <span class="letter-pair"><strong>${item.upper}</strong><span>${item.lower}</span></span>
          <span class="letter-emoji" aria-hidden="true">${item.emoji}</span>
          <span class="letter-word">${item.word}</span>
          <span class="card-sound" aria-hidden="true">🔊</span>
        </button>
      `).join("")}
    </section>
    <section class="say-it-panel">
      <span class="say-it-icon">🗣️</span>
      <div><strong>Ask and answer!</strong><p>What letter is it? — It's letter Aa.</p></div>
      <button class="button button-soft" data-action="speak-qa">Listen <span>🔊</span></button>
    </section>
  `;
}

// A shared coordinate system preserves the real cap-height and x-height.
function renderLetterGuide(letter) {
  return `<svg class="letter-guide" viewBox="0 0 180 132" aria-hidden="true" focusable="false">
    <path class="guide-top" d="M12 19 H168" />
    <path class="guide-middle" d="M12 41 H168" />
    <path class="guide-baseline" d="M12 91 H168" />
    <path class="guide-bottom" d="M12 114 H168" />
    <text x="90" y="91" text-anchor="middle" font-family="Arial, sans-serif" font-size="100" font-weight="400">${escapeHtml(letter)}</text>
  </svg>`;
}

export function renderChoiceGame({ game, question, round, totalRounds, score, attempts, answered, feedback, hintVisible }) {
  const sequence = question.sequence
    ? `<div class="alphabet-sequence">${question.sequence.map((letter) => `<span class="sequence-letter ${letter === "?" ? "sequence-missing" : ""}">${letter}</span>`).join("")}</div>`
    : "";

  const display = question.sequence
    ? sequence
    : `<div class="question-art ${game.id === "matching" ? "letter-art" : "picture-art"}">
        ${game.id === "matching" ? `<span class="art-kicker">${question.displayLabel}</span>${question.mode === "listen" ? `<button class="listen-art" data-action="repeat-question" aria-label="Listen to the letter">🔊</button>` : renderLetterGuide(question.display)}` : `<span>${question.display}</span>`}
      </div>`;

  return `
    <section class="game-shell">
      ${renderGameTop(game, round, totalRounds, score)}
      <div class="game-card">
        <div class="round-label">CHALLENGE ${String(round).padStart(2, "0")} / ${String(totalRounds).padStart(2, "0")}</div>
        <h1 class="game-prompt">${question.prompt}</h1>
        <p class="game-instruction">${question.instruction}</p>
        ${display}
        <div class="answer-grid ${game.id === "matching" ? "matching-options" : ""} ${question.options.length === 3 ? "three-options" : ""}">
          ${question.options.map((option) => `
            <button class="answer-option ${answered && option === question.answer ? "answer-correct" : ""}"
              data-action="answer" data-value="${escapeHtml(option)}" aria-label="${game.id === "matching" ? question.optionLabel + " " : ""}${escapeHtml(option)}" ${answered ? "disabled" : ""}>
              ${game.id === "matching" ? `<span class="option-letter-label">${question.optionLabel}</span>${renderLetterGuide(option)}` : escapeHtml(option)}
            </button>
          `).join("")}
        </div>
        ${hintVisible && !answered ? `<p class="hint-line">💡 ${question.hint}</p>` : ""}
        ${feedback ? renderFeedback(feedback) : ""}
        <div class="game-controls">
          <button class="button button-listen" data-action="repeat-question">🔊 Hear it again</button>
          <button class="button button-soft" data-action="repeat-options">Hear choices</button>
          ${answered ? `<button class="button button-primary" data-action="next">${round === totalRounds ? "Finish island" : "Next challenge"} <span>→</span></button>` : ""}
        </div>
      </div>
      <div class="encouragement">You can do it, little explorer! 🌟</div>
    </section>
  `;
}

function renderGameTop(game, round, totalRounds, score) {
  const progress = Math.round((round / totalRounds) * 100);
  return `
    <div class="game-topbar">
      <button class="back-button" data-action="home">← Exit island</button>
      <div class="game-progress-wrap">
        <div class="progress-meta"><span>${game.icon} ${game.island}</span><span>${round}/${totalRounds}</span></div>
        <div class="progress-track"><span style="width:${progress}%"></span></div>
      </div>
      <div class="score-chip">⭐ ${score}</div>
    </div>
  `;
}

function renderFeedback(feedback) {
  return `<div class="feedback-panel ${feedback.kind === "success" ? "feedback-success" : "feedback-try"}" role="status">
    <span class="feedback-icon">${feedback.kind === "success" ? "🎉" : "💛"}</span>
    <div><strong>${feedback.title}</strong><p>${feedback.message}</p></div>
  </div>`;
}

export function renderCompletion({ game, score, totalRounds, stars }) {
  return `
    <section class="completion-card">
      <div class="completion-confetti" aria-hidden="true">✨ 🎈 ⭐ 🎊 ✨</div>
      <div class="completion-trophy">🏆</div>
      <span class="eyebrow">ISLAND COMPLETED</span>
      <h1>Hooray, little explorer!</h1>
      <p>You finished <strong>${game.island}</strong>. You did a wonderful job!</p>
      <div class="earned-stars">${"⭐".repeat(stars)}${"☆".repeat(3 - stars)}</div>
      <div class="completion-stats">
        <div><strong>${score}</strong><span>points</span></div>
        <div><strong>${totalRounds}</strong><span>challenges</span></div>
        <div><strong>${stars}/3</strong><span>stars</span></div>
      </div>
      <div class="completion-message">${stars === 3 ? "Amazing work! You are an Alphabet Super Star!" : "Great effort! You can play again and collect more stars."}</div>
      <div class="completion-actions">
        <button class="button button-primary button-large" data-action="home">Back to my islands 🏝️</button>
        <button class="button button-soft" data-action="replay" data-game="${game.id}">Play again ↻</button>
      </div>
    </section>
  `;
}

export function renderGameView(context) {
  
  return renderChoiceGame(context);
}

export function calculateStars(score, totalRounds) {
  
  return starsFor(score, totalRounds);
}

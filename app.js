/* =========================
app.js — review-ready (vanilla JS)
Try On Quiz
========================= */
"use strict";

/* =========================================================
   1) CONFIG (data + assets)
   ========================================================= */

/**
 * Where to load quiz/questions data from.
 * Note: This is a relative path, so the app should be served (e.g., Live Server).
 */
const DATA_URL = "./data.json";

/**
 * Base folder for images. In this version we use pre-trimmed assets in /assets_new.
 * (Shoes were trimmed to a tight bounding box so CSS sizing is consistent.)
 */
const ASSETS_BASE = "./assets_new";

/**
 * Shoe id -> image filename mapping.
 * Keys must match shoe ids in data.json, values must match actual filenames.
 */
const SHOE_IMAGE_FILENAME = {
  cloud: "Cloud.png",
  cloudx: "Cloud X.png",
  cloudflow: "Cloudflow.png",
  cloudventure: "Cloudventure.png",
  cloudsurfer: "Cloudsurfer.png",
  cloudventure_waterproof: "Cloudventure Waterproof.png",
  cloudventure_peak: "Cloudventure Peak.png",
  cloudflyer: "Cloudflyer.png",
};

/**
 * Centralized asset paths.
 * Keeping this in one place avoids scattering hard-coded paths around the app.
 */
const ASSETS = {
  logo: `${ASSETS_BASE}/on-logo.png`,
  runner: `${ASSETS_BASE}/Background Image Start Screen.png`,
  loader: `${ASSETS_BASE}/loader.gif`,
  shoeImg: (shoeId) => `${ASSETS_BASE}/${SHOE_IMAGE_FILENAME[shoeId] || ""}`,
};

/* =========================================================
   2) DOM REFERENCES (single lookup per element)
   ========================================================= */

const stageEl = document.getElementById("stage");

/** Screen containers are toggled via .is-hidden */
const screens = {
  start: document.getElementById("start-screen"),
  quiz: document.getElementById("quiz-screen"),
  loading: document.getElementById("loading-screen"),
  results: document.getElementById("results-screen"),
};

/** Topbar controls */
const menuBtn = document.getElementById("menu-btn");
const logoImg = document.getElementById("logo-img");

/** Primary actions */
const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

/** Static images set at boot */
const runnerImg = document.getElementById("runner-img");
const loaderImg = document.getElementById("loader-img");

/** Quiz DOM */
const quizContentEl = document.getElementById("quiz-content"); // wrapper we fade
const questionTextEl = document.getElementById("question-text");
const answersEl = document.getElementById("answers");

/** Results DOM */
const summaryEl = document.getElementById("results-summary");
const recommendedSlotEl = document.getElementById("recommended-slot");
const similarGridEl = document.getElementById("similar-grid");

/* =========================================================
   3) DATA + STATE
   ========================================================= */

let DATA = null;            // full loaded JSON
let questionsById = null;   // Map<number, question>

/**
 * state:
 * - screen: current screen name
 * - currentQuestionId: current quiz question id (kept for clarity; not strictly required)
 * - ratings: accumulated shoe scores
 */
let state = null;

/**
 * isTransitioning blocks double-clicks during visual transitions (fade out/in).
 */
let isTransitioning = false;

/* =========================================================
   4) HELPERS
   ========================================================= */

/**
 * Convert an array of questions into a Map keyed by question id for O(1) lookup.
 */
function buildQuestionsMap(questions) {
  const map = new Map();
  for (const q of questions) map.set(q.id, q);
  return map;
}

/**
 * Build a ratings object with all shoe ids initialized to 0.
 */
function createInitialRatings(shoes) {
  const ratings = Object.create(null);
  for (const s of shoes) ratings[s.id] = 0;
  return ratings;
}

/**
 * Create a fresh initial application state.
 * Called when starting/restarting quiz or navigating "home".
 */
function initialState() {
  return {
    screen: "start",
    currentQuestionId: 0,
    ratings: createInitialRatings(DATA.shoes),
  };
}

/**
 * Get a question by id from the pre-built Map.
 */
function getQuestion(id) {
  return questionsById.get(id) || null;
}

/**
 * Apply a scoring delta from an answer.
 * ratingIncrease is an object like { cloud: 3, cloudx: 1, ... }.
 */
function applyRatingIncrease(ratingIncrease) {
  if (!ratingIncrease) return;

  for (const [shoeId, inc] of Object.entries(ratingIncrease)) {
    state.ratings[shoeId] = (state.ratings[shoeId] ?? 0) + Number(inc || 0);
  }
}

/**
 * Compute ranked shoes by score.
 * Tie-breaker: preserve the original order from data.json for deterministic output.
 */
function rankedShoes() {
  const orderIndex = new Map(DATA.shoes.map((s, i) => [s.id, i]));

  return DATA.shoes
    .map((s) => ({ ...s, rating: state.ratings[s.id] ?? 0 }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0);
    });
}

/* =========================================================
   5) SCREEN VISIBILITY
   ========================================================= */

/**
 * Shows exactly one screen and hides the others.
 * Also toggles a body class to scope results styling.
 */
function showOnly(screenName) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.add("is-hidden");
  }

  screens[screenName].classList.remove("is-hidden");

  // Results page uses a different palette and layout, scoped via .is-results on <body>
  document.body.classList.toggle("is-results", screenName === "results");

  state.screen = screenName;
}

/* =========================================================
   6) TRANSITIONS
   ========================================================= */

/**
 * Fade the entire stage out, swap content, then fade in.
 * Used for big navigation changes (start <-> quiz <-> loading <-> results).
 */
function transitionTo(updateFn) {
  if (isTransitioning) return;
  isTransitioning = true;

  stageEl.classList.add("is-out");

  const onOutEnd = (e) => {
    if (e.propertyName !== "opacity") return;
    stageEl.removeEventListener("transitionend", onOutEnd);

    // Update DOM while hidden
    updateFn();

    // Force reflow so fade-in triggers reliably
    void stageEl.offsetHeight;
    stageEl.classList.remove("is-out");

    const onInEnd = (ev) => {
      if (ev.propertyName !== "opacity") return;
      stageEl.removeEventListener("transitionend", onInEnd);
      isTransitioning = false;
    };

    stageEl.addEventListener("transitionend", onInEnd);
  };

  stageEl.addEventListener("transitionend", onOutEnd);
}

/**
 * Fade only quiz content (question + answers), then swap question and fade back in.
 */
function fadeQuizContentAndUpdate(updateFn) {
  // If we’re not in quiz screen (or wrapper missing), fall back to stage transition.
  if (state.screen !== "quiz" || !quizContentEl) {
    transitionTo(updateFn);
    return;
  }

  if (isTransitioning) return;
  isTransitioning = true;

  quizContentEl.classList.add("is-fading");

  const onFadeOutEnd = (e) => {
    if (e.propertyName !== "opacity") return;
    quizContentEl.removeEventListener("transitionend", onFadeOutEnd);

    // Update quiz DOM while hidden
    updateFn();

    // Force reflow so fade-in triggers reliably
    void quizContentEl.offsetHeight;

    quizContentEl.classList.remove("is-fading");

    const onFadeInEnd = (ev) => {
      if (ev.propertyName !== "opacity") return;
      quizContentEl.removeEventListener("transitionend", onFadeInEnd);
      isTransitioning = false;
    };

    quizContentEl.addEventListener("transitionend", onFadeInEnd);
  };

  quizContentEl.addEventListener("transitionend", onFadeOutEnd);
}

/* =========================================================
   7) RENDERING (DOM updates)
   ========================================================= */

/**
 * Render a single quiz question and its answer buttons.
 * Buttons are created dynamically from data.json.
 */
function renderQuestionScreen(questionId) {
  const q = getQuestion(questionId);

  if (!q) {
    questionTextEl.textContent = "Question not found.";
    answersEl.innerHTML = "";
    return;
  }

  state.currentQuestionId = questionId;
  questionTextEl.textContent = q.copy;

  // Replace all answers for this question
  answersEl.innerHTML = "";

  q.answers.forEach((ans, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.textContent = ans.copy;

    // Store identifiers as data-* attributes to handle clicks via event delegation
    btn.dataset.qid = String(q.id);
    btn.dataset.aindex = String(idx);

    answersEl.appendChild(btn);
  });
}

/**
 * Create a results "tile" for a shoe.
 * Note: innerHTML is acceptable here because data comes from controlled JSON.
 */
function createShoeTile(shoe) {
  const wrap = document.createElement("div");
  wrap.className = "shoe-block";

  wrap.innerHTML = `
    <article class="shoe-tile">
      <img
        class="shoe-tile__img"
        src="${ASSETS.shoeImg(shoe.id)}"
        alt="${shoe.name} shoe"
      />

      <div class="shoe-tile__name">${shoe.name}</div>

      <p class="shoe-tile__desc">
        Your perfect partner in the world's lightest fully-cushioned shoe for Running Remixed.
      </p>

      <div class="shoe-tile__meta">
        <span>200 CHF</span>
        <span>|</span>
        <span>Neon &amp; Grey</span>
      </div>

      <div class="shoe-tile__swatches" aria-label="Available colors">
        <button class="swatch swatch--p1 is-active" type="button" data-swatch aria-label="Color option 1"></button>
        <button class="swatch swatch--p2" type="button" data-swatch aria-label="Color option 2"></button>
        <button class="swatch swatch--p3" type="button" data-swatch aria-label="Color option 3"></button>
        <button class="swatch swatch--p4" type="button" data-swatch aria-label="Color option 4"></button>
      </div>
    </article>

    <button
      class="results__cta results__cta--outside"
      type="button"
      data-action="shop"
      data-shoe-id="${shoe.id}"
    >
      Shop now
    </button>
  `;

  return wrap;
}

/**
 * Render the final results:
 * - Compute ranking
 * - Fill summary text
 * - Render 1 recommended + 2 similar shoes
 */
function renderResultsScreen() {
  const ranked = rankedShoes();
  const recommended = ranked[0] ?? null;
  const similar = ranked.slice(1, 3); // exactly 2 similar shoes

  // Summary copy based on rendered shoes
  if (summaryEl) {
    if (recommended && similar.length > 0) {
      const names = [recommended.name, similar[0].name];
      summaryEl.textContent =
        `Based on your selection we’ve decided on the ${names[0]} and ${names[1]}! ` +
        `Enjoy the 30 day trial!`;
    } else if (recommended) {
      summaryEl.textContent =
        `Based on your selection we’ve decided on the ${recommended.name}! ` +
        `Enjoy the 30 day trial!`;
    } else {
      summaryEl.textContent = "";
    }
  }

  // Clear previous render
  recommendedSlotEl.innerHTML = "";
  similarGridEl.innerHTML = "";

  // Render tiles
  if (recommended) {
    recommendedSlotEl.appendChild(createShoeTile(recommended));
  }

  for (const shoe of similar) {
    similarGridEl.appendChild(createShoeTile(shoe));
  }
}

/* =========================================================
   8) ACTIONS (state transitions)
   ========================================================= */

/**
 * Start the quiz at question 0 from the start screen.
 */
function startQuiz() {
  transitionTo(() => {
    state = initialState();
    showOnly("quiz");
    renderQuestionScreen(0);
  });
}

/**
 * Restart the quiz from results screen back to question 0.
 */
function restartQuiz() {
  transitionTo(() => {
    state = initialState();
    showOnly("quiz");
    renderQuestionScreen(0);
  });
}

/**
 * Handle an answer click:
 * - apply scoring
 * - either go to the next question or finish (loading -> results)
 */
function handleAnswerClick(qidStr, aIndexStr) {
  const qid = Number(qidStr);
  const aIndex = Number(aIndexStr);

  const q = getQuestion(qid);
  if (!q) return;

  const ans = q.answers[aIndex];
  if (!ans) return;

  applyRatingIncrease(ans.ratingIncrease);

  const next = ans.nextQuestion;

  if (next === "" || next === null || typeof next === "undefined") {
    if (isTransitioning) return;
    isTransitioning = true;

    // Instant switch to loading (no transitionTo)
    showOnly("loading");

    window.setTimeout(() => {
      // Instant switch to results (no transitionTo)
      showOnly("results");
      renderResultsScreen();

      isTransitioning = false;
    }, 900); // "processing" time for UI

    return;
  }

  // Continue quiz: fade only the quiz content (question + answers)
  fadeQuizContentAndUpdate(() => {
    renderQuestionScreen(Number(next));
  });
}

/**
 * "Home" navigation: both hamburger and logo return to start screen.
 * If data is loaded, we reset quiz state.
 */
function goToStartScreen() {
  if (isTransitioning) return;

  transitionTo(() => {
    if (DATA) state = initialState();
    showOnly("start");
  });
}

/* =========================================================
   9) EVENTS
   ========================================================= */

startBtn.addEventListener("click", startQuiz);
restartBtn.addEventListener("click", restartQuiz);

// Clicking on hamburger menu returns to start screen.
menuBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  goToStartScreen();
});

// Clicking on logo icon returns to start screen.
logoImg?.addEventListener("click", (e) => {
  e.preventDefault();
  goToStartScreen();
});

/**
 * Event delegation:
 * We listen once on #stage and detect which button was clicked.
 * This works even for buttons created dynamically (answers, swatches, tiles).
 */
stageEl.addEventListener("click", (e) => {
  if (isTransitioning) return;

  const btn = e.target.closest("button");
  if (!btn) return;

  // Quiz answers
  if (btn.classList.contains("answer-btn")) {
    handleAnswerClick(btn.dataset.qid, btn.dataset.aindex);
    return;
  }

  // "Shop now" buttons (demo behavior)
  if (btn.dataset.action === "shop") {
    alert(`Shop: ${btn.dataset.shoeId} (no URL provided in data.json)`);
    return;
  }

  // Swatch selection (toggle active state)
  if (btn.dataset.swatch !== undefined) {
    const swatchGroup = btn.closest(".shoe-tile__swatches");
    if (!swatchGroup) return;

    swatchGroup.querySelectorAll(".swatch").forEach((s) => {
      s.classList.remove("is-active");
    });

    btn.classList.add("is-active");
  }
});

/* =========================================================
   10) BOOT (load data, set initial screen)
   ========================================================= */

/**
 * Initialize the app:
 * - set static images
 * - load data.json
 * - build question lookup map
 * - show start screen
 */
async function init() {
  // Set images via JS so HTML stays clean and paths are centralized.
  runnerImg.src = ASSETS.runner;
  loaderImg.src = ASSETS.loader;
  if (logoImg) logoImg.src = ASSETS.logo;

  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) {
      alert(
        `Failed to load data.json (status ${res.status}).\n` +
          `Make sure Live Server is running and DATA_URL is correct: ${DATA_URL}`
      );
      return;
    }

    DATA = await res.json();
    questionsById = buildQuestionsMap(DATA.questions);

    state = initialState();
    showOnly("start");
  } catch (err) {
    alert(`Failed to load data.json.\n${String(err)}`);
  }
}

init();

/* =========================
app.js
Try On Quiz
========================= */
"use strict";

/* ========= Config (paths) ========= */

const DATA_URL = "../data.json";
const ASSETS_BASE = "../assets_new";

/* Shoe id -> image filename mapping (must match assets filenames) */
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

const ASSETS = {
  logo: `${ASSETS_BASE}/on-logo.png`,
  runner: `${ASSETS_BASE}/Background Image Start Screen.png`,
  loader: `${ASSETS_BASE}/loader.gif`,
  shoeImg: (shoeId) => `${ASSETS_BASE}/${SHOE_IMAGE_FILENAME[shoeId] || ""}`,
};

/* ========= DOM references ========= */
const stageEl = document.getElementById("stage");

const screens = {
  start: document.getElementById("start-screen"),
  quiz: document.getElementById("quiz-screen"),
  loading: document.getElementById("loading-screen"),
  results: document.getElementById("results-screen"),
};

const menuBtn = document.getElementById("menu-btn");
const logoImg = document.getElementById("logo-img");

const startBtn = document.getElementById("start-btn");
const restartBtn = document.getElementById("restart-btn");

const runnerImg = document.getElementById("runner-img");
const loaderImg = document.getElementById("loader-img");

const quizContentEl = document.getElementById("quiz-content");
const questionTextEl = document.getElementById("question-text");
const answersEl = document.getElementById("answers");

const summaryEl = document.getElementById("results-summary");
const recommendedSlotEl = document.getElementById("recommended-slot");
const similarGridEl = document.getElementById("similar-grid");

/* ========= Data ========= */
let DATA = null;
let questionsById = null;

/* ========= State ========= */
let state = null;
let isTransitioning = false;

/* ========= Helpers ========= */
function buildQuestionsMap(questions) {
  const map = new Map();
  for (const q of questions) map.set(q.id, q);
  return map;
}

function createInitialRatings(shoes) {
  const ratings = Object.create(null);
  for (const s of shoes) ratings[s.id] = 0;
  return ratings;
}

function initialState() {
  return {
    screen: "start",
    currentQuestionId: 0,
    ratings: createInitialRatings(DATA.shoes),
  };
}

function getQuestion(id) {
  return questionsById.get(id) || null;
}

function applyRatingIncrease(ratingIncrease) {
  if (!ratingIncrease) return;

  for (const [shoeId, inc] of Object.entries(ratingIncrease)) {
    state.ratings[shoeId] = (state.ratings[shoeId] ?? 0) + Number(inc || 0);
  }
}

function rankedShoes() {
  // Tie-breaker: keep original order from data.json
  const orderIndex = new Map(DATA.shoes.map((s, i) => [s.id, i]));

  return DATA.shoes
    .map((s) => ({ ...s, rating: state.ratings[s.id] ?? 0 }))
    .sort((a, b) => {
      if (b.rating !== a.rating) return b.rating - a.rating;
      return (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0);
    });
}

/* ========= Screen visibility ========= */
function showOnly(screenName) {
  for (const key of Object.keys(screens)) {
    screens[key].classList.add("is-hidden");
  }

  screens[screenName].classList.remove("is-hidden");
  document.body.classList.toggle("is-results", screenName === "results");

  state.screen = screenName;
}

/* ========= Transitions ========= */
function transitionTo(updateFn) {
  if (isTransitioning) return;
  isTransitioning = true;

  stageEl.classList.add("is-out");

  const onOutEnd = (e) => {
    if (e.propertyName !== "opacity") return;
    stageEl.removeEventListener("transitionend", onOutEnd);

    updateFn();

    // Force reflow so the fade-in transition triggers reliably
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

/* ========= Quiz content transition ========= */
function fadeQuizContentAndUpdate(updateFn) {
  // Only use this on the quiz screen
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

    // Update content while hidden
    updateFn();

    // Force reflow so fade-in triggers
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


/* ========= Rendering ========= */
function renderQuestionScreen(questionId) {
  const q = getQuestion(questionId);

  if (!q) {
    questionTextEl.textContent = "Question not found.";
    answersEl.innerHTML = "";
    return;
  }

  questionTextEl.textContent = q.copy;
  answersEl.innerHTML = "";

  q.answers.forEach((ans, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "answer-btn";
    btn.textContent = ans.copy;

    btn.dataset.qid = String(q.id);
    btn.dataset.aindex = String(idx);

    answersEl.appendChild(btn);
  });
}

function createShoeTile(shoe) {
  const wrap = document.createElement("div");
  wrap.className = "shoe-block";

  // Note: data is controlled (data.json), so innerHTML is acceptable here.
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
        <span>Neon & Grey</span>
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

function renderResultsScreen() {
  const ranked = rankedShoes();

  const recommended = ranked[0] ?? null;
  const similar = ranked.slice(1, 3); // only 2 similar shoes

  // Summary text
  if (summaryEl) {
    if (recommended && similar.length > 0) {
      const names = [recommended.name, similar[0].name];
      const formatted =
        names.length === 2
          ? `${names[0]} and ${names[1]}`
          : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;

      summaryEl.textContent = `Based on your selection we’ve decided on the ${formatted}! Enjoy the 30 day trial!`;
    } else if (recommended) {
      summaryEl.textContent = `Based on your selection we’ve decided on the ${recommended.name}! Enjoy the 30 day trial!`;
    } else {
      summaryEl.textContent = "";
    }
  }

  // Clear previous tiles
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

/* ========= Actions ========= */
function startQuiz() {
  transitionTo(() => {
    state = initialState();
    showOnly("quiz");
    renderQuestionScreen(0);
  });
}

function restartQuiz() {
  transitionTo(() => {
    state = initialState();
    showOnly("quiz");
    renderQuestionScreen(0);
  });
}

function handleAnswerClick(qidStr, aIndexStr) {
  const qid = Number(qidStr);
  const aIndex = Number(aIndexStr);

  const q = getQuestion(qid);
  if (!q) return;

  const ans = q.answers[aIndex];
  if (!ans) return;

  applyRatingIncrease(ans.ratingIncrease);

  const next = ans.nextQuestion;

  // End -> Loading -> Results
  if (next === "" || next === null || typeof next === "undefined") {
    transitionTo(() => {
      showOnly("loading");
    });

    window.setTimeout(() => {
      transitionTo(() => {
        showOnly("results");
        renderResultsScreen();
      });
    }, 900);

    return;
  }

  // Continue quiz
fadeQuizContentAndUpdate(() => {
  // same screen, just new content
  renderQuestionScreen(Number(next));
});
}

/* ========= Events ========= */
startBtn.addEventListener("click", startQuiz);
restartBtn.addEventListener("click", restartQuiz);

// Hamburger -> go to start screen (Home)
function goToStartScreen() {
  if (isTransitioning) return;

  transitionTo(() => {
    if (DATA) state = initialState();
    showOnly("start");
  });
}

menuBtn?.addEventListener("click", (e) => {
  e.preventDefault();
  goToStartScreen();
});

logoImg?.addEventListener("click", (e) => {
  e.preventDefault();
  goToStartScreen();
});


// Delegated clicks inside stage: answers, shop, swatches
stageEl.addEventListener("click", (e) => {
  if (isTransitioning) return;

  const btn = e.target.closest("button");
  if (!btn) return;

  // Answer buttons
  if (btn.classList.contains("answer-btn")) {
    handleAnswerClick(btn.dataset.qid, btn.dataset.aindex);
    return;
  }

  // Shop buttons
  if (btn.dataset.action === "shop") {
    alert(`Shop: ${btn.dataset.shoeId} (no URL provided in data.json)`);
    return;
  }

  // Swatch selection
  if (btn.dataset.swatch !== undefined) {
    const swatchGroup = btn.closest(".shoe-tile__swatches");
    if (!swatchGroup) return;

    swatchGroup.querySelectorAll(".swatch").forEach((s) => {
      s.classList.remove("is-active");
    });

    btn.classList.add("is-active");
  }
});

/* ========= Boot ========= */
async function init() {
  // Set images (keeps HTML clean)
  runnerImg.src = ASSETS.runner;
  loaderImg.src = ASSETS.loader;
  logoImg.src = ASSETS.logo;

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

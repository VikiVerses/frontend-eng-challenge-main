# Try On Quiz — Runner Shoe Finder (Vanilla JS)

A small, data-driven quiz that recommends the best-fitting running shoe based on user answers.  
Built with **vanilla JavaScript + HTML + custom CSS** (no framework, no CSS library).



## Task summary
- Use the provided `data.json` as the single source of:
  - questions/answers
  - branching via `nextQuestion`
  - scoring via `ratingIncrease`
- If `nextQuestion` is empty → end quiz and show results
- Follow the provided layouts (navigation not required)
- Use similar Google fonts (original fonts not required)
- Prefer custom CSS (no Tailwind/Bootstrap)



## What was implemented
- **Single-page, multi-screen UI**:
  - Start → Quiz → Loading → Results  
  - Screens exist in the DOM and are shown/hidden by toggling `.is-hidden`.
- **Data-driven rendering**:
  - question text and answer buttons are generated from `data.json`
  - branching uses `answer.nextQuestion`
- **Scoring + ranking**:
  - each answer applies `answer.ratingIncrease` into `state.ratings`
  - results show **1 recommended** shoe (highest score) + **2 similar** shoes (next highest)
  - deterministic ties: preserve original shoe order from `data.json`
- **Transitions + interaction safety**:
  - fade transition for screen changes
  - lighter fade for question changes (`#quiz-content`)
  - `isTransitioning` blocks double clicks during transitions
- **Custom CSS**:
  - CSS variables (“design tokens”) for consistent sizing/colors/typography
  - results theme scoped via `body.is-results`
  - responsive adjustments for small width screens
  - respects `prefers-reduced-motion`



## Technical overview

### Data load
`app.js` loads `data.json` with `fetch()` in `init()`.  
Questions are indexed into `questionsById: Map<number, Question>` for O(1) access.

### State model
The app keeps minimal state:
- `screen`: active screen name
- `currentQuestionId`: current question id
- `ratings`: `{ [shoeId]: number }` accumulated scores

### Answer handling
When an answer is clicked:
1. apply `ratingIncrease` → update `state.ratings`
2. read `nextQuestion`
3. if empty → show Loading, then render Results
4. else → render the next question (quiz-content fade)

### Events
Uses **event delegation** on `#stage` so dynamically created buttons work without re-binding:
- answer buttons (`.answer-btn`)
- demo “Shop now” buttons (`data-action="shop"`)
- swatches (`data-swatch`)



## Project structure
- `index.html` — all screens + shared stage container
- `styles.css` — custom styling (no framework)
- `app.js` — state, rendering, branching, ranking, transitions
- `data.json` — provided dataset
- `assets/` — original assets from the task package
- `assets_processed/` — processed/trimmed assets used by the app
- `tools/` — helper script (Python) to normalize/crop shoe images for consistent sizing
- `layouts/` — reference layout screenshots from the brief

 

## Run locally
Because the app loads `data.json` via `fetch()`, run using a local server:
- VS Code: **Live Server** → open `index.html`

 

## Asset note (logo)
The original logo asset was missing in the provided package.  
To keep the layout consistent, I added a replacement On logo sourced online and used for non-commercial/demo purposes. The path is centralized (`ASSETS.logo` in `app.js`) so it can be swapped easily.



## Notes / assumptions
- **Image preprocessing (Python):** 
    The provided shoe images had inconsistent whitespace/padding, which made it hard to size them consistently inside the result tiles.  
    To make layout and alignment predictable, I preprocessed the shoe images with a small **Python** script to **auto-crop transparent/white margins** and export tighter assets (stored in `assets_new/`).

- “Shop now” is a demo action (no product URLs in `data.json`)
- Price/color text inside tiles is placeholder UI copy (not provided by the dataset)

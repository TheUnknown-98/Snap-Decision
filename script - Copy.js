/* ─────────────────────────────────────────────────────────────
   SNAP DECISION  ·  script.js  v2
   Fixed: button activation, smooth transitions, staggered Q entry
   ───────────────────────────────────────────────────────────── */
'use strict';

const $ = id => document.getElementById(id);

// ── DOM ──────────────────────────────────────────────────────────
const screens      = ['setup', 'question', 'processing', 'result']
  .reduce((acc, k) => { acc[k] = $(`${k}-screen`); return acc; }, {});

const contextInput = $('contextInput');
const optInputs    = [0, 1, 2].map(i => $(`opt${i}`));
const beginBtn     = $('beginBtn');
const formHint     = $('formHint');

const stepFill     = $('stepFill');
const stepLabel    = $('stepLabel');
const qEyebrow     = $('qEyebrow');
const qText        = $('qText');
const qCards       = $('qCards');
const qNudge       = document.querySelector('.q-nudge');

const ringProg     = $('ringProg');

const resultInner  = $('resultInner');
const resultName   = $('resultName');
const resultWhy    = $('resultWhy');
const signalsList  = $('signalsList');
const againBtn     = $('againBtn');

// ── QUESTIONS ─────────────────────────────────────────────────────
const QUESTIONS = [
  { eyebrow: 'gut check',     text: 'Which would you pick if you had to decide right now?',                signal: 'instinct'     },
  { eyebrow: 'true desire',   text: 'Which would you be most relieved to hear was already decided?',       signal: 'desire'       },
  { eyebrow: 'fear of loss',  text: 'Which are you most afraid of regretting?',                            signal: 'regret'       },
];

// ── STATE ─────────────────────────────────────────────────────────
let options  = [];
let answers  = [];
let qIndex   = 0;
let canAnswer = false;

// ── SCREEN TRANSITIONS ────────────────────────────────────────────
function showScreen(name) {
  const incoming = screens[name];
  Object.entries(screens).forEach(([k, el]) => {
    if (k === name) return;
    if (el.classList.contains('active')) {
      el.classList.add('exit');
      el.classList.remove('active');
      setTimeout(() => el.classList.remove('exit'), 450);
    }
  });
  // Small delay so exit plays first
  setTimeout(() => {
    incoming.classList.add('active');
  }, 60);
}

// ── SETUP — VALIDATION ─────────────────────────────────────────────
function checkReady() {
  const allFilled = optInputs.every(inp => inp.value.trim().length > 0);
  beginBtn.classList.toggle('ready', allFilled);
  formHint.classList.toggle('gone', allFilled);
}

optInputs.forEach(inp => inp.addEventListener('input', checkReady));

// Tab / Enter navigation between option fields
optInputs[0].addEventListener('keydown', e => { if (e.key === 'Enter') optInputs[1].focus(); });
optInputs[1].addEventListener('keydown', e => { if (e.key === 'Enter') optInputs[2].focus(); });
optInputs[2].addEventListener('keydown', e => {
  if (e.key === 'Enter' && beginBtn.classList.contains('ready')) startSession();
});

// ── BEGIN BUTTON ──────────────────────────────────────────────────
// No disabled attribute — purely class-gated
beginBtn.addEventListener('click', () => {
  if (!beginBtn.classList.contains('ready')) return;
  startSession();
});

// ── START SESSION ──────────────────────────────────────────────────
function startSession() {
  options  = optInputs.map(inp => inp.value.trim());
  answers  = [];
  qIndex   = 0;
  canAnswer = false;

  showScreen('question');
  setTimeout(() => loadQuestion(0), 260);
}

// ── LOAD QUESTION ──────────────────────────────────────────────────
function loadQuestion(idx) {
  canAnswer = false;
  const q = QUESTIONS[idx];

  // Progress bar
  stepFill.style.width = `${((idx + 1) / QUESTIONS.length) * 100}%`;
  stepLabel.textContent = `Question ${idx + 1} of ${QUESTIONS.length}`;

  // Reset animation classes
  [qEyebrow, qText, qCards, qNudge].forEach(el => el.classList.remove('in'));

  // Small pause then stagger in
  setTimeout(() => {
    qEyebrow.textContent = q.eyebrow;
    qText.textContent    = q.text;
    buildCards();

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        qEyebrow.classList.add('in');
        setTimeout(() => qText.classList.add('in'), 60);
        setTimeout(() => qCards.classList.add('in'), 120);
        setTimeout(() => { qNudge.classList.add('in'); canAnswer = true; }, 200);
      });
    });
  }, 180);
}

// ── BUILD ANSWER CARDS ─────────────────────────────────────────────
function buildCards() {
  qCards.innerHTML = '';
  options.forEach((opt, i) => {
    const card = document.createElement('div');
    card.className = 'answer-card';
    card.innerHTML = `
      <span class="ac-badge">${String.fromCharCode(65 + i)}</span>
      <span class="ac-text">${opt}</span>`;
    card.addEventListener('click', () => onPick(i, card));
    qCards.appendChild(card);
  });
}

// ── HANDLE PICK ────────────────────────────────────────────────────
function onPick(optIdx, cardEl) {
  if (!canAnswer) return;
  canAnswer = false;

  // Visual: picked card fills dark, others fade
  cardEl.classList.add('picked');
  [...qCards.children].forEach(c => {
    if (c !== cardEl) c.classList.add('dim-out');
  });

  answers.push({ optionIndex: optIdx, signal: QUESTIONS[qIndex].signal });

  setTimeout(() => {
    qIndex++;
    if (qIndex < QUESTIONS.length) {
      // Animate out then load next
      [qEyebrow, qText, qCards, qNudge].forEach(el => el.classList.remove('in'));
      setTimeout(() => loadQuestion(qIndex), 280);
    } else {
      goProcessing();
    }
  }, 480);
}

// ── PROCESSING ─────────────────────────────────────────────────────
function goProcessing() {
  showScreen('processing');
  setTimeout(() => {
    ringProg.style.strokeDashoffset = '0';
  }, 120);

  setTimeout(() => {
    const result = scoreAnswers();
    buildResult(result);
    showScreen('result');
    setTimeout(() => {
      resultInner.classList.add('in');
      staggerSignals();
    }, 320);
  }, 1700);
}

// ── SCORING ───────────────────────────────────────────────────────
function scoreAnswers() {
  const votes = [0, 0, 0];
  answers.forEach(a => votes[a.optionIndex]++);

  const maxVotes = Math.max(...votes);
  const tied     = votes.filter(v => v === maxVotes).length > 1;

  // Default winner = last answer (tiebreak = regret, the strongest signal)
  let winIdx = answers[answers.length - 1].optionIndex;
  if (!tied) winIdx = votes.indexOf(maxVotes);

  const wonSignals = answers
    .filter(a => a.optionIndex === winIdx)
    .map(a => a.signal);

  const rows = answers.map((a, i) => ({
    label:    QUESTIONS[i].eyebrow,
    value:    options[a.optionIndex],
    isWinner: a.optionIndex === winIdx,
  }));

  return { winIdx, wonSignals, rows, tied };
}

// ── WHY COPY ──────────────────────────────────────────────────────
function buildWhyCopy(winnerName, wonSignals, tied) {
  const has = s => wonSignals.includes(s);
  const all = wonSignals.length === 3;
  const two = wonSignals.length === 2;

  if (all) return `Every signal pointed here. Instinct, desire, and fear of loss all chose "${winnerName}." That's not a decision — it's a confirmation.`;

  if (two) {
    if (has('instinct') && has('desire'))  return `You reached for "${winnerName}" first, and it's what you actually want. The hesitation you're feeling isn't doubt — it's just the gap before commitment.`;
    if (has('instinct') && has('regret')) return `Your first move and your deepest fear both landed on "${winnerName}." That kind of alignment is rare. Trust it.`;
    if (has('desire') && has('regret'))   return `You want "${winnerName}" and you're afraid of losing it. That combination rarely leads somewhere you regret.`;
  }

  if (wonSignals.length === 1) {
    if (has('instinct')) return `Your first instinct said "${winnerName}." That signal fires before logic can interfere — it's usually the clearest one you have.`;
    if (has('desire'))   return `When you asked what you truly want, it was "${winnerName}." That answer matters more than any list of pros and cons.`;
    if (has('regret'))   return `The one you'd regret missing is "${winnerName}." Fear of loss is just desire with urgency attached to it.`;
  }

  if (tied) return `It was close — "${winnerName}" won on the regret question. When signals split, that one tends to carry the most truth.`;

  return `The signals converged on "${winnerName}." Go with it.`;
}

// ── BUILD RESULT ──────────────────────────────────────────────────
function buildResult({ winIdx, wonSignals, rows, tied }) {
  const winnerName = options[winIdx];
  resultName.textContent = winnerName;
  resultWhy.textContent  = buildWhyCopy(winnerName, wonSignals, tied);

  signalsList.innerHTML = '';
  rows.forEach(row => {
    const div = document.createElement('div');
    div.className = 'signal-row';
    div.innerHTML = `
      <span class="sig-label">${row.label}</span>
      <span class="sig-value">${row.value}</span>
      <span class="sig-tag ${row.isWinner ? 'win' : 'neutral'}">${row.isWinner ? 'matched' : 'split'}</span>`;
    signalsList.appendChild(div);
  });
}

function staggerSignals() {
  document.querySelectorAll('.signal-row').forEach((r, i) => {
    setTimeout(() => r.classList.add('in'), 300 + i * 120);
  });
  setTimeout(() => againBtn.classList.add('in'), 300 + 3 * 120 + 200);
}

// ── RESTART ───────────────────────────────────────────────────────
againBtn.addEventListener('click', () => {
  // Reset classes
  resultInner.classList.remove('in');
  againBtn.classList.remove('in');
  document.querySelectorAll('.signal-row').forEach(r => r.classList.remove('in'));

  // Reset ring instantly (no transition)
  ringProg.style.transition = 'none';
  ringProg.style.strokeDashoffset = '125.66';
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ringProg.style.transition = 'stroke-dashoffset 1.3s cubic-bezier(0.22, 1, 0.36, 1)';
    });
  });

  // Clear inputs
  optInputs.forEach(inp => inp.value = '');
  contextInput.value = '';
  checkReady();

  showScreen('setup');
});

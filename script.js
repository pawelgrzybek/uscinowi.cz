const PHONE = "506186821";

const board = document.getElementById("board");

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// One split-flap card: the static halves show the resting state, and two
// flaps fold over them to swap the old digit for the new one.
class Flap {
  constructor() {
    this.value = "";
    this.el = document.createElement("div");
    this.el.className = "flap";
    this.el.innerHTML = `
      <div class="half top"><span></span></div>
      <div class="half bottom"><span></span></div>
      <div class="half top fold"><span></span></div>
      <div class="half bottom unfold"><span></span></div>`;
    [this.top, this.bottom, this.fold, this.unfold] = [...this.el.children].map((half) => half.firstElementChild);
  }

  set(value) {
    this.value = value;
    for (const span of [this.top, this.bottom, this.fold, this.unfold]) span.textContent = value;
  }

  async flip(next, duration) {
    const foldEl = this.fold.parentElement;
    const unfoldEl = this.unfold.parentElement;

    this.top.textContent = next;
    this.bottom.textContent = this.value;
    this.fold.textContent = this.value;
    this.unfold.textContent = next;

    const fold = foldEl.animate([{ transform: "rotateX(0deg)" }, { transform: "rotateX(-90deg)" }], {
      duration: duration / 2,
      easing: "ease-in",
      fill: "forwards",
    });
    await fold.finished;

    const unfold = unfoldEl.animate([{ transform: "rotateX(90deg)" }, { transform: "rotateX(0deg)" }], {
      duration: duration / 2,
      easing: "ease-out",
      fill: "forwards",
    });
    await unfold.finished;

    this.set(next);
    fold.cancel();
    unfold.cancel();
  }
}

const DIGITS = [..."0123456789"];
const LETTERS = [..."ABCDEFGHIJKLMNOPRSTUWYZĄĆĘŁŃÓŚŹŻ"];

// Nine-letter phrases about the work: an adjective, then a noun on the next pull
const PHRASES = [
  ["WONDERFUL", "BRANDBOOK"],
  ["FANTASTIC", "WEBDESIGN"],
  ["INSPIRING", "MOODBOARD"],
];

// Lay out one flap per character, in groups (a group never breaks across lines)
function buildBoard(el, groups) {
  const flaps = [];
  for (const text of groups) {
    const group = document.createElement("div");
    group.className = "group";
    for (let i = 0; i < text.length; i++) {
      const flap = new Flap();
      group.append(flap.el);
      flaps.push(flap);
    }
    el.append(group);
  }
  return flaps;
}

const digits = PHONE.replace(/\D/g, "").split("");
const flaps = buildBoard(board, digits.join("").match(/.{1,3}/g));

function randomFrom(pool, except) {
  let char;
  do char = pool[Math.floor(Math.random() * pool.length)];
  while (char === except);
  return char;
}

// A card shuffles random characters, then locks onto its target
async function shuffleTo(flap, target, stopAt, pool) {
  while (performance.now() < stopAt) {
    await flap.flip(randomFrom(pool, flap.value), 90);
  }
  if (flap.value !== target) await flap.flip(target, 280);
}

// Shuffle every card on a board, then lock them on one by one from the left
async function shuffleBoard(cards, targets, pool, stagger) {
  if (reducedMotion) {
    cards.forEach((flap, i) => flap.set(targets[i]));
    return;
  }
  const start = performance.now();
  await Promise.all(cards.map((flap, i) => shuffleTo(flap, targets[i], start + 900 + i * stagger, pool)));
}

// While the number is up, the whole board is a tap-to-call link
function makeCallable() {
  board.href = `tel:+48${digits.join("")}`;
  board.setAttribute("aria-label", `Zadzwoń: ${PHONE.replace(/(\d{3})(?=\d)/g, "$1 ")}`);
}

function removeCallable() {
  board.removeAttribute("href");
  board.removeAttribute("aria-label");
}

let running = false;

const IDLE_RESET = 10000;
let round = [];
let idleTimer;

// Each round shows the phrases in a random order, then CALLMENOW, then the number
function nextUp() {
  if (round.length === 0) round = [...[...PHRASES].sort(() => Math.random() - 0.5).flat(), "CALLMENOW", PHONE];
  return round.shift();
}

// The result stays until the next pull, which works as soon as the reels stop
async function reveal() {
  if (running) return;
  running = true;
  clearTimeout(idleTimer);
  const next = nextUp();
  const showNumber = next === PHONE;

  removeCallable();
  await shuffleBoard(flaps, [...next], showNumber ? DIGITS : LETTERS, 220);
  if (showNumber) makeCallable();
  running = false;
  idleTimer = setTimeout(resetBoard, IDLE_RESET);
}

// The phone button skips the words and shuffles straight to the number;
// the next pull of the lever starts a fresh round
async function showPhone() {
  if (running) return;
  running = true;
  clearTimeout(idleTimer);
  round = [];
  removeCallable();
  await shuffleBoard(flaps, digits, DIGITS, 110);
  makeCallable();
  running = false;
  idleTimer = setTimeout(resetBoard, IDLE_RESET);
}

document.getElementById("dial").addEventListener("click", showPhone);

// Left alone for a while, the board blanks, the neons switch off and the
// round starts over
async function resetBoard() {
  if (running) return;
  running = true;
  removeCallable();
  setNeon(false);
  await shuffleBoard(flaps, digits.map(() => ""), DIGITS, 220);
  round = [];
  running = false;
}

// Slot machine lever beside the board: drag the knob down (or just click)
// and the cards spin like reels
const lever = document.getElementById("lever");
const arm = lever.querySelector(".lever__arm");
const knob = lever.querySelector(".lever__knob");
const knobDot = lever.querySelector(".lever__knob-dot");
const KNOB_UP = 20;
const KNOB_DOWN = 240;
const PULL_TRIGGER = 0.6;

let pull = 0;
let dragStartY = null;
let dragStartPull = 0;
let dragged = false;

function setPull(p) {
  pull = p;
  const y = KNOB_UP + p * (KNOB_DOWN - KNOB_UP);
  arm.setAttribute("y2", y);
  knob.setAttribute("cy", y);
  knobDot.setAttribute("cy", y - 4.5); // up and to the right, like a highlight
}

// the lever snaps back up with a little wobble
function releaseLever() {
  const from = pull;
  const start = performance.now();
  const duration = reducedMotion ? 1 : 550;

  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    setPull(Math.max(-0.06, from * Math.exp(-5 * t) * Math.cos(t * Math.PI * 3)));
    if (t < 1) requestAnimationFrame(step);
    else setPull(0);
  }

  requestAnimationFrame(step);
}

function animatePull(to, duration) {
  const from = pull;
  const start = performance.now();
  return new Promise((resolve) => {
    function step(now) {
      const t = Math.min((now - start) / duration, 1);
      setPull(from + (to - from) * t * t);
      if (t < 1) requestAnimationFrame(step);
      else resolve();
    }
    requestAnimationFrame(step);
  });
}

lever.addEventListener("pointerdown", (event) => {
  dragStartY = event.clientY;
  dragStartPull = pull;
  dragged = false;
  lever.setPointerCapture(event.pointerId);
});

lever.addEventListener("pointermove", (event) => {
  if (dragStartY === null) return;
  const unitsPerPx = 160 / lever.offsetHeight;
  const dy = (event.clientY - dragStartY) * unitsPerPx;
  if (Math.abs(dy) > 4) dragged = true;
  setPull(Math.min(Math.max(dragStartPull + dy / (KNOB_DOWN - KNOB_UP), 0), 1));
});

lever.addEventListener("pointerup", () => {
  dragStartY = null;
  if (!dragged) return;
  if (pull >= PULL_TRIGGER) reveal();
  releaseLever();
});

// a plain click (or the keyboard) pulls the lever all the way by itself
lever.addEventListener("click", async () => {
  if (dragged) {
    dragged = false;
    return;
  }
  if (!reducedMotion) await animatePull(1, 220);
  reveal();
  releaseLever();
});


// Neon logo above the board and the e-mail below: both sit there as dark,
// barely visible tubes until the switch in the corner lights them up. Lit,
// the logo runs frame by frame like an old Las Vegas sign: the leg swings
// back in three steps while the cap tumbles away.
const SIGN_FRAMES = 6; // the leg and the cap each step through three poses, twice
const SIGN_FRAME_TIME = 550;
const cornerSwitch = document.getElementById("switch");
const mail = document.getElementById("mail");
const sign = document.querySelector(".sign");
const tubes = [...sign.querySelectorAll(".tube")].map((el) => ({
  el,
  frames: el.dataset.frames ? el.dataset.frames.split(" ").map(Number) : null,
}));
let signFrame = 0;
let signTimer;
let flickerTimer;

function showSignFrame() {
  for (const { el, frames } of tubes) el.classList.toggle("is-lit", !frames || frames.includes(signFrame));
}

// a stutter every few seconds while lit
function scheduleFlicker() {
  flickerTimer = setTimeout(() => {
    sign.classList.add("is-flickering");
    setTimeout(() => sign.classList.remove("is-flickering"), 500);
    scheduleFlicker();
  }, 5000 + Math.random() * 6000);
}

function setNeon(on) {
  cornerSwitch.setAttribute("aria-pressed", String(on));
  sign.classList.toggle("is-on", on);
  mail.classList.toggle("is-on", on);
  clearInterval(signTimer);
  clearTimeout(flickerTimer);
  signFrame = 0;
  showSignFrame();

  if (on && !reducedMotion) {
    signTimer = setInterval(() => {
      signFrame = (signFrame + 1) % SIGN_FRAMES;
      showSignFrame();
    }, SIGN_FRAME_TIME);
    scheduleFlicker();
  }
}

setNeon(false);

cornerSwitch.addEventListener("click", () => {
  setNeon(cornerSwitch.getAttribute("aria-pressed") !== "true");
});

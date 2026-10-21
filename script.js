const PHONE = "506186821";

const board = document.getElementById("board");
const button = document.getElementById("reveal");

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

const digits = PHONE.replace(/\D/g, "").split("");
const flaps = digits.map(() => new Flap());

for (let i = 0; i < flaps.length; i += 3) {
  const group = document.createElement("div");
  group.className = "group";
  flaps.slice(i, i + 3).forEach((flap) => group.append(flap.el));
  board.append(group);
}

function randomDigit(except) {
  let digit;
  do digit = String(Math.floor(Math.random() * 10));
  while (digit === except);
  return digit;
}

// Every card shuffles random digits, then they lock onto the number one by one
async function shuffleTo(flap, target, stopAt) {
  while (performance.now() < stopAt) {
    await flap.flip(randomDigit(flap.value), 90);
  }
  if (flap.value !== target) await flap.flip(target, 280);
}

const SHOW_FOR = 10000;

// While the number is up, the whole board is a tap-to-call link
function makeCallable() {
  board.href = `tel:+48${digits.join("")}`;
  board.setAttribute("aria-label", `Zadzwoń: ${PHONE.replace(/(\d{3})(?=\d)/g, "$1 ")}`);
}

function removeCallable() {
  board.removeAttribute("href");
  board.removeAttribute("aria-label");
}

// Shuffle every card, then lock them onto the targets one by one from the left
async function shuffleAll(targets) {
  if (reducedMotion) {
    flaps.forEach((flap, i) => flap.set(targets[i]));
    return;
  }
  const start = performance.now();
  await Promise.all(flaps.map((flap, i) => shuffleTo(flap, targets[i], start + 900 + i * 220)));
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let running = false;

// Show the number for a while, then shuffle again and blank the board
async function reveal() {
  if (running) return;
  running = true;

  await shuffleAll(digits);
  makeCallable();

  await sleep(SHOW_FOR);

  removeCallable();
  await shuffleAll(digits.map(() => ""));
  running = false;
}

// Short comic-style "click!" marks fanning out above the cap
const burst = button.querySelector(".press__burst");

for (const angle of [165, 200, 235, 270, 305, 340, 15]) {
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);
  const x = 80 + cos * 62;
  const y = 42 + sin * 26;
  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", x);
  line.setAttribute("y1", y);
  line.setAttribute("x2", x + cos * 14);
  line.setAttribute("y2", y + sin * 14);
  line.style.setProperty("--dx", `${cos * 10}px`);
  line.style.setProperty("--dy", `${sin * 10}px`);
  burst.append(line);
}

// The cap goes down, the "click!" marks fire and the board starts shuffling
function pressButton() {
  // keep the cap down for a moment so the press is visible
  button.classList.add("is-pressed");
  setTimeout(() => button.classList.remove("is-pressed"), 120);

  // restart the burst animation on every press
  button.classList.remove("is-clicked");
  void button.offsetWidth;
  button.classList.add("is-clicked");

  reveal();
}

// An outline ball drops from the top of the screen, hits the button and
// bounces off to the side
const BALL = 36;
const GRAVITY = 2800;

const ball = document.createElement("div");
ball.className = "ball";
ball.hidden = true;
ball.innerHTML = `
  <svg viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="19" />
    <path d="M7 7 C15 15 15 25 7 33 M33 7 C25 15 25 25 33 33" />
  </svg>`;
document.body.append(ball);
const ballShape = ball.firstElementChild;

let ballFlying = false;

function dropBall() {
  ballFlying = true;

  // where the top of the cap is on screen (cap top sits at y=26 of the 160-wide viewBox)
  const rect = button.getBoundingClientRect();
  const scale = rect.width / 160;
  const capTop = rect.top + 26 * scale;

  let x = rect.left + 80 * scale - BALL / 2;
  let y = -BALL - 20;
  let vx = 0;
  let vy = 0;
  let angle = 0;
  let hit = false;
  let last = performance.now();

  ball.hidden = false;

  function step(now) {
    const dt = Math.min((now - last) / 1000, 0.032);
    last = now;

    vy += GRAVITY * dt;
    x += vx * dt;
    y += vy * dt;
    angle += ((vx * dt) / (BALL / 2)) * (180 / Math.PI);

    if (!hit && y + BALL >= capTop) {
      hit = true;
      y = capTop - BALL;
      vy *= -0.42;
      vx = (Math.random() < 0.5 ? -1 : 1) * (140 + Math.random() * 80);

      ballShape.classList.add("is-squashed");
      setTimeout(() => ballShape.classList.remove("is-squashed"), 90);
      pressButton();
    }

    ball.style.transform = `translate(${x}px, ${y}px) rotate(${angle}deg)`;

    if (y > window.innerHeight + BALL) {
      ball.hidden = true;
      ballFlying = false;
      return;
    }
    requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

button.addEventListener("click", () => {
  if (ballFlying || running) return;

  if (reducedMotion) pressButton();
  else dropBall();
});

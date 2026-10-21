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

// Once the number is up, the whole board becomes a tap-to-call link
function makeCallable() {
  board.href = `tel:+48${digits.join("")}`;
  board.setAttribute("aria-label", `Zadzwoń: ${PHONE.replace(/(\d{3})(?=\d)/g, "$1 ")}`);
}

let running = false;

async function reveal() {
  if (running) return;
  running = true;

  if (reducedMotion) {
    flaps.forEach((flap, i) => flap.set(digits[i]));
  } else {
    const start = performance.now();
    await Promise.all(flaps.map((flap, i) => shuffleTo(flap, digits[i], start + 900 + i * 220)));
  }

  makeCallable();
  running = false;
}

// Keep the cap down for a moment so even a quick tap shows the press
button.addEventListener("click", () => {
  button.classList.add("is-pressed");
  setTimeout(() => button.classList.remove("is-pressed"), 120);
  reveal();
});

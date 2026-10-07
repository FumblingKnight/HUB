const pages = [
  {
    title: "AniList Pull",
    kicker: "MEDIA / TRACKING",
    hint: "Everything I’m watching and reading, pulled into my own view.",
    description: "AniList data, current media, scores and stats without living inside AniList itself.",
    href: "/anilist/",
    accent: "#69e5ff",
    rgb: "105,229,255",
    themeA: "18,74,91",
    themeB: "10,31,48"
  },
  {
    title: "Second Brain",
    kicker: "KNOWLEDGE / NOTES",
    hint: "The map behind the things I learn, connect and keep.",
    description: "Notes, links and ideas arranged as a living knowledge system instead of a folder graveyard.",
    href: "/brain/",
    accent: "#b993ff",
    rgb: "185,147,255",
    themeA: "67,39,105",
    themeB: "29,20,54"
  },
  {
    title: "Projects",
    kicker: "BUILD / SHIP",
    hint: "Things that escaped the notes folder and became real.",
    description: "Websites, tools, automations and longer projects — finished, unfinished and somewhere in between.",
    href: "/projects/",
    accent: "#ff9d55",
    rgb: "255,157,85",
    themeA: "101,54,24",
    themeB: "47,27,15"
  },
  {
    title: "Experiments",
    kicker: "LAB / MISC",
    hint: "Small ideas that are too fun to leave alone.",
    description: "Tiny interactive things, prototypes and weird one-off ideas that don’t need their own whole website.",
    href: "/experiments/",
    accent: "#a5ff67",
    rgb: "165,255,103",
    themeA: "50,86,32",
    themeB: "22,46,22"
  },
  {
    title: "About",
    kicker: "PROFILE / LINKS",
    hint: "The short version of who made all of this.",
    description: "About me, places I’m online, and the handful of links that actually matter.",
    href: "/about/",
    accent: "#ff6a7d",
    rgb: "255,106,125",
    themeA: "91,34,49",
    themeB: "46,19,29"
  }
];

const items = [...document.querySelectorAll(".selector-item")];
const title = document.getElementById("pageTitle");
const kicker = document.getElementById("kicker");
const hint = document.getElementById("pageHint");
const description = document.getElementById("descriptionText");
const descriptionIndex = document.getElementById("descriptionIndex");
const enterLink = document.getElementById("enterLink");

const drawer = document.getElementById("drawer");
const hamburger = document.getElementById("hamburger");
const drawerClose = document.getElementById("drawerClose");
const scrim = document.getElementById("scrim");

let position = 0;
let target = 0;
let velocity = 0;
let activeIndex = 0;
let wheelEndTimer = null;
let lastFrame = performance.now();
let rafId = null;

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
const lerp = (a, b, t) => a + (b - a) * t;

function updateTheme(index, immediate = false) {
  if (index === activeIndex && !immediate) return;
  activeIndex = index;
  const page = pages[index];

  document.documentElement.style.setProperty("--accent", page.accent);
  document.documentElement.style.setProperty("--accent-rgb", page.rgb);
  document.documentElement.style.setProperty("--theme-a", page.themeA);
  document.documentElement.style.setProperty("--theme-b", page.themeB);

  [title, kicker, hint, description].forEach(el => el.classList.add("swap"));

  window.setTimeout(() => {
    title.textContent = page.title;
    kicker.textContent = page.kicker;
    hint.textContent = page.hint;
    description.textContent = page.description;
    descriptionIndex.textContent = String(index + 1).padStart(2, "0");
    enterLink.href = page.href;
    [title, kicker, hint, description].forEach(el => el.classList.remove("swap"));
  }, immediate ? 0 : 90);
}

function renderItems() {
  items.forEach((item, i) => {
    const signed = i - position;
    const distance = Math.abs(signed);

    const y = signed * 108;
    const width = clamp(100 - distance * 23, 34, 100);
    const scale = clamp(1 - distance * 0.12, 0.62, 1);
    const opacity = clamp(1 - distance * 0.28, 0.12, 1);
    const blur = clamp((distance - 1) * 0.35, 0, 1.2);

    item.style.setProperty("--item-y", y.toFixed(2) + "px");
    item.style.setProperty("--item-width", width.toFixed(2) + "%");
    item.style.setProperty("--item-scale", scale.toFixed(3));
    item.style.setProperty("--item-opacity", opacity.toFixed(3));
    item.style.setProperty("--item-blur", blur.toFixed(2) + "px");

    const isNearest = i === Math.round(position);
    item.classList.toggle("active", isNearest);
    item.setAttribute("aria-current", isNearest ? "page" : "false");
  });

  const nearest = clamp(Math.round(position), 0, pages.length - 1);
  updateTheme(nearest);
}

function animate(now) {
  const dt = Math.min((now - lastFrame) / 16.667, 2);
  lastFrame = now;

  const spring = 0.115;
  const damping = 0.79;

  const force = (target - position) * spring;
  velocity = (velocity + force * dt) * Math.pow(damping, dt);
  position += velocity * dt;

  if (Math.abs(target - position) < 0.0005 && Math.abs(velocity) < 0.0005) {
    position = target;
    velocity = 0;
  }

  renderItems();
  rafId = requestAnimationFrame(animate);
}

function snapToNearest() {
  target = clamp(Math.round(target), 0, pages.length - 1);
}

window.addEventListener("wheel", event => {
  if (drawer.classList.contains("open")) return;

  const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  if (Math.abs(dominant) < 0.5) return;

  event.preventDefault();

  const modeMultiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 120 : 1;
  const delta = dominant * modeMultiplier;

  target = clamp(target + delta * 0.0024, 0, pages.length - 1);

  clearTimeout(wheelEndTimer);
  wheelEndTimer = setTimeout(snapToNearest, 110);
}, { passive: false });

document.addEventListener("keydown", event => {
  if (drawer.classList.contains("open")) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    target = clamp(Math.round(target) + 1, 0, pages.length - 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    target = clamp(Math.round(target) - 1, 0, pages.length - 1);
  } else if (event.key === "Enter") {
    location.href = pages[clamp(Math.round(position), 0, pages.length - 1)].href;
  }
});

items.forEach((item, index) => {
  item.addEventListener("mouseenter", () => {
    if (Math.abs(index - position) < 1.25) target = index;
  });
});

function setDrawer(open) {
  drawer.classList.toggle("open", open);
  scrim.classList.toggle("show", open);
  drawer.setAttribute("aria-hidden", String(!open));
  hamburger.setAttribute("aria-expanded", String(open));
}

hamburger.addEventListener("click", () => setDrawer(true));
drawerClose.addEventListener("click", () => setDrawer(false));
scrim.addEventListener("click", () => setDrawer(false));

updateTheme(0, true);
renderItems();
rafId = requestAnimationFrame(animate);

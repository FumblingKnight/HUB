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

let activeIndex = 0;
let wheelAccumulator = 0;
let wheelLocked = false;

function setItemGeometry() {
  items.forEach((item, i) => {
    const signed = i - activeIndex;
    const distance = Math.abs(signed);

    const y = signed * 102;
    const widths = [100, 72, 55, 43, 35];
    const scales = [1, .90, .80, .72, .66];
    const opacities = [1, .74, .46, .28, .16];

    item.style.setProperty("--item-y", y + "px");
    item.style.setProperty("--item-width", widths[Math.min(distance, 4)] + "%");
    item.style.setProperty("--item-scale", scales[Math.min(distance, 4)]);
    item.style.setProperty("--item-opacity", opacities[Math.min(distance, 4)]);
    item.classList.toggle("active", distance === 0);
    item.setAttribute("aria-current", distance === 0 ? "page" : "false");
  });
}

function select(index) {
  activeIndex = Math.max(0, Math.min(pages.length - 1, index));
  const page = pages[activeIndex];

  setItemGeometry();

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
    descriptionIndex.textContent = String(activeIndex + 1).padStart(2, "0");
    enterLink.href = page.href;
    [title, kicker, hint, description].forEach(el => el.classList.remove("swap"));
  }, 125);
}

function moveSelection(direction) {
  const next = Math.max(0, Math.min(pages.length - 1, activeIndex + direction));
  if (next !== activeIndex) select(next);
}

window.addEventListener("wheel", event => {
  if (document.getElementById("drawer").classList.contains("open")) return;

  const dominant = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
  if (Math.abs(dominant) < 1) return;

  event.preventDefault();
  wheelAccumulator += dominant;

  if (!wheelLocked && Math.abs(wheelAccumulator) > 34) {
    moveSelection(wheelAccumulator > 0 ? 1 : -1);
    wheelAccumulator = 0;
    wheelLocked = true;
    window.setTimeout(() => { wheelLocked = false; }, 170);
  }

  window.clearTimeout(window.__wheelReset);
  window.__wheelReset = window.setTimeout(() => { wheelAccumulator = 0; }, 220);
}, { passive: false });

document.addEventListener("keydown", event => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    moveSelection(1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    moveSelection(-1);
  } else if (event.key === "Enter" && !document.getElementById("drawer").classList.contains("open")) {
    location.href = pages[activeIndex].href;
  }
});

const drawer = document.getElementById("drawer");
const hamburger = document.getElementById("hamburger");
const drawerClose = document.getElementById("drawerClose");
const scrim = document.getElementById("scrim");

function setDrawer(open) {
  drawer.classList.toggle("open", open);
  scrim.classList.toggle("show", open);
  drawer.setAttribute("aria-hidden", String(!open));
  hamburger.setAttribute("aria-expanded", String(open));
}

hamburger.addEventListener("click", () => setDrawer(true));
drawerClose.addEventListener("click", () => setDrawer(false));
scrim.addEventListener("click", () => setDrawer(false));

select(0);

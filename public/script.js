const pages = [
  {
    title: "AniList Pull",
    kicker: "MEDIA / TRACKING",
    hint: "A live view of what I’m watching, reading and rating.",
    description: "Pull my AniList data into one clean dashboard — current shows, manga, scores and stats.",
    href: "#anilist",
    accent: "#69e5ff",
    rgb: "105,229,255"
  },
  {
    title: "Second Brain",
    kicker: "KNOWLEDGE / NOTES",
    hint: "The map behind the things I learn, connect and keep.",
    description: "A front door into my second brain: notes, connections, references and whatever I’m thinking about lately.",
    href: "#brain",
    accent: "#b993ff",
    rgb: "185,147,255"
  },
  {
    title: "Projects",
    kicker: "BUILD / SHIP",
    hint: "Stuff that escaped the notes folder and became real.",
    description: "A shelf for websites, tools, automations and longer projects — finished, unfinished and somewhere in between.",
    href: "#projects",
    accent: "#ff9d55",
    rgb: "255,157,85"
  },
  {
    title: "Experiments",
    kicker: "LAB / MISC",
    hint: "Small ideas that are too fun to leave alone.",
    description: "Tiny interactive things, half-serious prototypes and experiments that don’t need their own whole website.",
    href: "#lab",
    accent: "#a5ff67",
    rgb: "165,255,103"
  },
  {
    title: "About",
    kicker: "PROFILE / LINKS",
    hint: "The short version of who made all of this.",
    description: "About me, places I’m online, and the handful of links that actually matter.",
    href: "#about",
    accent: "#ff6a7d",
    rgb: "255,106,125"
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

function select(index) {
  activeIndex = (index + pages.length) % pages.length;
  const page = pages[activeIndex];

  items.forEach((item, i) => {
    item.classList.toggle("active", i === activeIndex);
    item.setAttribute("aria-current", i === activeIndex ? "page" : "false");
  });

  document.documentElement.style.setProperty("--accent", page.accent);
  document.documentElement.style.setProperty("--accent-rgb", page.rgb);

  [title, kicker, hint, description].forEach(el => el.classList.add("swap"));
  requestAnimationFrame(() => {
    title.textContent = page.title;
    kicker.textContent = page.kicker;
    hint.textContent = page.hint;
    description.textContent = page.description;
    descriptionIndex.textContent = String(activeIndex + 1).padStart(2, "0");
    enterLink.href = page.href;
    requestAnimationFrame(() => [title, kicker, hint, description].forEach(el => el.classList.remove("swap")));
  });
}

items.forEach((item, index) => {
  item.addEventListener("click", () => select(index));
  item.addEventListener("dblclick", () => location.href = pages[index].href);
});

document.addEventListener("keydown", event => {
  if (event.key === "ArrowDown") {
    event.preventDefault();
    select(activeIndex + 1);
  } else if (event.key === "ArrowUp") {
    event.preventDefault();
    select(activeIndex - 1);
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

import { getUser, getLists, getActivities, getAiringWeek } from '/anilist/api.js';

const USERNAME = 'fumblingknight';
const WEEKDAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SHORT_DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
const SCHEDULE_KEY = 'sajo_manga_schedule_v1';

const state = {
  user: null,
  anime: [],
  manga: [],
  activities: [],
  weekOffset: 0,
  progressFilter: 'ALL',
  activityVisible: 8,
  schedules: loadSchedules(),
  inferred: new Map()
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (value = '') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

function titleOf(media) {
  return media?.title?.userPreferred || media?.title?.english || media?.title?.romaji || 'Untitled';
}

function flattenCollection(collection) {
  const map = new Map();
  for (const list of collection?.lists || []) {
    for (const entry of list?.entries || []) {
      if (!entry?.mediaId) continue;
      map.set(entry.mediaId, entry);
    }
  }
  return [...map.values()];
}

function currentEntries(entries) {
  return entries.filter(e => ['CURRENT','REPEATING'].includes(e.status));
}

function mondayStart(date = new Date()) {
  const d = new Date(date);
  d.setHours(0,0,0,0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatTime(date) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date);
}

function formatRelative(seconds) {
  const diff = Date.now() - seconds * 1000;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric' }).format(new Date(seconds * 1000));
}

function daysSince(seconds) {
  return Math.max(0, Math.floor((Date.now() - seconds * 1000) / 86400000));
}

function mediaHref(media) {
  return `/anilist/media/?id=${media.id}&type=${media.type || ''}`;
}

function loadSchedules() {
  try { return JSON.parse(localStorage.getItem(SCHEDULE_KEY) || '{}'); }
  catch { return {}; }
}

function toast(message) {
  const node = $('#toast');
  node.textContent = message;
  node.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => node.classList.remove('show'), 2200);
}

async function init() {
  bindEvents();
  try {
    const userData = await getUser(USERNAME);
    state.user = userData.User;
    renderAccount();

    const [listsData, activityData] = await Promise.all([
      getLists(state.user.id),
      getActivities(state.user.id, 1, 50)
    ]);

    state.anime = currentEntries(flattenCollection(listsData.anime));
    state.manga = currentEntries(flattenCollection(listsData.manga));
    state.activities = (activityData.Page?.activities || []).filter(Boolean);
    state.inferred = inferMangaCadence(state.activities);

    renderStats();
    renderProgress();
    renderActivity();
    renderMangaPulse();
    renderScheduleSettings();
    await renderCalendar();
  } catch (error) {
    console.error(error);
    renderFailure(error);
  }
}

function renderAccount() {
  $('#profileName').textContent = state.user.name;
  $('#profileLink').href = state.user.siteUrl || `https://anilist.co/user/${USERNAME}/`;
  $('#accountStatus').textContent = state.user.name;
  $('#accountMeta').textContent = 'public AniList data · live';
  const avatar = $('#avatar');
  avatar.classList.remove('skeleton');
  avatar.style.backgroundImage = `url(${state.user.avatar?.large || ''})`;
  if (state.user.bannerImage) {
    document.documentElement.style.setProperty('--user-banner', `url(${state.user.bannerImage})`);
  }
}

function renderStats() {
  const animeStats = state.user.statistics?.anime;
  const mangaStats = state.user.statistics?.manga;
  const meanParts = [animeStats?.meanScore, mangaStats?.meanScore].filter(n => Number.isFinite(n) && n > 0);
  const mean = meanParts.length ? (meanParts.reduce((a,b) => a+b, 0) / meanParts.length).toFixed(1) : '—';
  const values = [state.anime.length, state.manga.length, mean];
  $$('.intro-stats strong').forEach((el, i) => el.textContent = values[i]);
}

async function renderCalendar() {
  const grid = $('#calendarGrid');
  grid.innerHTML = '<div class="calendar-loading">Building your week…</div>';

  const start = addDays(mondayStart(), state.weekOffset * 7);
  const end = addDays(start, 7);
  $('#weekRange').textContent = `${fmtDate(start)} — ${fmtDate(addDays(end, -1))}`;
  $('#todayWeek').textContent = state.weekOffset === 0 ? 'THIS WEEK' : 'TODAY';

  let airing = [];
  try {
    const ids = state.anime.map(e => e.mediaId);
    const data = await getAiringWeek(ids, Math.floor(start.getTime()/1000)-1, Math.floor(end.getTime()/1000));
    airing = data.Page?.airingSchedules || [];
  } catch (error) {
    console.warn('Airing schedule failed', error);
  }

  const events = buildCalendarEvents(start, end, airing);
  grid.innerHTML = '';

  for (let i = 0; i < 7; i++) {
    const day = addDays(start, i);
    const dayEvents = events.filter(e => sameDay(e.date, day)).sort((a,b) => a.date - b.date);
    const col = document.createElement('section');
    col.className = `day-column${sameDay(day, new Date()) ? ' today' : ''}`;
    col.innerHTML = `
      <header class="day-head">
        <span>${WEEKDAYS[i]}</span>
        <b>${day.getDate()}</b>
      </header>
      <div class="day-events"></div>
    `;
    const holder = $('.day-events', col);
    if (!dayEvents.length) {
      holder.innerHTML = '<div class="empty-day">quiet</div>';
    } else {
      for (const event of dayEvents) holder.appendChild(calendarCard(event));
    }
    grid.appendChild(col);
  }
}

function buildCalendarEvents(start, end, airing) {
  const events = [];

  for (const air of airing) {
    events.push({
      kind: 'anime',
      date: new Date(air.airingAt * 1000),
      media: air.media,
      label: `EP ${air.episode}`,
      sub: formatTime(new Date(air.airingAt * 1000)),
      certainty: 'airing'
    });
  }

  // Logged manga activity is historical truth about *your list update*, not a release claim.
  for (const activity of state.activities) {
    if (activity.media?.type !== 'MANGA') continue;
    const date = new Date(activity.createdAt * 1000);
    if (date < start || date >= end) continue;
    events.push({
      kind: 'manga', date, media: activity.media,
      label: activity.progress ? `CH ${cleanProgress(activity.progress)}` : 'MANGA',
      sub: 'logged', certainty: 'logged'
    });
  }

  const mangaById = new Map(state.manga.map(e => [String(e.mediaId), e]));

  for (const [id, rule] of Object.entries(state.schedules)) {
    if (!rule?.enabled || rule.weekday === '' || !mangaById.has(id)) continue;
    const entry = mangaById.get(id);
    const weekday = Number(rule.weekday);
    const date = addDays(start, weekday);
    if (rule.cadence === 'biweekly') {
      const anchor = latestMangaActivity(Number(id));
      if (anchor) {
        const weeks = Math.round((mondayStart(date) - mondayStart(new Date(anchor.createdAt*1000))) / (7*86400000));
        if (Math.abs(weeks) % 2 === 1) continue;
      }
    }
    events.push({
      kind:'manga', date:setNoon(date), media:entry.media,
      label:`CH ${entry.progress + 1}?`, sub: rule.cadence === 'biweekly' ? 'set · 2w' : 'set · weekly', certainty:'set'
    });
  }

  // Learned cadence is deliberately lower confidence and never overrides a pinned schedule.
  for (const [mediaId, inferred] of state.inferred.entries()) {
    if (state.schedules[String(mediaId)]?.enabled) continue;
    const entry = state.manga.find(e => e.mediaId === mediaId);
    if (!entry || inferred.confidence < 0.68) continue;
    let next = new Date(inferred.lastAt * 1000 + inferred.days * 86400000);
    while (next < start) next = new Date(next.getTime() + inferred.days * 86400000);
    if (next >= end) continue;
    if (next.getTime() < Date.now() - 12*3600000) continue;
    events.push({
      kind:'manga', date:setNoon(next), media:entry.media,
      label:`CH ${entry.progress + 1}?`, sub:`est. ~${inferred.days}d`, certainty:'estimate'
    });
  }

  return dedupeEvents(events);
}

function calendarCard(event) {
  const a = document.createElement('a');
  a.className = `calendar-card ${event.kind} ${event.certainty}`;
  a.href = mediaHref(event.media);
  const color = event.media.coverImage?.color || (event.kind === 'anime' ? '#3db4f2' : '#bc7cff');
  a.style.setProperty('--cover-color', color);
  a.innerHTML = `
    <img src="${esc(event.media.coverImage?.medium || '')}" alt="" loading="lazy" />
    <div class="cal-copy">
      <strong>${esc(titleOf(event.media))}</strong>
      <span class="cal-meta"><b>${esc(event.label)}</b><i>${esc(event.sub)}</i></span>
    </div>
  `;
  return a;
}

function dedupeEvents(events) {
  const seen = new Set();
  return events.filter(e => {
    const key = `${e.media.id}:${e.kind}:${e.date.toDateString()}:${e.certainty}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
}

function setNoon(date) {
  const d = new Date(date); d.setHours(12,0,0,0); return d;
}

function cleanProgress(progress) {
  return String(progress).replace(/^.*?(\d+(?:\.\d+)?).*$/, '$1');
}

function inferMangaCadence(activities) {
  const byMedia = new Map();
  for (const a of activities) {
    if (a.media?.type !== 'MANGA' || !a.progress) continue;
    if (!byMedia.has(a.media.id)) byMedia.set(a.media.id, []);
    byMedia.get(a.media.id).push(a);
  }

  const result = new Map();
  for (const [id, arr] of byMedia.entries()) {
    const sorted = arr.sort((a,b) => a.createdAt - b.createdAt);
    if (sorted.length < 2) continue;
    const intervals = [];
    for (let i=1;i<sorted.length;i++) {
      const days = (sorted[i].createdAt - sorted[i-1].createdAt) / 86400;
      if (days >= 2 && days <= 40) intervals.push(days);
    }
    if (!intervals.length) continue;
    intervals.sort((a,b)=>a-b);
    const median = intervals[Math.floor(intervals.length/2)];
    let cadence = null;
    if (median >= 5 && median <= 9.5) cadence = 7;
    else if (median >= 11 && median <= 18) cadence = 14;
    else if (median >= 24 && median <= 38) cadence = 30;
    if (!cadence) continue;
    const error = Math.abs(median - cadence);
    const confidence = Math.max(.5, Math.min(.92, .88 - error / cadence));
    result.set(id, { days: cadence, confidence, lastAt: sorted.at(-1).createdAt });
  }
  return result;
}

function latestMangaActivity(mediaId) {
  return state.activities.find(a => a.media?.type === 'MANGA' && a.media?.id === mediaId) || null;
}

function renderProgress() {
  const strip = $('#progressStrip');
  const entries = [...state.anime, ...state.manga]
    .filter(e => state.progressFilter === 'ALL' || e.media.type === state.progressFilter)
    .sort((a,b) => b.updatedAt - a.updatedAt);

  strip.innerHTML = entries.map(entry => {
    const media = entry.media;
    const total = media.type === 'ANIME' ? media.episodes : media.chapters;
    const progress = media.type === 'MANGA' ? `Ch ${entry.progress}${total ? ` / ${total}` : ''}` : `${entry.progress}${total ? ` / ${total}` : ''} eps`;
    const next = media.nextAiringEpisode ? countdown(media.nextAiringEpisode.timeUntilAiring) : '';
    return `
      <a class="progress-card" href="${mediaHref(media)}" style="--cover:${esc(media.coverImage?.color || '#3db4f2')}">
        <div class="cover-wrap">
          <img src="${esc(media.coverImage?.large || media.coverImage?.medium || '')}" alt="${esc(titleOf(media))}" loading="lazy" />
          <span class="type-pill ${media.type.toLowerCase()}">${media.type === 'ANIME' ? 'ANIME' : 'MANGA'}</span>
          <div class="cover-progress"><span>${esc(progress)}</span></div>
        </div>
        <strong>${esc(titleOf(media))}</strong>
        <span>${next || (entry.score ? `score ${entry.score}` : 'in progress')}</span>
      </a>
    `;
  }).join('') || '<div class="strip-loading">Nothing here.</div>';
}

function countdown(seconds) {
  if (!Number.isFinite(seconds)) return '';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  return d > 0 ? `next in ${d}d ${h}h` : `next in ${h}h`;
}

function renderActivity() {
  const list = $('#activityList');
  const visible = state.activities.slice(0, state.activityVisible);
  list.innerHTML = visible.map(a => {
    if (!a.media) return '';
    const action = activityText(a);
    const matchingEntry = [...state.anime, ...state.manga].find(e => e.mediaId === a.media.id);
    const score = matchingEntry?.score ? `<span class="activity-score">${matchingEntry.score}</span>` : '';
    return `
      <article class="activity-card">
        <a href="${mediaHref(a.media)}" class="activity-cover"><img src="${esc(a.media.coverImage?.medium || '')}" alt="" loading="lazy" /></a>
        <div class="activity-copy">
          <div class="activity-topline"><span>${formatRelative(a.createdAt)}</span>${score}</div>
          <a href="${mediaHref(a.media)}" class="activity-title">${esc(titleOf(a.media))}</a>
          <p>${esc(action)}</p>
          <div class="activity-foot"><span>${a.media.type === 'MANGA' ? 'manga' : 'anime'}</span><a href="${esc(a.siteUrl || a.media.siteUrl || '#')}" target="_blank" rel="noreferrer">AniList ↗</a></div>
        </div>
      </article>
    `;
  }).join('') || '<div class="activity-loading">No list activity found.</div>';
  $('#moreActivity').hidden = state.activityVisible >= state.activities.length;
}

function activityText(a) {
  const status = a.status || (a.media.type === 'MANGA' ? 'updated reading' : 'updated watching');
  return a.progress ? `${capitalize(status)} ${a.progress}` : capitalize(status);
}

function capitalize(s) { return s ? s[0].toUpperCase() + s.slice(1) : ''; }

function renderMangaPulse() {
  const holder = $('#mangaPulse');
  const latest = state.manga.map(entry => {
    const act = latestMangaActivity(entry.mediaId);
    return { entry, act, days: act ? daysSince(act.createdAt) : null };
  }).sort((a,b) => (a.days ?? 9999) - (b.days ?? 9999));

  holder.innerHTML = latest.map(({entry,act,days}) => `
    <a class="pulse-card" href="${mediaHref(entry.media)}">
      <img src="${esc(entry.media.coverImage?.medium || '')}" alt="" loading="lazy" />
      <div><strong>${esc(titleOf(entry.media))}</strong><span>${act ? `Ch ${entry.progress} · ${days === 0 ? 'today' : `${days}d since log`}` : `Ch ${entry.progress} · no recent activity`}</span></div>
      <b>${days ?? '—'}</b>
    </a>
  `).join('');
}

function renderScheduleSettings() {
  const list = $('#scheduleList');
  if (!state.manga.length) {
    list.innerHTML = '<p class="drawer-copy">No current manga found.</p>';
    return;
  }
  list.innerHTML = state.manga.slice().sort((a,b)=>titleOf(a.media).localeCompare(titleOf(b.media))).map(entry => {
    const rule = state.schedules[String(entry.mediaId)] || { enabled:false, weekday:'', cadence:'weekly' };
    return `
      <div class="schedule-row" data-id="${entry.mediaId}">
        <img src="${esc(entry.media.coverImage?.medium || '')}" alt="" />
        <div class="schedule-title"><strong>${esc(titleOf(entry.media))}</strong><span>Ch ${entry.progress}</span></div>
        <select class="weekday-select" aria-label="Release day">
          <option value="">No fixed day</option>
          ${SHORT_DAYS.map((d,i)=>`<option value="${i}" ${String(rule.weekday)===String(i)?'selected':''}>${d}</option>`).join('')}
        </select>
        <select class="cadence-select" aria-label="Cadence">
          <option value="weekly" ${rule.cadence==='weekly'?'selected':''}>Weekly</option>
          <option value="biweekly" ${rule.cadence==='biweekly'?'selected':''}>Every 2 weeks</option>
        </select>
      </div>
    `;
  }).join('');
}

function saveScheduleSettings() {
  const next = {};
  $$('.schedule-row').forEach(row => {
    const weekday = $('.weekday-select', row).value;
    if (weekday === '') return;
    next[row.dataset.id] = {
      enabled:true,
      weekday,
      cadence: $('.cadence-select', row).value
    };
  });
  state.schedules = next;
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(next));
  closeDrawer();
  renderCalendar();
  toast('Manga schedules saved');
}

function bindEvents() {
  $('#prevWeek').addEventListener('click', () => { state.weekOffset--; renderCalendar(); });
  $('#nextWeek').addEventListener('click', () => { state.weekOffset++; renderCalendar(); });
  $('#todayWeek').addEventListener('click', () => { state.weekOffset = 0; renderCalendar(); });

  $$('#progressFilters button').forEach(button => button.addEventListener('click', () => {
    $$('#progressFilters button').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    state.progressFilter = button.dataset.filter;
    renderProgress();
  }));

  $('#moreActivity').addEventListener('click', () => {
    state.activityVisible += 8;
    renderActivity();
  });

  $('#scheduleSettings').addEventListener('click', openDrawer);
  $('#closeSchedule').addEventListener('click', closeDrawer);
  $('#drawerScrim').addEventListener('click', closeDrawer);
  $('#saveSchedules').addEventListener('click', saveScheduleSettings);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });
}

function openDrawer() {
  $('#scheduleDrawer').classList.add('open');
  $('#drawerScrim').classList.add('show');
  $('#scheduleDrawer').setAttribute('aria-hidden','false');
}
function closeDrawer() {
  $('#scheduleDrawer').classList.remove('open');
  $('#drawerScrim').classList.remove('show');
  $('#scheduleDrawer').setAttribute('aria-hidden','true');
}

function fmtDate(date) {
  return new Intl.DateTimeFormat(undefined, { month:'short', day:'numeric' }).format(date);
}

function renderFailure(error) {
  $('#calendarGrid').innerHTML = `<div class="fatal"><strong>Couldn’t reach AniList.</strong><span>${esc(error.message || 'Unknown error')}</span><button onclick="location.reload()">Retry</button></div>`;
  $('#progressStrip').innerHTML = '<div class="strip-loading">AniList data unavailable.</div>';
  $('#activityList').innerHTML = '<div class="activity-loading">AniList data unavailable.</div>';
  $('#accountStatus').textContent = 'AniList unavailable';
  $('#accountMeta').textContent = 'the rest of the hub still works';
}

init();

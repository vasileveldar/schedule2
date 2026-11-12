(() => {
  'use strict';
  const data = JSON.parse(document.getElementById('schedule-data').textContent);
  const translations = JSON.parse(document.getElementById('translations-data').textContent);
  const assets = JSON.parse(document.getElementById('assets-data').textContent);
  const $ = id => document.getElementById(id);
  const root = document.documentElement;
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const clock = window.TeacherClock;
  const store = {
    get: (key, fallback) => { try { return localStorage.getItem('teacher-diary.' + key) || fallback; } catch { return fallback; } },
    set: (key, value) => { try { localStorage.setItem('teacher-diary.' + key, value); } catch { /* storage may be unavailable */ } }
  };
  let clockInstant = new Date();
  let calendarState = clock.snapshot(clockInstant);
  let locale = store.get('locale', 'ru') === 'be' ? 'be' : 'ru';
  let theme = store.get('theme', window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  if (!['dark', 'light'].includes(theme)) theme = 'light';
  let view = store.get('view', 'day') === 'week' ? 'week' : 'day';
  let selectedDay = calendarState.dayId || 'mon';
  let toastTimer, lastNext = '';
  let openCat = null, catSoundEnabled = store.get('cat-sound', 'on') !== 'off', catAudio, sealClicks = 0, sealTimer;

  const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const t = (key, params = {}) => {
    const text = translations[locale]?.[key] ?? translations.ru?.[key] ?? key;
    return String(text).replace(/\{(\w+)\}/g, (match, name) => Object.hasOwn(params, name) ? params[name] : match);
  };
  const plural = (count, stem) => {
    const n = Math.abs(count) % 100;
    return t(stem + '.' + (n > 10 && n < 20 ? 'many' : n % 10 === 1 ? 'one' : n % 10 >= 2 && n % 10 <= 4 ? 'few' : 'many'));
  };
  const countText = (count, stem) => `${count} ${plural(count, stem)}`;
  const minutes = time => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
  const duration = total => {
    const hours = Math.floor(total / 60), rest = total % 60;
    return [hours ? `${hours} ${t('duration.hours')}` : '', rest || !hours ? `${rest} ${t('duration.minutes')}` : ''].filter(Boolean).join(' ');
  };
  const occupied = slot => Boolean(slot.className?.trim());
  const daySlots = day => [...(data.days.find(item => item.id === day)?.slots || [])].sort((a, b) => minutes(a.start) - minutes(b.start));
  const visibleSlots = day => {
    const slots = daySlots(day), start = slots.findIndex(occupied);
    if (start < 0) return [];
    let end = slots.length - 1;
    while (end >= start && !occupied(slots[end])) end--;
    return slots.slice(start, end + 1);
  };
  const dayStats = day => {
    const slots = visibleSlots(day), lessons = slots.filter(occupied), windows = slots.filter(slot => !occupied(slot));
    return { slots, lessons, windows };
  };
  const dayDate = day => clock.dateForDay(day, clockInstant);
  const BE_MONTHS = ['студзеня', 'лютага', 'сакавіка', 'красавіка', 'траўня', 'чэрвеня', 'ліпеня', 'жніўня', 'верасня', 'кастрычніка', 'лістапада', 'снежня'];
  const dateText = date => locale === 'be' ? `${date.getUTCDate()} ${BE_MONTHS[date.getUTCMonth()]}` : clock.formatDate(date, locale);
  const todayId = () => calendarState.dayId;
  const className = slot => `${slot.className} ${t(slot.classPlural ? 'class.plural' : 'class.single')}`;
  const roomText = slot => (slot.room ? t('room', {room: slot.room}) : t('room.missing')) + ((slot.roomNote?.[locale] || slot.roomNote?.ru) ? ' · ' + (slot.roomNote[locale] || slot.roomNote.ru) : '');
  const sun = '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3"/><path d="M10 1v2m0 14v2M1 10h2m14 0h2M3.6 3.6 5 5m10 10 1.4 1.4M3.6 16.4 5 15M15 5l1.4-1.4"/></svg>';
  const moon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 11.2A6.8 6.8 0 0 1 8.8 3.5a6.8 6.8 0 1 0 7.7 7.7Z"/></svg>';
  const paw = '<svg class="paw-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 13c-4 3-3 7 1 6 2-1 4-1 6 0 4 1 5-3 1-6-2-2-6-2-8 0Z"/><ellipse cx="5" cy="9" rx="2" ry="3" transform="rotate(-25 5 9)"/><ellipse cx="10" cy="6" rx="2" ry="3"/><ellipse cx="15" cy="6" rx="2" ry="3"/><ellipse cx="20" cy="9" rx="2" ry="3" transform="rotate(25 20 9)"/></svg>';
  const roomIcon ='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M5 17V3h10v14M3 17h14M12 10h.1"/></svg>';

  function timeOfDay() {
    const m = clock.snapshot(new Date()).minuteOfDay;
    root.dataset.tod = m >= 300 && m < 660 ? 'morning' : m < 1020 && m >= 660 ? 'day' : m >= 1020 && m < 1320 ? 'evening' : 'night';
  }
  function applyTheme(animate) {
    if (animate) { root.classList.add('fx-theme'); setTimeout(() => root.classList.remove('fx-theme'), 600); }
    root.dataset.theme = theme;
    const label = t(theme === 'dark' ? 'theme.light' : 'theme.dark');
    $('theme-toggle').innerHTML = theme === 'dark' ? sun : moon;
    $('theme-toggle').setAttribute('aria-label', label);
    $('theme-toggle').title = label;
    document.querySelector('meta[name="theme-color"]').content = theme === 'dark' ? '#201918' : '#5C3A34';
  }
  function updateStaticText() {
    root.lang = locale;
    document.querySelectorAll('[data-i18n]').forEach(node => { node.textContent = t(node.dataset.i18n); });
    document.querySelectorAll('[data-i18n-aria]').forEach(node => { node.setAttribute('aria-label', t(node.dataset.i18nAria)); });
    $('page-title').textContent = data.title?.[locale] || data.title?.ru || '';
    document.title = [data.title?.[locale] || data.title?.ru, data.subtitle?.[locale] || data.subtitle?.ru].filter(Boolean).join(' · ');
    $('week-label').textContent = `${dateText(dayDate('mon'))} — ${dateText(dayDate('fri'))}`;
    $('locale-ru').setAttribute('aria-pressed', String(locale === 'ru'));
    $('locale-be').setAttribute('aria-pressed', String(locale === 'be'));
    $('locale-ru').setAttribute('aria-label', 'Русский');
    $('locale-be').setAttribute('aria-label', 'Беларуская');
    $('secret-seal').setAttribute('aria-label', t('cat.seal.aria'));
    $('secret-cats').setAttribute('aria-label', t('cat.footer.aria'));
    applyTheme(false);
  }
  function moveIndicators() {
    document.querySelectorAll('.seg, .day-tabs').forEach(box => {
      const ind = box.querySelector('.ind'), active = box.querySelector('[aria-pressed="true"]');
      if (!ind) return;
      if (!active || !active.offsetWidth) { ind.classList.remove('on'); return; }
      const first = !ind.dataset.ready;
      if (first) ind.style.transition = 'none';
      ind.style.width = active.offsetWidth + 'px';
      ind.style.height = active.offsetHeight + 'px';
      ind.style.transform = `translate(${active.offsetLeft}px, ${active.offsetTop}px)`;
      ind.classList.add('on');
      if (first) { void ind.offsetWidth; ind.style.transition = ''; ind.dataset.ready = '1'; }
    });
  }
  function renderTabs() {
    const today = todayId();
    $('day-tabs').querySelectorAll('button').forEach(button => button.remove());
    $('day-tabs').insertAdjacentHTML('beforeend', DAYS.map(day => `<button class="day-tab${today === day ? ' today' : ''}" type="button" data-day="${day}" aria-pressed="${view === 'day' && selectedDay === day}" aria-label="${escape(t('day.open', {day: t(day)}))}"><span class="day-tab-name">${escape(t(day + '.short'))}</span><span class="day-tab-date">${dayDate(day).getUTCDate()}</span></button>`).join(''));
    $('day-tabs').querySelectorAll('button[data-day]').forEach(button => button.addEventListener('click', () => {
      if (view === 'day' && selectedDay === button.dataset.day) return;
      selectedDay = button.dataset.day; view = 'day'; store.set('view', view); renderSchedule();
    }));
    $('view-day').setAttribute('aria-pressed', String(view === 'day'));
    $('view-week').setAttribute('aria-pressed', String(view === 'week'));
    $('day-tabs').classList.toggle('muted', view === 'week');
  }
  function dayBar(day) {
    const stats = dayStats(day);
    if (!stats.slots.length) return '';
    return `<div class="day-bar" data-bar-day="${day}" aria-hidden="true">${stats.slots.map((slot, i) => `<span class="day-part${occupied(slot) ? '' : ' gap'}" data-start="${escape(slot.start)}" data-end="${escape(slot.end)}" style="flex-grow:${minutes(slot.end) - minutes(slot.start)};--i:${i}"></span>`).join('')}<span class="day-pin" hidden></span></div>`;
  }
  function board(day, index = 0) {
    const stats = dayStats(day);
    const today = todayId() === day;
    let firstGap = true;
    const rows = stats.slots.map((slot, i, all) => {
      if (!occupied(slot)) {
        if (i > 0 && !occupied(all[i - 1])) return '';
        let last = i;
        while (last + 1 < all.length && !occupied(all[last + 1])) last++;
        const length = minutes(all[last].end) - minutes(slot.start);
        const secret = firstGap ? `<button class="secret-button" data-cat="closeup" type="button" aria-label="${escape(t('cat.window.aria'))}">${paw}</button>` : '';
        firstGap = false;
        return `<li class="gap-row" style="--i:${i}"><span>${escape(t('window.length', {time: duration(length)}))}</span>${secret}</li>`;
      }
      const secret = i === all.length - 1 ? `<button class="secret-button" data-cat="yawn" type="button" aria-label="${escape(t('cat.end.aria'))}">${sun}</button>` : '';
      return `<li class="lesson-row" style="--i:${i}" data-slot-day="${day}" data-start="${escape(slot.start)}" data-end="${escape(slot.end)}"><div class="lesson-when"><time>${escape(slot.start)}</time><time>${escape(slot.end)}</time></div><div class="lesson-main"><h3>${escape(className(slot))}</h3><p>${roomIcon}<span>${escape(roomText(slot))}</span></p></div><span class="lesson-number">${slot.number}</span>${secret}</li>`;
    }).join('');
    const span = stats.lessons.length ? `<span class="day-span">${escape(t('day.span', {start: stats.lessons[0].start, end: stats.lessons.at(-1).end}))}</span>` : '';
    return `<article class="board${today ? ' is-today' : ''}" style="--d:${index}"><header class="board-header"><div><h2>${escape(t(day))}</h2><p>${escape(dateText(dayDate(day)))}</p></div><div class="board-meta"><span>${escape(countText(stats.lessons.length, 'lessons'))}</span>${span}</div></header>${view === 'day' ? dayBar(day) : ''}${rows ? `<ol class="slot-list">${rows}</ol>` : `<p class="empty-day">${escape(t('empty'))}</p>`}</article>`;
  }
  function renderSchedule() {
    renderTabs();
    $('schedule-content').className = 'schedule-content ' + view;
    $('schedule-content').innerHTML = view === 'week' ? DAYS.map(board).join('') : board(selectedDay);
    updateCurrent();
    requestAnimationFrame(moveIndicators);
  }
  function nextLesson(now) {
    const today = now.dayId, m = now.minuteOfDay;
    if (today) {
      const lessons = dayStats(today).lessons;
      const current = lessons.find(s => minutes(s.start) <= m && m < minutes(s.end));
      if (current) {
        const span = minutes(current.end) - minutes(current.start);
        return {kind: 'current', slot: current, left: minutes(current.end) - m, progress: (m - minutes(current.start)) / span};
      }
      const upcoming = lessons.find(s => minutes(s.start) > m);
      if (upcoming) {
        const left = minutes(upcoming.start) - m;
        return {kind: 'next', slot: upcoming, left, progress: left <= 60 ? 1 - left / 60 : 0, ring: left <= 60};
      }
    }
    const from = today ? DAYS.indexOf(today) + 1 : 0;
    for (let i = 0; i < 5; i++) {
      const day = DAYS[(from + i) % 5], first = dayStats(day).lessons[0];
      if (first) return {kind: 'later', slot: first, day};
    }
    return null;
  }
  function renderNext() {
    const card = $('next-card'), info = nextLesson(calendarState && clock.snapshot(new Date()));
    if (!info) { card.hidden = true; return; }
    const {slot} = info;
    const label = t(info.kind === 'current' ? 'next.current' : 'next.next');
    const status = info.kind === 'current' ? t('next.until', {time: duration(info.left)})
      : info.kind === 'next' ? t('next.in', {time: duration(info.left)}) : t('next.at', {day: t(info.day), time: slot.start});
    const ring = info.kind === 'current' || info.ring;
    const ringText = ring ? (info.left >= 100 ? Math.round(info.left / 60) + t('duration.hours').slice(0, 1) : info.left) : '';
    const html = `<p class="next-label">${escape(label)}</p><h2 class="next-title">${escape(className(slot))}</h2><p class="next-meta">${escape(slot.start)}–${escape(slot.end)} · ${escape(roomText(slot))}</p><p class="next-status">${escape(status)}</p>${ring ? `<div class="ring" aria-hidden="true"><span>${escape(ringText)}</span></div>` : ''}`;
    card.hidden = false;
    card.classList.toggle('is-current', info.kind === 'current');
    card.classList.toggle('is-soon', info.kind === 'next' && info.left <= 5);
    card.style.setProperty('--nc', ring ? info.progress.toFixed(3) : 0);
    if (html !== lastNext) {
      const first = lastNext === '';
      lastNext = html; card.innerHTML = html;
      if (!first) { card.classList.remove('fx-swap'); void card.offsetWidth; card.classList.add('fx-swap'); }
    }
  }
  function updateCurrent() {
    const now = new Date(), snap = clock.snapshot(now);
    document.querySelectorAll('[data-slot-day]').forEach(node => node.classList.toggle('is-current', clock.isActive(node.dataset.slotDay, node.dataset.start, node.dataset.end, now)));
    document.querySelectorAll('.day-bar').forEach(bar => {
      const isToday = bar.dataset.barDay === snap.dayId, parts = [...bar.querySelectorAll('.day-part')], pin = bar.querySelector('.day-pin');
      parts.forEach(part => part.classList.toggle('now', isToday && snap.minuteOfDay >= minutes(part.dataset.start) && snap.minuteOfDay < minutes(part.dataset.end)));
      const first = minutes(parts[0].dataset.start), last = minutes(parts.at(-1).dataset.end);
      const show = isToday && snap.minuteOfDay >= first && snap.minuteOfDay <= last;
      pin.hidden = !show;
      if (show) pin.style.left = ((snap.minuteOfDay - first) / (last - first) * 100).toFixed(2) + '%';
    });
    renderNext();
  }
  function refreshCalendar() {
    clockInstant = new Date();
    const next = clock.snapshot(clockInstant);
    const changed = next.dateKey !== calendarState.dateKey, wasToday = selectedDay === calendarState.dayId;
    calendarState = next; timeOfDay();
    if (changed) {
      if (wasToday) selectedDay = next.dayId || 'mon';
      updateStaticText(); renderSchedule();
    } else updateCurrent();
  }
  function toast(message) {
    clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 2600);
  }
  function setLocale(next) {
    if (next === locale || !['ru', 'be'].includes(next)) return;
    locale = next; store.set('locale', locale); lastNext = ''; updateStaticText(); renderSchedule();
    if (openCat) paintCat(openCat);
  }
  // пасхалки с котиками
  const catConfig = {
    squish: {asset: 'kiriki-squish', name: 'cat.kiriki'},
    closeup: {asset: 'kiriki-closeup', name: 'cat.kiriki'},
    sleep: {asset: 'dymka-portraits', name: 'cat.dymka', crop: 'sleep'},
    watch: {asset: 'dymka-portraits', name: 'cat.dymka', crop: 'watch'},
    yawn: {asset: 'kiriki-yawn', name: 'cat.kiriki'}
  };
  function updateCatSoundButton() {
    const button = $('cat-sound-toggle'), label = t(catSoundEnabled ? 'cat.sound.off' : 'cat.sound.on');
    button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', String(catSoundEnabled)); button.title = label;
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4Z"/>' + (catSoundEnabled ? '<path d="M15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>' : '<path d="m16 9 6 6m0-6-6 6"/>') + '</svg>';
  }
  function stopCatSound() { if (catAudio) { catAudio.pause(); catAudio.currentTime = 0; } }
  function playCatSound() {
    stopCatSound();
    if (!catSoundEnabled || !assets['cat-meow']) return;
    if (!catAudio) { catAudio = new Audio(assets['cat-meow']); catAudio.volume = 0.65; }
    const play = catAudio.play();
    if (play?.catch) play.catch(() => { /* фото остаётся, если браузер не дал включить звук */ });
  }
  function paintCat(kind) {
    const config = catConfig[kind];
    $('cat-photo-viewport').dataset.crop = config.crop || '';
    $('cat-photo').src = assets[config.asset] || '';
    $('cat-photo').alt = t(`cat.${kind}.alt`);
    $('cat-title').textContent = t(config.name);
    $('cat-close').setAttribute('aria-label', t('cat.close'));
    updateCatSoundButton();
  }
  function showCat(kind) {
    if (!catConfig[kind] || !assets[catConfig[kind].asset]) return;
    openCat = kind; paintCat(kind);
    if (!$('cat-dialog').open) $('cat-dialog').showModal();
    $('cat-dialog').classList.remove('cat-reveal'); void $('cat-dialog').offsetWidth; $('cat-dialog').classList.add('cat-reveal');
    playCatSound();
  }
  function closeCat() { $('cat-dialog').close(); }
  $('cat-close').addEventListener('click', closeCat);
  $('cat-sound-toggle').addEventListener('click', () => {
    catSoundEnabled = !catSoundEnabled; store.set('cat-sound', catSoundEnabled ? 'on' : 'off'); updateCatSoundButton();
    if (catSoundEnabled) playCatSound(); else stopCatSound();
  });
  $('cat-dialog').addEventListener('close', () => { openCat = null; stopCatSound(); });
  $('cat-dialog').addEventListener('click', event => {
    if (event.target !== $('cat-dialog')) return;
    const rect = $('cat-dialog').getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeCat();
  });
  $('secret-cats').addEventListener('click', () => showCat('sleep'));
  // Дымка «смотрит вниз»: долгое нажатие на даты недели в шапке
  let pressTimer;
  $('week-label').addEventListener('pointerdown', () => { clearTimeout(pressTimer); pressTimer = setTimeout(() => showCat('watch'), 600); });
  ['pointerup', 'pointerleave', 'pointercancel'].forEach(name => $('week-label').addEventListener(name, () => clearTimeout(pressTimer)));
  $('week-label').addEventListener('contextmenu', event => event.preventDefault());
  $('schedule-content').addEventListener('click', event => { const button = event.target.closest('[data-cat]'); if (button) showCat(button.dataset.cat); });
  $('secret-seal').addEventListener('click', () => {
    clearTimeout(sealTimer); sealClicks++;
    $('secret-seal').dataset.taps = String(sealClicks);
    if (sealClicks >= 3) { sealClicks = 0; delete $('secret-seal').dataset.taps; showCat('squish'); }
    else sealTimer = setTimeout(() => { sealClicks = 0; delete $('secret-seal').dataset.taps; }, 6000);
  });
  function setView(next) { if (next === view) return; view = next; store.set('view', view); renderSchedule(); }

  $('locale-ru').addEventListener('click', () => setLocale('ru'));
  $('locale-be').addEventListener('click', () => setLocale('be'));
  $('theme-toggle').addEventListener('click', () => { theme = theme === 'dark' ? 'light' : 'dark'; store.set('theme', theme); applyTheme(true); });
  $('view-day').addEventListener('click', () => setView('day'));
  $('view-week').addEventListener('click', () => setView('week'));
  $('today-button').addEventListener('click', () => {
    refreshCalendar();
    const target = todayId() || 'mon';
    if (!todayId()) toast(t('today.weekend'));
    if (view === 'day' && selectedDay === target) return;
    selectedDay = target; view = 'day'; store.set('view', view); renderSchedule();
  });
  // ripple on press
  document.addEventListener('pointerdown', event => {
    if (root.dataset.anim === 'off') return;
    const target = event.target.closest?.('.seg button, .day-tab, .today-button, .icon-button');
    if (!target) return;
    const rect = target.getBoundingClientRect(), size = Math.max(rect.width, rect.height) * 2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    dot.style.cssText = `width:${size}px;height:${size}px;left:${event.clientX - rect.left - size / 2}px;top:${event.clientY - rect.top - size / 2}px`;
    target.appendChild(dot);
    setTimeout(() => dot.remove(), 600);
  }, {passive: true});
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) root.dataset.anim = 'soft';
  window.addEventListener('resize', moveIndicators);
  timeOfDay(); updateStaticText(); renderSchedule();
  setInterval(refreshCalendar, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshCalendar(); });
  window.addEventListener('focus', refreshCalendar);
  window.addEventListener('pageshow', refreshCalendar);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('./service-worker.js').catch(() => {});
})();

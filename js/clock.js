(function (root) {
  'use strict';
  const TIME_ZONE = 'Europe/Minsk';
  const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  function snapshot(now = new Date()) {
    const parts = Object.fromEntries(formatter.formatToParts(now).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
    const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
    const weekday = new Date(Date.UTC(year, month - 1, day, 12)).getUTCDay();
    return {
      dateKey: `${parts.year}-${parts.month}-${parts.day}`,
      dayId: DAYS[weekday - 1] || null,
      minuteOfDay: Number(parts.hour) * 60 + Number(parts.minute),
      year, month, day
    };
  }
  function dateForDay(dayId, now = new Date()) {
    const index = DAYS.indexOf(dayId);
    if (index < 0) throw new RangeError('Unknown school day: ' + dayId);
    const {year, month, day} = snapshot(now);
    // This UTC-noon Date represents a calendar date, not the instant of a lesson.
    // UTC arithmetic keeps the viewer's time zone and DST out of the week layout.
    const date = new Date(Date.UTC(year, month - 1, day, 12));
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7) + index);
    return date;
  }
  function formatDate(calendarDate, locale) {
    return new Intl.DateTimeFormat(locale === 'be' ? 'be-BY' : 'ru-RU', {
      timeZone: 'UTC', calendar: 'gregory', day: 'numeric', month: 'long'
    }).format(calendarDate);
  }
  function isActive(dayId, start, end, now = new Date()) {
    const current = snapshot(now);
    const minute = value => { const [hours, minutes] = value.split(':').map(Number); return hours * 60 + minutes; };
    return dayId === current.dayId && current.minuteOfDay >= minute(start) && current.minuteOfDay < minute(end);
  }
  const clock = Object.freeze({TIME_ZONE, snapshot, dateForDay, formatDate, isActive});
  if (typeof module !== 'undefined' && module.exports) module.exports = clock;
  else root.TeacherClock = clock;
})(typeof window !== 'undefined' ? window : globalThis);

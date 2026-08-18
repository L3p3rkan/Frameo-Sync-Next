export type CalendarEvent = {
  uid: string;
  summary: string;
  start: Date;
  end?: Date;
  allDay: boolean;
};

function unfoldIcs(text: string) {
  return text.replace(/\r?\n[ \t]/g, '');
}

function parseDate(value: string) {
  const clean = value.trim();
  const dateOnly = /^\d{8}$/.test(clean);
  if (dateOnly) {
    const y = Number(clean.slice(0, 4));
    const m = Number(clean.slice(4, 6)) - 1;
    const d = Number(clean.slice(6, 8));
    return new Date(y, m, d);
  }
  const v = clean.replace(/Z$/, '');
  if (/^\d{8}T\d{6}$/.test(v)) {
    const y = Number(v.slice(0, 4)); const m = Number(v.slice(4, 6)) - 1; const d = Number(v.slice(6, 8));
    const hh = Number(v.slice(9, 11)); const mm = Number(v.slice(11, 13)); const ss = Number(v.slice(13, 15));
    return new Date(y, m, d, hh, mm, ss);
  }
  const parsed = new Date(clean);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function parseIcs(text: string): CalendarEvent[] {
  const lines = unfoldIcs(text).split(/\r?\n/);
  const events: CalendarEvent[] = [];
  let current: Partial<CalendarEvent> | null = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') {
      if (current?.start && current.summary) {
        events.push({ uid: current.uid || `${current.start.getTime()}-${current.summary}`, summary: current.summary, start: current.start, end: current.end, allDay: !!current.allDay });
      }
      current = null;
      continue;
    }
    if (!current) continue;
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const keyPart = line.slice(0, separator);
    const value = line.slice(separator + 1).trim();
    const key = keyPart.split(';')[0].toUpperCase();
    if (key === 'UID') current.uid = value;
    else if (key === 'SUMMARY') current.summary = value.replace(/\\([,;\\])/g, '$1').replace(/\\n/gi, ' ');
    else if (key === 'DTSTART') { current.start = parseDate(value) || undefined; current.allDay = /(^|;)VALUE=DATE(;|$)/i.test(keyPart); }
    else if (key === 'DTEND') current.end = parseDate(value) || undefined;
  }
  return events;
}

export async function fetchCalendar(url: string): Promise<CalendarEvent[]> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Calendar returned HTTP ${response.status}`);
  return parseIcs(await response.text());
}

function startOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function endOfDay(d: Date) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1); }

export function eventsForTodayAndTomorrow(events: CalendarEvent[], now = new Date()) {
  const today = startOfDay(now);
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
  const afterTomorrow = new Date(today); afterTomorrow.setDate(afterTomorrow.getDate() + 2);
  return events.filter(e => e.start < afterTomorrow && (e.end || e.start) >= today).sort((a, b) => a.start.getTime() - b.start.getTime());
}

export function formatEventTime(event: CalendarEvent) {
  if (event.allDay) return 'All day';
  return event.start.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(date: Date, now = new Date()) {
  const today = startOfDay(now);
  const d = startOfDay(date);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString([], { weekday: 'short' });
}

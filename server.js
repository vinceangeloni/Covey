import express from 'express';
import { createDAVClient } from 'tsdav';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildICS, parseEvents, isoDate } from './ics.js';

const { ICLOUD_EMAIL, ICLOUD_APP_PASSWORD, CALENDAR_NAME = 'Family', REMINDERS_CALENDAR, DINNER_CALENDAR, PORT = 3000 } = process.env;
if (!ICLOUD_EMAIL || !ICLOUD_APP_PASSWORD) {
  console.error('Missing ICLOUD_EMAIL or ICLOUD_APP_PASSWORD. Copy .env_sample to .env and fill it in.');
  process.exit(1);
}

// kind -> iCloud calendar name. The reminders and dinner calendars are optional.
const ROLES = { event: CALENDAR_NAME, reminder: REMINDERS_CALENDAR, dinner: DINNER_CALENDAR };
const KINDS = Object.keys(ROLES).filter(k => ROLES[k]);

let ctx = null; // cached iCloud connection
async function connect() {
  if (ctx) return ctx;
  const client = await createDAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: { username: ICLOUD_EMAIL, password: ICLOUD_APP_PASSWORD },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  });
  const all = await client.fetchCalendars();
  const cals = {};
  for (const kind of KINDS) {
    const name = ROLES[kind].toLowerCase();
    const calendar = all.find(c => String(c.displayName || '').toLowerCase() === name);
    if (!calendar) throw new Error(`No calendar named "${ROLES[kind]}". Found: ${all.map(c => c.displayName).join(', ')}`);
    cals[kind] = calendar;
  }
  return (ctx = { client, cals });
}

const wrap = fn => async (req, res) => {
  try { await fn(req, res); } catch (e) { ctx = null; console.error(e); res.status(500).json({ error: e.message }); }
};

// Live status line so a long-running server doesn't look hung in an
// interactive terminal - a static one-liner with no further output can look
// identical to a frozen process. Falls back to a single static log line when
// stdout isn't a TTY (piped to a file, process manager, etc.) so logs stay clean.
let reqCount = 0;
function startStatusLine(url) {
  if (!process.stdout.isTTY) {
    console.log(`Covey is running on ${url}`);
    return;
  }
  const frames = ['\u280b', '\u2819', '\u2839', '\u2838', '\u283c', '\u2834', '\u2826', '\u2827', '\u2807', '\u280f'];
  const started = Date.now();
  let frame = 0;
  const render = () => {
    const elapsed = Math.max(0, Math.floor((Date.now() - started) / 1000));
    const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const secs = String(elapsed % 60).padStart(2, '0');
    const spinner = frames[frame = (frame + 1) % frames.length];
    const requests = `${reqCount} request${reqCount === 1 ? '' : 's'} served`;
    process.stdout.write(`\r\x1b[2K\x1b[36m${spinner}\x1b[0m Covey is running on \x1b[1m${url}\x1b[0m  \u00b7  up ${mins}:${secs}  \u00b7  ${requests}`);
  };
  render();
  const timer = setInterval(render, 120);
  timer.unref();
  const cleanup = () => { process.stdout.write('\n'); process.exit(0); };
  process.once('SIGINT', cleanup);
  process.once('SIGTERM', cleanup);
}

const app = express();
app.use((_req, _res, next) => { reqCount++; next(); });
app.use(express.json());
const here = path.dirname(fileURLToPath(import.meta.url));
app.get('/', (_req, res) => {
  const page = fs.readFileSync(path.join(here, 'index.html'), 'utf8');
  res.type('html').send(page.replace('<!--SERVER-->', '<script>window.GAGGLE_SERVER = true</script>'));
});

app.use(express.static(here, { index: false }));

app.get('/api/config', (_req, res) => res.json({ kinds: KINDS }));

app.get('/api/events', wrap(async (req, res) => {
  const m = /^(\d{4})-(\d{2})$/.exec(req.query.month || '');
  if (!m) return res.status(400).json({ error: 'month=YYYY-MM required' });
  const y = +m[1], mo = +m[2];
  const from = isoDate(new Date(y, mo - 1, 1)), to = isoDate(new Date(y, mo, 0));
  const timeRange = { start: new Date(y, mo - 1, -1).toISOString(), end: new Date(y, mo, 2).toISOString() }; // padded for timezone edges
  const { client, cals } = await connect();
  const lists = await Promise.all(Object.entries(cals).map(async ([kind, calendar]) => {
    const objs = await client.fetchCalendarObjects({ calendar, timeRange });
    return objs.flatMap(o => parseEvents(o, from, to)).map(e => ({ ...e, kind }));
  }));
  res.json(lists.flat());
}));

app.post('/api/events', wrap(async (req, res) => {
  const { t, d, tm = '', te = '', m = 'Family', kind = 'event' } = req.body || {};
  const validTime = value => /^(\d{2}:\d{2})?$/.test(value);
  if (typeof t !== 'string' || !t.trim() || t.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !validTime(tm) || !validTime(te) || (te && (!tm || te <= tm)) ||
      typeof m !== 'string' || m.length > 40 || typeof kind !== 'string') {
    return res.status(400).json({ error: 'Invalid event' });
  }
  const { client, cals } = await connect();
  if (!Object.hasOwn(cals, kind)) return res.status(400).json({ error: `No ${kind} calendar is configured` });
  const uid = crypto.randomUUID();
  const r = await client.createCalendarObject({
    calendar: cals[kind],
    filename: `${uid}.ics`,
    iCalString: buildICS({
      uid, title: t.trim(), date: d,
      time: kind === 'event' ? tm : '',        // reminders and dinner are all-day entries
      endTime: kind === 'event' ? te : '',     // optional; defaults to one hour after start
      member: kind === 'event' ? m : '',        // people tags only on the shared calendar
      alarm: kind === 'reminder',               // reminders alert on the phone
    }),
  });
  if (!r.ok) throw new Error(`iCloud rejected the event (HTTP ${r.status})`);
  res.status(201).json({ ok: true });
}));

app.delete('/api/events', wrap(async (req, res) => {
  const { url, etag } = req.query;
  const { client, cals } = await connect();
  if (typeof url !== 'string' || !Object.values(cals).some(c => url.startsWith(c.url))) return res.status(400).json({ error: 'Bad event url' });
  const r = await client.deleteCalendarObject({ calendarObject: { url, etag: etag || undefined } });
  if (!r.ok) throw new Error(`iCloud could not delete the event (HTTP ${r.status})`);
  res.json({ ok: true });
}));

app.listen(PORT, () => startStatusLine(`http://localhost:${PORT}`));

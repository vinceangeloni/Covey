import express from 'express';
import { createDAVClient } from 'tsdav';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildICS, parseEvents, isoDate } from './ics.js';

const { ICLOUD_EMAIL, ICLOUD_APP_PASSWORD, CALENDAR_NAME = 'Family', REMINDERS_CALENDAR, DINNER_CALENDAR, PORT = 3000 } = process.env;
if (!ICLOUD_EMAIL || !ICLOUD_APP_PASSWORD) {
  console.error('Missing ICLOUD_EMAIL or ICLOUD_APP_PASSWORD. Copy .env.example to .env and fill it in.');
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

const app = express();
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
  const { t, d, tm = '', m = 'Family', kind = 'event' } = req.body || {};
  if (typeof t !== 'string' || !t.trim() || t.length > 80 || !/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      !/^(\d{2}:\d{2})?$/.test(tm) || typeof m !== 'string' || m.length > 40 || typeof kind !== 'string') {
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
      time: kind === 'dinner' ? '' : tm,        // dinner is an all-day entry
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

app.listen(PORT, () => console.log(`Covey is running on http://localhost:${PORT}`));

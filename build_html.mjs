// Bygger TD798_Dashboard_DEMO.html fra fake_data.json.
//   node build_html.mjs
//
// Erstatter det opprinnelige build_html.py (Python finnes ikke på byggemaskinen).
// Alle deltagerdata er oppdiktede. Allotment-tallene under er DEMO-verdier med
// samme struktur som Qondor-uttrekket, ikke reelle kontraktstall.

import fs from 'node:fs';

const IN = 'fake_data.json';
const OUT = 'TD798_Dashboard_DEMO.html';

// ---------------------------------------------------------------- demo-data ---

const SNAPSHOT_DATE = '19.08.2026';

// Oppdiktet "første generering" — gir delta-visningen noe å sammenligne mot.
const BASELINE = {
  date: '01.08.2026',
  total: 178,
  middag: 41,
  stiftelse: 55,
  festmiddag: 171,
  fagkonf: 165,
  companies: 79,
};

// Allotment pr. hotell → romtype → natt (ISO-dato for natten gjesten sover).
// Bytt disse tallene mot de reelle fra Qondor hvis dashboardet skal vise ekte kapasitet.
const ALLOTMENT = {
  'SCANDIC PARKEN': {
    'Enkeltrom': { '2026-11-15': 150, '2026-11-16': 123, '2026-11-17': 25 },
    'Enkeltrom foredragsholder': { '2026-11-15': 10, '2026-11-16': 10, '2026-11-17': 5 },
    'Dobbeltrom': { '2026-11-15': 10, '2026-11-16': 10, '2026-11-17': 2 },
  },
  'HOTEL 1904': {
    'Enkeltrom': { '2026-11-15': 40, '2026-11-16': 36 },
    'Foredragsholder': { '2026-11-15': 5, '2026-11-16': 5 },
    'Dobbeltrom': { '2026-11-15': 5, '2026-11-16': 5, '2026-11-17': 2 },
  },
  'QUALITY HOTEL ÅLESUND': {
    'Enkeltrom': { '2026-11-15': 20, '2026-11-16': 80 },
    'Dobbeltrom': { '2026-11-15': 5, '2026-11-16': 5 },
  },
};

const ROOM_ORDER = ['Enkeltrom', 'Enkeltrom foredragsholder', 'Dobbeltrom', 'Foredragsholder'];
const BEDS_PER_ROOM = { 'Dobbeltrom': 2 };
const FULL_THRESHOLD = 0.95; // fra og med denne utnyttelsen flagges natten som fullt

// ------------------------------------------------------------------ hjelpere ---

const ledige = (n) => (n === 1 ? '1 ledig' : `${n} ledige`);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, mai: 5, jun: 6, jul: 7, aug: 8, sep: 9, okt: 10, nov: 11, des: 12 };

function parseQondorDate(s) {
  const m = /^(\d+)([a-zæøå]{3})(\d+)$/i.exec(s);
  if (!m) throw new Error(`Ukjent datoformat: ${s}`);
  const month = MONTHS[m[2].toLowerCase()];
  if (!month) throw new Error(`Ukjent måned: ${m[2]}`);
  return new Date(Date.UTC(2000 + Number(m[3]), month - 1, Number(m[1])));
}

const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const nightLabel = (isoDate) => `${isoDate.slice(8, 10)}.${isoDate.slice(5, 7)}`;

function parseHotelStr(s) {
  // "🛌 SCANDIC PARKEN, Enkeltrom. Fra 15nov26 til 18nov26."
  const m = /^\S+\s+(.+?),\s*(.+?)\.\s*Fra\s+(\S+)\s+til\s+(\S+)\./.exec(s);
  if (!m) throw new Error(`Kunne ikke tolke hotellstreng: ${s}`);
  return { hotel: m[1], room: m[2], from: parseQondorDate(m[3]), to: parseQondorDate(m[4]) };
}

// ------------------------------------------------------------------ innlesing ---

const raw = JSON.parse(fs.readFileSync(IN, 'utf8'));

const participants = raw.participants.map((p) => {
  const booking = p.hotel_str ? parseHotelStr(p.hotel_str) : null;
  return {
    ref: p.ref,
    navn: `${p.fornavn} ${p.etternavn}`,
    firma: p.firma,
    epost: p.epost,
    mobil: p.mobil,
    hotel: p.hotel_name || '',
    rom: booking ? booking.room : '',
    hotelStr: p.hotel_str || '',
    middag: p.middag,
    stiftelse: p.stiftelse,
    festmiddag: p.festmiddag,
    fagkonf: p.fagkonf,
    _booking: booking,
  };
});

const TOTAL = participants.length;
const sum = (key) => participants.reduce((a, p) => a + p[key], 0);
const MIDDAG = sum('middag');
const STIFTELSE = sum('stiftelse');
const FESTMIDDAG = sum('festmiddag');
const FAGKONF = sum('fagkonf');
const COMPANIES = new Set(participants.map((p) => p.firma)).size;

// ------------------------------------------- gjestenetter → rom pr. natt ---

// heads[hotell][romtype][natt] = antall gjester som sover der den natten
const heads = new Map();
const bump = (hotel, room, night) => {
  if (!heads.has(hotel)) heads.set(hotel, new Map());
  const byRoom = heads.get(hotel);
  if (!byRoom.has(room)) byRoom.set(room, new Map());
  const byNight = byRoom.get(room);
  byNight.set(night, (byNight.get(night) || 0) + 1);
};

for (const p of participants) {
  if (!p._booking) continue;
  const { hotel, room, from, to } = p._booking;
  for (let d = from; d < to; d = addDays(d, 1)) bump(hotel, room, iso(d));
}

// Dobbeltrom deles av to gjester, så gjestenetter ≠ romnetter.
const roomsFrom = (roomType, headCount) =>
  Math.ceil(headCount / (BEDS_PER_ROOM[roomType] || 1));

// Alle netter som finnes i booking eller allotment.
const allNights = [...new Set([
  ...[...heads.values()].flatMap((byRoom) => [...byRoom.values()].flatMap((byNight) => [...byNight.keys()])),
  ...Object.values(ALLOTMENT).flatMap((byRoom) => Object.values(byRoom).flatMap((byNight) => Object.keys(byNight))),
])].sort();

// Hoteller sortert etter totalt antall booka romnetter.
const hotelNames = [...new Set([...heads.keys(), ...Object.keys(ALLOTMENT)])];
const hotelBooked = (hotel) => {
  const byRoom = heads.get(hotel);
  if (!byRoom) return 0;
  let t = 0;
  for (const [room, byNight] of byRoom) for (const n of byNight.values()) t += roomsFrom(room, n);
  return t;
};
hotelNames.sort((a, b) => hotelBooked(b) - hotelBooked(a) || a.localeCompare(b, 'no'));

const roomTypesFor = (hotel) => {
  const fromBookings = heads.has(hotel) ? [...heads.get(hotel).keys()] : [];
  const fromAllotment = Object.keys(ALLOTMENT[hotel] || {});
  const rank = (r) => {
    const i = ROOM_ORDER.indexOf(r);
    return i === -1 ? ROOM_ORDER.length : i;
  };
  return [...new Set([...fromBookings, ...fromAllotment])]
    .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, 'no'));
};

const bookedRooms = (hotel, room, night) => {
  const h = heads.get(hotel)?.get(room)?.get(night) || 0;
  return roomsFrom(room, h);
};
const allotmentFor = (hotel, room, night) => ALLOTMENT[hotel]?.[room]?.[night] ?? null;

// ------------------------------------------------------------------ HTML-deler ---

function deltaHtml(current, baseline) {
  const diff = current - baseline;
  const cls = diff >= 0 ? 'delta-up' : 'delta-down';
  const sign = diff >= 0 ? '+' : '';
  return `<div class="kpi-delta ${cls}">${sign}${diff} siden ${BASELINE.date} (${baseline} → ${current})</div>`;
}

const kpiCards = [
  ['Totalt påmeldte', TOTAL, BASELINE.total],
  ['Festmiddag &amp; kickoff', FESTMIDDAG, BASELINE.festmiddag],
  ['Fagkonferanse tirsdag', FAGKONF, BASELINE.fagkonf],
  ['Stiftelsessamling mandag', STIFTELSE, BASELINE.stiftelse],
  ['Middag for sparebankstiftelser', MIDDAG, BASELINE.middag],
  ['Unike selskaper', COMPANIES, BASELINE.companies],
];

const kpiHtml = kpiCards.map(([label, value, baseline]) => `
        <div class="kpi-card">
          <div class="kpi-label">${label}</div>
          <div class="kpi-value">${value}</div>
          ${deltaHtml(value, baseline)}
        </div>`).join('\n');

const programBars = [
  ['Festmiddag og kickoff', FESTMIDDAG],
  ['Fagkonferanse tirsdag', FAGKONF],
  ['Stiftelsessamling mandag', STIFTELSE],
  ['Middag for sparebankstiftelser', MIDDAG],
];
const maxProgram = Math.max(...programBars.map(([, v]) => v));

const programBarsHtml = programBars.map(([label, value]) => {
  const pct = maxProgram ? Math.round((value / maxProgram) * 1000) / 10 : 0;
  return `
        <div class="bar-row">
          <div class="bar-label">${label}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
          <div class="bar-value">${value}</div>
        </div>`;
}).join('\n');

// --- allotment-matrise: én måler pr. romtype pr. natt -------------------------

function allotmentCell(hotel, room, night) {
  const booked = bookedRooms(hotel, room, night);
  const cap = allotmentFor(hotel, room, night);
  const label = nightLabel(night);

  if (cap === null && booked === 0) {
    return `<td class="cell-empty" title="${esc(hotel)} — ${esc(room)} — natt til ${label}: ingen allotment, ingen booking">–</td>`;
  }

  if (cap === null) {
    // Booket utenfor allotment — egen tilstand, ikke bare en full måler.
    return `<td class="cell state-over" title="${esc(hotel)} — ${esc(room)} — natt til ${label}: ${booked} rom booket uten allotment">
              <div class="cell-nums"><b>${booked}</b> / –</div>
              <div class="meter"><div class="meter-fill meter-over" style="width:100%"></div><span class="meter-spill"></span></div>
              <div class="cell-note">Utenfor allotment</div>
            </td>`;
  }

  const pct = cap > 0 ? booked / cap : 0;
  const width = Math.min(100, Math.round(pct * 1000) / 10);
  const pctText = `${Math.round(pct * 100)} %`;
  const free = cap - booked;

  let state = 'state-ok';
  let note = `${pctText} · ${ledige(free)}`;
  let fillClass = '';

  if (booked > cap) {
    state = 'state-over';
    fillClass = 'meter-over';
    note = `Over allotment · ${booked - cap} rom for mye`;
  } else if (booked === 0) {
    state = 'state-unused';
    note = `Ubenyttet · ${ledige(cap)}`;
  } else if (pct >= FULL_THRESHOLD) {
    state = 'state-full';
    fillClass = 'meter-full';
    note = booked === cap ? 'Fullt · 0 ledige' : `Nesten fullt · ${ledige(free)}`;
  }

  const spill = booked > cap ? '<span class="meter-spill"></span>' : '';
  return `<td class="cell ${state}" title="${esc(hotel)} — ${esc(room)} — natt til ${label}: ${booked} av ${cap} rom booket (${pctText}), ${ledige(free)}">
              <div class="cell-nums"><b>${booked}</b> / ${cap}</div>
              <div class="meter"><div class="meter-fill ${fillClass}" style="width:${width}%"></div>${spill}</div>
              <div class="cell-note">${note}</div>
            </td>`;
}

const allotmentRows = hotelNames.map((hotel) => {
  const rows = roomTypesFor(hotel).map((room) => `
          <tr>
            <th scope="row" class="row-room">${esc(room)}${BEDS_PER_ROOM[room] ? ' <span class="beds-hint">2 gjester/rom</span>' : ''}</th>
            ${allNights.map((n) => allotmentCell(hotel, room, n)).join('\n            ')}
          </tr>`).join('\n');
  return `
          <tr class="hotel-head">
            <th scope="colgroup" colspan="${allNights.length + 1}">${esc(hotel)}</th>
          </tr>
${rows}`;
}).join('\n');

const totalRow = (() => {
  const cells = allNights.map((night) => {
    let booked = 0;
    let cap = 0;
    for (const hotel of hotelNames) {
      for (const room of roomTypesFor(hotel)) {
        booked += bookedRooms(hotel, room, night);
        cap += allotmentFor(hotel, room, night) || 0;
      }
    }
    const pct = cap ? Math.round((booked / cap) * 100) : 0;
    return `<td class="cell cell-total"><div class="cell-nums"><b>${booked}</b> / ${cap}</div><div class="cell-note">${pct} % av allotment</div></td>`;
  }).join('\n            ');
  return `
          <tr class="total-row">
            <th scope="row">Sum rom</th>
            ${cells}
          </tr>`;
})();

const nightHeaders = allNights
  .map((n) => `<th scope="col">Natt til ${nightLabel(n)}</th>`)
  .join('\n            ');

const participantsJson = JSON.stringify(participants.map(({ _booking, ...rest }) => rest));

// ----------------------------------------------------------------- dokument ---

const html = `<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DEMO — Sparebankdagene 2026 — booking-dashboard</title>
<style>
  :root {
    color-scheme: light;
    --primary: #f15b29;
    --secondary: #122e47;
    --surface-1: #fcfcfb;
    --page: #f2f4f6;
    --text-primary: #0b0b0b;
    --text-secondary: #52514e;
    --text-muted: #898781;
    --gridline: #e1e0d9;
    --border: rgba(11,11,11,0.10);
    --critical: #d03b3b;
    --delta-up: #006300;
    --delta-down: #b5391a;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--page);
    color: var(--text-primary);
  }
  .demo-banner {
    background: repeating-linear-gradient(45deg, var(--primary), var(--primary) 10px, #ffffff 10px, #ffffff 20px);
    color: var(--secondary);
    text-align: center;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.04em;
    padding: 6px 0;
    text-transform: uppercase;
  }
  .demo-banner span { background: var(--surface-1); padding: 3px 12px; border-radius: 4px; }
  header { background: var(--secondary); color: #ffffff; padding: 28px 32px 22px; }
  header h1 { margin: 0 0 6px 0; font-size: 22px; font-weight: 700; }
  header .meta { color: #c7d3dd; font-size: 13px; display: flex; gap: 18px; flex-wrap: wrap; }
  header .meta b { color: #ffffff; }
  .tabs {
    display: flex; gap: 4px; padding: 0 32px;
    background: var(--surface-1); border-bottom: 1px solid var(--gridline);
  }
  .tab-btn {
    border: none; background: transparent; padding: 14px 18px;
    font-size: 14px; font-weight: 600; color: var(--text-secondary);
    cursor: pointer; border-bottom: 3px solid transparent; font-family: inherit;
  }
  .tab-btn.active { color: var(--secondary); border-bottom-color: var(--primary); }
  main { padding: 24px 32px 48px; max-width: 1180px; margin: 0 auto; }
  .tab-panel { display: none; }
  .tab-panel.active { display: block; }
  .kpi-grid {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 14px; margin-bottom: 28px;
  }
  .kpi-card {
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 10px; padding: 16px 18px;
  }
  .kpi-label { font-size: 12.5px; color: var(--text-secondary); margin-bottom: 6px; font-weight: 600; }
  .kpi-value { font-size: 30px; font-weight: 700; color: var(--secondary); line-height: 1.1; }
  .kpi-delta { font-size: 12px; margin-top: 6px; font-weight: 600; }
  .delta-up { color: var(--delta-up); }
  .delta-down { color: var(--delta-down); }
  .panel-block {
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 10px; padding: 20px 22px; margin-bottom: 22px;
  }
  .panel-block h2 { font-size: 15px; margin: 0 0 4px 0; color: var(--secondary); font-weight: 700; }
  .panel-sub { font-size: 12px; color: var(--text-muted); margin-bottom: 16px; }
  .bar-row {
    display: grid; grid-template-columns: 220px 1fr 44px;
    align-items: center; gap: 12px; margin-bottom: 10px; font-size: 13px;
  }
  .bar-label { color: var(--text-secondary); }
  .bar-track { background: var(--gridline); border-radius: 5px; height: 14px; overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 4px; background: var(--secondary); }
  .bar-value { text-align: right; font-weight: 700; color: var(--secondary); font-variant-numeric: tabular-nums; }

  /* --- allotment-matrise --- */
  .allot-legend { display: flex; gap: 18px; flex-wrap: wrap; margin-bottom: 14px; }
  .allot-legend span.item { font-size: 12.5px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }
  .swatch { width: 11px; height: 11px; border-radius: 3px; display: inline-block; }
  .sw-ok { background: var(--secondary); }
  .sw-full { background: var(--primary); }
  .sw-over { background: var(--critical); }
  .sw-unused { background: var(--gridline); border: 1px solid var(--border); }
  table.allot { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table.allot th, table.allot td {
    padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--gridline); vertical-align: top;
  }
  table.allot thead th {
    color: var(--secondary); font-weight: 700; background: #f4f6f8; white-space: nowrap; font-size: 12px;
  }
  table.allot tr.hotel-head th {
    background: #eef1f4; color: var(--secondary); font-weight: 700;
    font-size: 12px; letter-spacing: 0.03em; text-transform: uppercase;
  }
  .row-room { color: var(--text-secondary); font-weight: 600; white-space: nowrap; }
  .beds-hint { color: var(--text-muted); font-weight: 400; font-size: 11px; white-space: nowrap; }
  .cell { min-width: 128px; }
  .cell-nums { font-variant-numeric: tabular-nums; color: var(--text-secondary); margin-bottom: 5px; }
  .cell-nums b { color: var(--secondary); font-size: 14px; }
  .cell-note { font-size: 11px; color: var(--text-muted); margin-top: 5px; }
  .cell-empty { color: var(--text-muted); }
  .meter {
    position: relative; background: var(--gridline);
    border-radius: 5px; height: 10px; width: 100%; max-width: 132px;
  }
  .meter-fill { height: 100%; border-radius: 5px; background: var(--secondary); }
  .meter-full { background: var(--primary); }
  .meter-over { background: var(--critical); }
  /* overløp: egen geometri, så "over allotment" ikke hviler på farge alene */
  .meter-spill {
    position: absolute; top: -2px; right: -7px; width: 5px; height: 14px;
    border-radius: 2px; background: var(--critical);
    box-shadow: -2px 0 0 0 var(--surface-1);
  }
  .state-full .cell-note { color: var(--primary); font-weight: 700; }
  .state-over .cell-note { color: var(--critical); font-weight: 700; }
  .state-over { background: #fdf3f2; }
  .total-row th, .total-row td { border-top: 2px solid var(--gridline); border-bottom: none; }
  .total-row th { color: var(--secondary); font-weight: 700; }
  .panel-note { font-size: 11.5px; color: var(--text-muted); margin-top: 12px; line-height: 1.5; }

  .search-row { margin-bottom: 14px; }
  .search-row input {
    width: 100%; max-width: 360px; padding: 9px 12px;
    border: 1px solid var(--gridline); border-radius: 6px; font-size: 13px; font-family: inherit;
  }
  table#participantsTable { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  table#participantsTable th, table#participantsTable td {
    padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--gridline);
  }
  table#participantsTable th {
    cursor: pointer; user-select: none; color: var(--secondary);
    font-weight: 700; background: #f4f6f8; white-space: nowrap;
  }
  table#participantsTable th::after { content: ""; opacity: 0.4; margin-left: 4px; }
  table#participantsTable th.sort-asc::after { content: "▲"; opacity: 1; }
  table#participantsTable th.sort-desc::after { content: "▼"; opacity: 1; }
  td.num { text-align: center; }
  table#participantsTable tr:hover td { background: #fbf3ef; }
  .badge {
    display: inline-block; background: var(--primary); color: #fff;
    font-size: 10.5px; font-weight: 700; padding: 2px 6px; border-radius: 4px;
  }
  .row-count { font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }
  footer { text-align: center; font-size: 11.5px; color: var(--text-muted); padding: 18px 0 30px; }
</style>
</head>
<body>

<div class="demo-banner"><span>DEMO — oppdiktede data — ikke reelle deltagere</span></div>

<header>
  <h1>Sparebankdagene 2026 — booking-dashboard <span class="badge">DEMO</span></h1>
  <div class="meta">
    <div>📍 Ålesund, 15.–17. november 2026</div>
    <div>Snapshot: <b>${SNAPSHOT_DATE}</b></div>
    <div>Første generering: <b>${BASELINE.date}</b></div>
  </div>
</header>

<div class="tabs">
  <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
  <button class="tab-btn" data-tab="deltagere">Deltagerliste</button>
</div>

<main>

  <div class="tab-panel active" id="tab-dashboard">
    <div class="kpi-grid">
      ${kpiHtml}
    </div>

    <div class="panel-block">
      <h2>Påmeldte pr. programpunkt</h2>
      <div class="panel-sub">Antall deltagere påmeldt hvert programpunkt.</div>
      ${programBarsHtml}
    </div>

    <div class="panel-block">
      <h2>Romfordeling pr. rom pr. natt — booket mot allotment</h2>
      <div class="panel-sub">Bookede rom av avtalt allotment, pr. hotell, romtype og natt.</div>
      <div class="allot-legend">
        <span class="item"><span class="swatch sw-ok"></span>Booket innenfor allotment</span>
        <span class="item"><span class="swatch sw-full"></span>Fullt / nesten fullt (≥ 95 %)</span>
        <span class="item"><span class="swatch sw-over"></span>Over eller utenfor allotment</span>
        <span class="item"><span class="swatch sw-unused"></span>Ubenyttet allotment</span>
      </div>
      <div style="overflow-x:auto;">
      <table class="allot">
        <thead>
          <tr>
            <th scope="col">Overnatting / romtype</th>
            ${nightHeaders}
          </tr>
        </thead>
        <tbody>
${allotmentRows}
${totalRow}
        </tbody>
      </table>
      </div>
      <div class="panel-note">
        Bookede rom er regnet ut fra innsjekk-/utsjekkdato pr. deltager. Dobbeltrom teller som ett rom pr. to gjester,
        slik at tallene kan sammenlignes direkte med allotmentet. «–» betyr at romtypen ikke er avtalt for den natten.
        Allotment-tallene i denne demoen er oppdiktede, men har samme struktur som Qondor-uttrekket.
      </div>
    </div>
  </div>

  <div class="tab-panel" id="tab-deltagere">
    <div class="search-row">
      <input type="text" id="searchInput" placeholder="Søk på navn, firma, e-post, mobil, hotell eller romtype …">
    </div>
    <div class="row-count" id="rowCount"></div>
    <div style="overflow-x:auto;">
    <table id="participantsTable">
      <thead>
        <tr>
          <th data-sort="navn">Navn</th>
          <th data-sort="firma">Firma</th>
          <th data-sort="epost">E-post</th>
          <th data-sort="mobil">Mobil</th>
          <th data-sort="hotel">Hotell</th>
          <th data-sort="rom">Romtype</th>
          <th data-sort="middag" class="num">Middag stift.</th>
          <th data-sort="stiftelse" class="num">Stiftelsessaml.</th>
          <th data-sort="festmiddag" class="num">Festmiddag</th>
          <th data-sort="fagkonf" class="num">Fagkonf.</th>
        </tr>
      </thead>
      <tbody id="participantsBody"></tbody>
    </table>
    </div>
  </div>

</main>

<footer>DEMO-dashboard generert med Claude — alle navn, firmaer, e-poster, mobilnumre, deltagertall og allotment-tall er oppdiktet og strukturelt (ikke identisk) basert på et reelt eksempel.</footer>

<script>
const participants = ${participantsJson};

document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  });
});

let currentSort = { key: null, dir: 1 };
let currentFilter = '';

function renderTable() {
  const body = document.getElementById('participantsBody');
  const q = currentFilter.trim().toLowerCase();
  let rows = participants.filter(p => {
    if (!q) return true;
    return (p.navn + ' ' + p.firma + ' ' + p.epost + ' ' + p.mobil + ' ' + p.hotel + ' ' + p.rom)
      .toLowerCase().includes(q);
  });

  if (currentSort.key) {
    rows = rows.slice().sort((a, b) => {
      const av = a[currentSort.key], bv = b[currentSort.key];
      if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * currentSort.dir;
      return String(av).localeCompare(String(bv), 'no') * currentSort.dir;
    });
  }

  document.getElementById('rowCount').textContent = rows.length + ' av ' + participants.length + ' deltagere';

  body.innerHTML = rows.map(p => \`
    <tr>
      <td>\${p.navn}</td>
      <td>\${p.firma}</td>
      <td>\${p.epost}</td>
      <td>\${p.mobil}</td>
      <td>\${p.hotel || '<span style="color:var(--text-muted)">Dagsgjest</span>'}</td>
      <td>\${p.rom || '<span style="color:var(--text-muted)">–</span>'}</td>
      <td class="num">\${p.middag ? '✓' : ''}</td>
      <td class="num">\${p.stiftelse ? '✓' : ''}</td>
      <td class="num">\${p.festmiddag ? '✓' : ''}</td>
      <td class="num">\${p.fagkonf ? '✓' : ''}</td>
    </tr>
  \`).join('');
}

document.getElementById('searchInput').addEventListener('input', (e) => {
  currentFilter = e.target.value;
  renderTable();
});

document.querySelectorAll('th[data-sort]').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (currentSort.key === key) currentSort.dir *= -1;
    else { currentSort.key = key; currentSort.dir = 1; }
    document.querySelectorAll('th[data-sort]').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(currentSort.dir === 1 ? 'sort-asc' : 'sort-desc');
    renderTable();
  });
});

renderTable();
</script>

</body>
</html>
`;

fs.writeFileSync(OUT, html, 'utf8');

console.log(`Skrev ${OUT} (${html.length} tegn)`);
console.log(`KPI: total=${TOTAL} festmiddag=${FESTMIDDAG} fagkonf=${FAGKONF} stiftelse=${STIFTELSE} middag=${MIDDAG} selskaper=${COMPANIES}`);
console.log('Netter:', allNights.join(', '));
for (const hotel of hotelNames) {
  for (const room of roomTypesFor(hotel)) {
    const cells = allNights.map((n) => {
      const cap = allotmentFor(hotel, room, n);
      return `${nightLabel(n)}: ${bookedRooms(hotel, room, n)}/${cap === null ? '-' : cap}`;
    });
    console.log(`  ${hotel} | ${room} | ${cells.join('  ')}`);
  }
}

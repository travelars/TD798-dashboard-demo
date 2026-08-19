import json

participants = json.load(open("/root/work/participants_js.json"))

TOTAL = len(participants)
MIDDAG = sum(p["middag"] for p in participants)
STIFTELSE = sum(p["stiftelse"] for p in participants)
FESTMIDDAG = sum(p["festmiddag"] for p in participants)
FAGKONF = sum(p["fagkonf"] for p in participants)
COMPANIES = len(set(p["firma"] for p in participants))

from collections import Counter, defaultdict
import re, datetime

hotel_heads = Counter(p["hotel"] for p in participants if p["hotel"])
no_hotel = sum(1 for p in participants if not p["hotel"])

mon_map = {'jan':1,'feb':2,'mar':3,'apr':4,'mai':5,'jun':6,'jul':7,'aug':8,'sep':9,'okt':10,'nov':11,'des':12}
def parse_date(s):
    m = re.match(r'(\d+)(\w{3})(\d+)', s)
    dd,mo,y = m.groups()
    return datetime.date(int('20'+y), mon_map[mo.lower()], int(dd))

room_nights = defaultdict(lambda: defaultdict(int))
for p in participants:
    if p["hotelStr"]:
        m = re.search(r'Fra (\d+\w{3}\d+) til (\d+\w{3}\d+)', p["hotelStr"])
        d1 = parse_date(m.group(1)); d2 = parse_date(m.group(2))
        cur = d1
        while cur < d2:
            room_nights[p["hotel"]][cur.isoformat()] += 1
            cur += datetime.timedelta(days=1)

all_nights = sorted(set(n for h in room_nights.values() for n in h.keys()))
hotels_sorted = [h for h, _ in hotel_heads.most_common()]

night_labels = {n: datetime.date.fromisoformat(n).strftime("%d.%m") for n in all_nights}

# Baseline (fake "first generation" figures, for demo of delta feature)
BASELINE = {
    "date": "01.08.2026",
    "total": 178,
    "middag": 41,
    "stiftelse": 55,
    "festmiddag": 171,
    "fagkonf": 165,
    "companies": 79,
}

SNAPSHOT_DATE = "19.08.2026"

def delta_html(current, baseline):
    diff = current - baseline
    sign = "+" if diff >= 0 else ""
    cls = "delta-up" if diff >= 0 else "delta-down"
    return f'<div class="kpi-delta {cls}">{sign}{diff} siden {BASELINE["date"]} ({baseline} → {current})</div>'

kpi_cards = [
    ("Totalt påmeldte", TOTAL, BASELINE["total"]),
    ("Festmiddag &amp; kickoff", FESTMIDDAG, BASELINE["festmiddag"]),
    ("Fagkonferanse tirsdag", FAGKONF, BASELINE["fagkonf"]),
    ("Stiftelsessamling mandag", STIFTELSE, BASELINE["stiftelse"]),
    ("Middag for sparebankstiftelser", MIDDAG, BASELINE["middag"]),
    ("Unike selskaper", COMPANIES, BASELINE["companies"]),
]

max_kpi_program = max(FESTMIDDAG, FAGKONF, STIFTELSE, MIDDAG)

program_bars = [
    ("Festmiddag og kickoff", FESTMIDDAG),
    ("Fagkonferanse tirsdag", FAGKONF),
    ("Stiftelsessamling mandag", STIFTELSE),
    ("Middag for sparebankstiftelser", MIDDAG),
]

hotel_bars = [(h, c) for h, c in hotel_heads.most_common()]
hotel_bars.append(("Ingen hotellbestilling (dagsgjest)", no_hotel))
max_hotel = max(c for _, c in hotel_bars)

# multi-series room-nights per hotel per night, colors validated via dataviz skill
series_colors_light = ["#f15b29", "#2a78d6", "#1baf7a"]
series_colors_dark = ["#f15b29", "#3987e5", "#199e70"]

max_night_val = max((v for h in room_nights.values() for v in h.values()), default=1)

def kpi_card_html(label, value, baseline):
    return f"""
        <div class="kpi-card">
          <div class="kpi-label">{label}</div>
          <div class="kpi-value">{value}</div>
          {delta_html(value, baseline)}
        </div>"""

kpi_html = "\n".join(kpi_card_html(l, v, b) for l, v, b in kpi_cards)

def program_bar_html(label, value, maxval):
    pct = round(value / maxval * 100, 1) if maxval else 0
    return f"""
        <div class="bar-row">
          <div class="bar-label">{label}</div>
          <div class="bar-track"><div class="bar-fill bar-fill-single" style="width:{pct}%"></div></div>
          <div class="bar-value">{value}</div>
        </div>"""

program_bars_html = "\n".join(program_bar_html(l, v, max_kpi_program) for l, v in program_bars)

def hotel_bar_html(label, value, maxval):
    pct = round(value / maxval * 100, 1) if maxval else 0
    return f"""
        <div class="bar-row">
          <div class="bar-label">{label}</div>
          <div class="bar-track"><div class="bar-fill bar-fill-single" style="width:{pct}%"></div></div>
          <div class="bar-value">{value}</div>
        </div>"""

hotel_bars_html = "\n".join(hotel_bar_html(l, v, max_hotel) for l, v in hotel_bars)

def night_group_html(night):
    label = night_labels[night]
    segs = []
    for i, h in enumerate(hotels_sorted):
        val = room_nights[h].get(night, 0)
        pct = round(val / max_night_val * 100, 1) if max_night_val else 0
        color_idx = i % len(series_colors_light)
        segs.append(f"""
            <div class="night-bar-row">
              <span class="night-bar-hotel">{h}</span>
              <div class="bar-track night-bar-track">
                <div class="bar-fill" style="width:{pct}%; background: var(--series-{color_idx+1});"></div>
              </div>
              <span class="night-bar-value">{val}</span>
            </div>""")
    return f"""
        <div class="night-group">
          <div class="night-group-label">Natt til {label}</div>
          {''.join(segs)}
        </div>"""

nights_html = "\n".join(night_group_html(n) for n in all_nights)

legend_html = "".join(
    f'<span class="legend-item"><span class="legend-swatch" style="background: var(--series-{i+1});"></span>{h}</span>'
    for i, h in enumerate(hotels_sorted)
)

participants_json = json.dumps(participants, ensure_ascii=False)

html = f"""<!doctype html>
<html lang="no">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DEMO — Sparebankdagene 2026 — booking-dashboard</title>
<style>
  :root {{
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
    --series-1: #f15b29;
    --series-2: #2a78d6;
    --series-3: #1baf7a;
    --delta-up: #006300;
    --delta-down: #b5391a;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--page);
    color: var(--text-primary);
  }}
  .demo-banner {{
    background: repeating-linear-gradient(45deg, var(--primary), var(--primary) 10px, #ffffff 10px, #ffffff 20px);
    color: var(--secondary);
    text-align: center;
    font-weight: 700;
    font-size: 13px;
    letter-spacing: 0.04em;
    padding: 6px 0;
    text-transform: uppercase;
  }}
  .demo-banner span {{
    background: var(--surface-1);
    padding: 3px 12px;
    border-radius: 4px;
  }}
  header {{
    background: var(--secondary);
    color: #ffffff;
    padding: 28px 32px 22px;
  }}
  header h1 {{
    margin: 0 0 6px 0;
    font-size: 22px;
    font-weight: 700;
  }}
  header .meta {{
    color: #c7d3dd;
    font-size: 13px;
    display: flex;
    gap: 18px;
    flex-wrap: wrap;
  }}
  header .meta b {{ color: #ffffff; }}
  .tabs {{
    display: flex;
    gap: 4px;
    padding: 0 32px;
    background: var(--surface-1);
    border-bottom: 1px solid var(--gridline);
  }}
  .tab-btn {{
    border: none;
    background: transparent;
    padding: 14px 18px;
    font-size: 14px;
    font-weight: 600;
    color: var(--text-secondary);
    cursor: pointer;
    border-bottom: 3px solid transparent;
    font-family: inherit;
  }}
  .tab-btn.active {{
    color: var(--secondary);
    border-bottom-color: var(--primary);
  }}
  main {{ padding: 24px 32px 48px; max-width: 1180px; margin: 0 auto; }}
  .tab-panel {{ display: none; }}
  .tab-panel.active {{ display: block; }}
  .kpi-grid {{
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
    gap: 14px;
    margin-bottom: 28px;
  }}
  .kpi-card {{
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px 18px;
  }}
  .kpi-label {{
    font-size: 12.5px;
    color: var(--text-secondary);
    margin-bottom: 6px;
    font-weight: 600;
  }}
  .kpi-value {{
    font-size: 30px;
    font-weight: 700;
    color: var(--secondary);
    line-height: 1.1;
  }}
  .kpi-delta {{
    font-size: 12px;
    margin-top: 6px;
    font-weight: 600;
  }}
  .delta-up {{ color: var(--delta-up); }}
  .delta-down {{ color: var(--delta-down); }}
  .panel-block {{
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 22px;
    margin-bottom: 22px;
  }}
  .panel-block h2 {{
    font-size: 15px;
    margin: 0 0 16px 0;
    color: var(--secondary);
    font-weight: 700;
  }}
  .bar-row {{
    display: grid;
    grid-template-columns: 220px 1fr 44px;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
    font-size: 13px;
  }}
  .bar-label {{ color: var(--text-secondary); }}
  .bar-track {{
    background: var(--gridline);
    border-radius: 5px;
    height: 14px;
    overflow: hidden;
  }}
  .bar-fill {{
    height: 100%;
    border-radius: 4px;
    background: var(--secondary);
  }}
  .bar-fill-single {{ background: var(--secondary); }}
  .bar-value {{ text-align: right; font-weight: 700; color: var(--secondary); }}
  .night-group {{ margin-bottom: 18px; }}
  .night-group-label {{
    font-size: 12.5px;
    font-weight: 700;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
    margin-bottom: 8px;
  }}
  .night-bar-row {{
    display: grid;
    grid-template-columns: 170px 1fr 40px;
    align-items: center;
    gap: 12px;
    margin-bottom: 6px;
    font-size: 12.5px;
  }}
  .night-bar-hotel {{ color: var(--text-secondary); }}
  .night-bar-track {{ height: 12px; }}
  .night-bar-value {{ text-align: right; font-weight: 700; color: var(--secondary); }}
  .legend {{ display: flex; gap: 18px; margin-bottom: 14px; flex-wrap: wrap; }}
  .legend-item {{ font-size: 12.5px; color: var(--text-secondary); display: flex; align-items: center; gap: 6px; }}
  .legend-swatch {{ width: 11px; height: 11px; border-radius: 3px; display: inline-block; }}
  .search-row {{ margin-bottom: 14px; }}
  .search-row input {{
    width: 100%;
    max-width: 360px;
    padding: 9px 12px;
    border: 1px solid var(--gridline);
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
  }}
  table {{ width: 100%; border-collapse: collapse; font-size: 12.5px; }}
  th, td {{ padding: 8px 10px; text-align: left; border-bottom: 1px solid var(--gridline); }}
  th {{
    cursor: pointer;
    user-select: none;
    color: var(--secondary);
    font-weight: 700;
    background: #f4f6f8;
    white-space: nowrap;
  }}
  th::after {{ content: ""; opacity: 0.4; margin-left: 4px; }}
  th.sort-asc::after {{ content: "▲"; opacity: 1; }}
  th.sort-desc::after {{ content: "▼"; opacity: 1; }}
  td.num {{ text-align: center; }}
  tr:hover td {{ background: #fbf3ef; }}
  .badge {{
    display: inline-block;
    background: var(--primary);
    color: #fff;
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }}
  .row-count {{ font-size: 12px; color: var(--text-muted); margin-bottom: 8px; }}
  footer {{
    text-align: center;
    font-size: 11.5px;
    color: var(--text-muted);
    padding: 18px 0 30px;
  }}
</style>
</head>
<body>

<div class="demo-banner"><span>DEMO — oppdiktede data — ikke reelle deltagere</span></div>

<header>
  <h1>Sparebankdagene 2026 — booking-dashboard <span class="badge">DEMO</span></h1>
  <div class="meta">
    <div>📍 Ålesund, 15.–17. november 2026</div>
    <div>Snapshot: <b>{SNAPSHOT_DATE}</b></div>
    <div>Første generering: <b>{BASELINE["date"]}</b></div>
  </div>
</header>

<div class="tabs">
  <button class="tab-btn active" data-tab="dashboard">Dashboard</button>
  <button class="tab-btn" data-tab="deltagere">Deltagerliste</button>
</div>

<main>

  <div class="tab-panel active" id="tab-dashboard">
    <div class="kpi-grid">
      {kpi_html}
    </div>

    <div class="panel-block">
      <h2>Påmeldte pr. programpunkt</h2>
      {program_bars_html}
    </div>

    <div class="panel-block">
      <h2>Hotellfordeling pr. hode</h2>
      {hotel_bars_html}
    </div>

    <div class="panel-block">
      <h2>Romfordeling pr. natt pr. hotell</h2>
      <div class="legend">{legend_html}</div>
      {nights_html}
      <div style="font-size:11.5px;color:var(--text-muted);margin-top:6px;">
        Basert på faktiske innsjekk-/utsjekkdatoer pr. deltager. Viser reell fordeling — ikke allotment-kapasitet (finnes ikke i denne demoen).
      </div>
    </div>
  </div>

  <div class="tab-panel" id="tab-deltagere">
    <div class="search-row">
      <input type="text" id="searchInput" placeholder="Søk på navn, firma, e-post, mobil eller hotell …">
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

<footer>DEMO-dashboard generert med Claude — alle navn, firmaer, e-poster, mobilnumre og deltagertall er oppdiktet og strukturelt (ikke identisk) basert på et reelt eksempel.</footer>

<script>
const participants = {participants_json};

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {{
  btn.addEventListener('click', () => {{
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
  }});
}});

let currentSort = {{ key: null, dir: 1 }};
let currentFilter = '';

function renderTable() {{
  const body = document.getElementById('participantsBody');
  const q = currentFilter.trim().toLowerCase();
  let rows = participants.filter(p => {{
    if (!q) return true;
    return (p.navn + ' ' + p.firma + ' ' + p.epost + ' ' + p.mobil + ' ' + p.hotel)
      .toLowerCase().includes(q);
  }});

  if (currentSort.key) {{
    rows = rows.slice().sort((a, b) => {{
      const av = a[currentSort.key], bv = b[currentSort.key];
      if (typeof av === 'number' && typeof bv === 'number') {{
        return (av - bv) * currentSort.dir;
      }}
      return String(av).localeCompare(String(bv), 'no') * currentSort.dir;
    }});
  }}

  document.getElementById('rowCount').textContent = rows.length + ' av ' + participants.length + ' deltagere';

  body.innerHTML = rows.map(p => `
    <tr>
      <td>${{p.navn}}</td>
      <td>${{p.firma}}</td>
      <td>${{p.epost}}</td>
      <td>${{p.mobil}}</td>
      <td>${{p.hotel || '<span style="color:var(--text-muted)">Dagsgjest</span>'}}</td>
      <td class="num">${{p.middag ? '✓' : ''}}</td>
      <td class="num">${{p.stiftelse ? '✓' : ''}}</td>
      <td class="num">${{p.festmiddag ? '✓' : ''}}</td>
      <td class="num">${{p.fagkonf ? '✓' : ''}}</td>
    </tr>
  `).join('');
}}

document.getElementById('searchInput').addEventListener('input', (e) => {{
  currentFilter = e.target.value;
  renderTable();
}});

document.querySelectorAll('th[data-sort]').forEach(th => {{
  th.addEventListener('click', () => {{
    const key = th.dataset.sort;
    if (currentSort.key === key) {{
      currentSort.dir *= -1;
    }} else {{
      currentSort.key = key;
      currentSort.dir = 1;
    }}
    document.querySelectorAll('th[data-sort]').forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
    th.classList.add(currentSort.dir === 1 ? 'sort-asc' : 'sort-desc');
    renderTable();
  }});
}});

renderTable();
</script>

</body>
</html>
"""

with open("/root/work/TD798_Dashboard_DEMO.html", "w", encoding="utf-8") as f:
    f.write(html)

print("written", len(html), "bytes")

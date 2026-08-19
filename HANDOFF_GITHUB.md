# Handoff: TD798 demo-dashboard → GitHub via Claude Code

Dette dokumentet oppsummerer hva som er gjort i denne Cowork-økten, hvorfor GitHub-tilkobling ikke fungerte her, og hva du gjør videre i Claude Code på din egen maskin.

## Hva er laget

Et selvstendig demo-dashboard (`TD798_Dashboard_DEMO.html`) for arrangementet Sparebankdagene 2026 (TD798), bygget etter samme struktur som det ekte TD798-dashboardet, men med **100 % oppdiktede deltagerdata** (navn, firma, e-post, mobil) og litt forskjøvne totaltall — aldri de reelle 236 deltagerne fra Qondor-eksporten. Fargene følger Traveldesigns profil (`#f15b29` primær, `#122e47` sekundær), og flerserie-diagrammet (romfordeling pr. natt pr. hotell) er fargevalidert med `dataviz`-skillet siden sekundærfargen alene ikke er lesbar som datafarge.

Filer:

- `TD798_Dashboard_DEMO.html` — selve dashboardet (generert, ikke rediger direkte)
- `build_html.mjs` — byggescriptet som genererer HTML-filen fra dummy-dataene: `node build_html.mjs`
- `fake_data.json` — den genererte dummy-deltagerlisten (224 fiktive personer)
- `build_html.py` — **utdatert.** Det opprinnelige Python-scriptet fra Cowork-økten. Det leser fra
  `/root/work/…` (sandkasse-stier som ikke finnes lokalt), og maskinen har ingen fungerende
  Python-installasjon. Erstattet av `build_html.mjs`. Kan slettes.

## Endringer 19.08.2026

- Panelet «Hotellfordeling pr. hode» er fjernet. Fordeling pr. person finnes fortsatt i
  deltagerliste-fanen, som nå også har en egen «Romtype»-kolonne.
- Panelet «Romfordeling pr. natt pr. hotell» er erstattet av «Romfordeling pr. rom pr. natt —
  booket mot allotment»: en matrise med hotell × romtype som rader og netter som kolonner, der
  hver celle er en måler som viser bookede rom mot avtalt allotment.
- **Rom, ikke hoder.** Den gamle versjonen viste antall gjester pr. natt, som ikke kan
  sammenlignes med et allotment. Nå regnes dobbeltrom som ett rom pr. to gjester.
- Allotment-tallene ligger som konstanten `ALLOTMENT` øverst i `build_html.mjs`, med samme
  struktur som Qondor-uttrekket (hotell → romtype → natt). Verdiene i demoen er **oppdiktede**;
  bytt dem mot de reelle hvis dashboardet skal vise ekte kapasitet.
- Byggescriptet er portet fra Python til Node, siden maskinen ikke har Python.

## Hvorfor GitHub ikke fungerte i denne Cowork-økten

Denne økten kjører i en sky-sandkasse med begrenset nettverkstilgang. Da jeg testet GitHub-tilgang fikk jeg dette svaret tilbake fra proxyen miljøet kjører bak:

> "This GitHub API path is not available: sessions are bound to their configured repositories. Use repository-scoped endpoints (repos/{owner}/{repo}/...)."

Kort forklart: miljøet har en innebygd, forhåndsbegrenset GitHub-tilgang (samme mekanisme som brukes når Claude Code trigges via GitHub Actions), ikke en generell innlogging mot en GitHub-konto. Det finnes ikke et konfigurert repo å skrive til, og verken `gh auth login` (device-flow) eller installasjon av `gh`-CLI via `cli.github.com` fikk fullt gjennomslag (403 fra samme proxy). Det er en sikkerhetsgrense i miljøet, ikke noe som kan omgås derfra.

Det er ingen offisiell GitHub MCP-connector tilgjengelig i Traveldesigns claude.ai-connector-katalog per nå heller (`SearchMcpRegistry` og katalogsøket i appen gir begge null treff på "github").

## Hva du gjør i Claude Code

Claude Code kjører lokalt på din maskin (eller et miljø hvor du allerede har satt opp `gh auth login` / SSH-nøkkel mot GitHub — det er sannsynligvis derfor det "virket der" tidligere). Der har du ordentlig, ubegrenset nettverkstilgang til GitHub under din egen konto.

Foreslåtte steg i Claude Code:

1. Filene ligger allerede i `C:\Claude\Dashboard-Demo`.
2. `git init`
3. `gh repo create TD798-dashboard-demo --private --source=. --remote=origin` (eller `--public` hvis dashboardet skal være delbart uten innlogging)
4. `git add . && git commit -m "Demo-dashboard TD798 Sparebankdagene 2026"`
5. `git push -u origin main`
6. Hvis du vil ha den viewbar direkte fra en lenke: aktiver GitHub Pages på repoet (Settings → Pages → Deploy from branch), pek til `main`/`root` — da får du en offentlig URL til `TD798_Dashboard_DEMO.html`.

## Videre alternativ

Når den offisielle GitHub-connectoren dukker opp i claude.ai sin connector-katalog for Traveldesign (Settings → Connectors), kan denne typen jobb gjøres direkte i en Cowork-økt uten å gå via Claude Code.

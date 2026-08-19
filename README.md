# TD798 — demo-dashboard, Sparebankdagene 2026

Et selvstendig booking-dashboard for arrangementet Sparebankdagene 2026 (TD798), bygget som
demo av hva et Qondor-basert dashboard kan vise.

> **Alle data i dette repoet er oppdiktede.** Deltagernavn, firmaer, e-poster, mobilnumre,
> deltagertall og allotment-tall er generert for demoformål. Ingen reelle deltagere,
> ingen reelle kontraktstall.

## Hva dashboardet viser

**Dashboard-fanen**

- Seks KPI-kort med endring siden forrige generering (påmeldte, programpunkter, unike selskaper)
- Påmeldte pr. programpunkt
- Romfordeling pr. rom pr. natt, booket mot allotment: en matrise med hotell og romtype som
  rader og netter som kolonner. Hver celle er en måler som viser bookede rom av avtalt
  allotment, med egen markering for fullt eller nesten fullt (fra 95 %), booket utenfor
  allotment, og ubenyttet allotment.

**Deltagerliste-fanen**

- Alle 224 fiktive deltagere, søkbare på navn, firma, e-post, mobil, hotell og romtype,
  sorterbare på alle kolonner.

Rom telles som rom, ikke som gjester: et dobbeltrom er ett rom per to gjester, slik at tallene
kan sammenlignes direkte med allotmentet.

## Bygge på nytt

```
node build_html.mjs
```

Scriptet leser `fake_data.json` og skriver `TD798_Dashboard_DEMO.html`. Ingen avhengigheter og
ingen nettverkstilgang; HTML-fila er helt selvstendig og kan åpnes direkte i en nettleser.

Allotment-tallene ligger som konstanten `ALLOTMENT` øverst i `build_html.mjs`, strukturert som
hotell → romtype → natt.

## Filer

| Fil | Rolle |
|---|---|
| `TD798_Dashboard_DEMO.html` | Dashboardet. Generert — ikke rediger direkte. |
| `build_html.mjs` | Byggescriptet. Kjør med Node. |
| `fake_data.json` | Den oppdiktede deltagerlisten (224 personer). |
| `HANDOFF_GITHUB.md` | Bakgrunn og endringslogg. |
| `build_html.py` | Utdatert. Det opprinnelige Python-scriptet; erstattet av `build_html.mjs`. |

Farger følger Traveldesigns profil: `#f15b29` primær, `#122e47` sekundær.

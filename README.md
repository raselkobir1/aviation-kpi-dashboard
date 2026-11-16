# Aviation KPI Learning Dashboard (বাংলা ব্যাখ্যাসহ)

An interactive teaching dashboard for 34 airline KPIs (PLF, RASK, CASK, yield, CTK, OTP, baggage rates, profit, cash flow, debt and more), with:

- **Step-by-step calculations** for every KPI: a 4-flight sample worked row by row, plus a trace of the real dashboard data.
- **Short Bangla explanations** for every KPI and a 55-term glossary (technical terms stay in English).
- Filters by airline, month, route, aircraft type and distance; monthly charts; data download (CSV/JSON).

Open `index.html` in a browser — no build step or server needed.

> Educational simulation. Real airline identities; all performance and financial figures are synthetic.
> Recreated for study from the CAM.145 “Aviation KPI Learning Dashboard” teaching simulation (Dr. Bahtiyar Eren, Estonian Aviation Academy).

## Files
| File | Purpose |
|---|---|
| `index.html` | Page layout |
| `styles.css` | Styling |
| `data.js` | Synthetic dataset (5,000 flights + aircraft-day, pilot-day and finance tables) |
| `kpi.js` | KPI formulas, row-level calculation rules, sample data, Bangla text, glossary |
| `app.js` | User interface, navigation, charts |

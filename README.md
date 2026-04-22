# FlareWatch

FlareWatch is a Next.js dashboard for monitoring live gas flare activity, exploring impact data, and generating AI-assisted predictions for each flare site. It combines a cinematic live map, a dedicated calculator, and a per-flare prediction view so users can move from raw telemetry to an actionable insight quickly.

## What it does

- Shows live flare points on a 3D globe with hover tooltips and selection details.
- Lets you filter by onshore and offshore activity, search by block or operator, and inspect the top active sites.
- Generates AI summaries for a hovered flare using Gemini.
- Provides a dedicated prediction page for each flare spot.
- Includes a calculator that estimates recovery value, emissions impact, and projected losses from the live snapshot.

## Features

### Live map

- 3D globe powered by `react-globe.gl`.
- Live flare markers sized by flare intensity.
- Hover tooltip with block, operator, heat, value, plume radius, risk, and confidence.
- AI popup that appears next to the tooltip and summarizes the flare.
- Selected flare panel with health warnings, threatened areas, and a direct link to the prediction page.
- Search and filter controls for narrowing the active flares.

### Spot prediction pages

- Dedicated route for each flare: `/live-map/spot/[id]`.
- Forecast cards for escalation probability, priority score, and projected 7-day and 30-day loss.
- AI overview panel for the selected flare.
- Impact summary for plume radius, CO2, warnings, and threatened areas.

### Calculator

- Scenario sliders for capture efficiency and utilization rate.
- Live metrics based on the current flare snapshot.
- Recovery, emissions, and loss projections.
- Highest-risk site summary and snapshot totals.

### AI summaries

- Gemini-powered flare overviews generated from the live flare payload.
- Fallback summary logic if the API key is missing or the model request fails.
- Shared response shape across the live map and spot page.

## Tech Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS 4
- shadcn/ui components
- `axios` for external and internal API requests
- `react-globe.gl` for the live 3D globe
- `recharts` and other UI utilities already included in the project

## Routes

- `/` - Landing page
- `/home` - Alternate home landing view
- `/live-map` - Main live telemetry map
- `/live-map/spot/[id]` - Dedicated prediction page for one flare site
- `/calculator` - Recovery and impact calculator
- `/api/ai/flare-overview` - Internal AI route used by the UI

## Data Sources

FlareWatch reads from a live telemetry endpoint in `services/flare.service.ts`:

- External telemetry endpoint: `https://flarewatcher.onrender.com/api/v1/telemetry/live`
- Internal AI route: `/api/ai/flare-overview`

The live payload includes:

- `meta` - snapshot metadata such as satellite and timestamp
- `telemetry[]` - flare points with:
  - coordinates
  - radiant heat
  - value estimate
  - CO2 estimate
  - intelligence confidence and detection time
  - attribution block/operator/trend
  - impact analysis with risk level, plume radius, warnings, and threatened areas

## Folder Structure

```text
app/
  layout.tsx
  page.tsx
  home/
    page.tsx
  live-map/
    page.tsx
    spot/
      [id]/
        page.tsx
  calculator/
    page.tsx
  api/
    ai/
      flare-overview/
        route.ts
components/
  landing-page/
    header.tsx
    footer.tsx
    hero.tsx
    SectionTwo.tsx
  layout/
    site-chrome.tsx
  ui/
    ...shadcn components...
hooks/
  use-mobile.ts
lib/
  utils.ts
  data.ts
public/
  assets/
services/
  flare.service.ts
```

## Environment Variables

Create a `.env.local` file in the project root for Gemini:

```env
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-1.5-flash
```

### Notes

- `GEMINI_API_KEY` is required for live AI summaries.
- `GEMINI_MODEL` is optional. If omitted, the app defaults to `gemini-1.5-flash`.
- If the key is missing, the app still works and uses fallback summaries.

## Installation

```bash
npm install
```

## Development

Start the dev server:

```bash
npm run dev
```

Then open:

```bash
http://localhost:3000
```

## Production Build

```bash
npm run build
npm run start
```

## Linting

```bash
npm run lint
```

## How to Use the App

1. Open the landing page and use the main navigation.
2. Go to **Live Map** to inspect active flare points.
3. Hover a flare to see the tooltip and AI popup.
4. Click a flare to pin it in the sidebar.
5. Use **View prediction** to open the dedicated spot page.
6. Open **Calculator** to test recovery and emissions scenarios.

## Implementation Notes

- The live map uses hover state and marker events to show tooltip and AI insight cards.
- The spot page calculates prediction-style metrics from the live flare payload.
- The calculator uses the current telemetry snapshot to estimate economic and environmental outcomes.
- The AI route returns the same response contract to keep the UI consistent.

## Customization

If you want to change the live data source, edit:

- `services/flare.service.ts`

If you want to change the AI provider or prompt, edit:

- `app/api/ai/flare-overview/route.ts`

If you want to change the map or spot UI, edit:

- `app/live-map/page.tsx`
- `app/live-map/spot/[id]/page.tsx`
- `app/calculator/page.tsx`

## Browser Support

The app is designed for modern desktop and mobile browsers that support WebGL.

## License

No license has been specified for this project yet.

# @start-today/platform-shared

Shared React components and libraries used across the Start Today™ ecosystem.

Owner: Start Today, LLC. Private. Do not redistribute.

## What lives here

| Path | Module | Used by |
|---|---|---|
| `src/orgmap/OrgMap.jsx` | d3 force-directed graph of an org's entity / property / trust / loan / UCC / insurance structure with Start Score™ overlays | sales · client-dashboard (Phase 2) · chamber (planned) · attorney (planned) |
| `src/orgmap/xfMindMapNodes.js` | Pure data transformer from `get_mind_map_data_for_org` RPC output into renderable {nodes, links} | all consumers |
| `src/orgmap/orgmap-investments.js` | Investment-bridge helper — layers cap-table investments as ◆ nodes onto the OrgMap | client-dashboard (Phase 2), and any consumer that has investment data |
| `src/orgmap/tokens.js` | Brand-aligned token defaults for OrgMap™ (colors, node sizes, edge styles) — overridable per-app via props | all of the above |

## Roadmap

**Phase 1 (v0.1.0) — shipped:** d3 visual core. The component takes mind-map data as a prop (output of `xfMindMapNodes`) and renders the canonical Start Today force-directed graph. Detail panels are basic; consumers can override via `renderNodeDetail`. Sales app consumes this as its primary OrgMap.

**Phase 2 (v0.2.0) — next:** plugin modules for AI/tour/voice/time-lapse, lifted from client-dashboard's inline implementation. Migrate client-dashboard to consume the shared component (replaces ~2,500 inline lines). Port DetailPanels/STVerifyBadge/EntityStructurePanel so the full client-dash detail experience comes through the shared component too.

**Phase 3 (v0.3.0):** wire chamber and attorney portals. By this point a single change to the OrgMap codebase reaches all four apps.

## Consumption

In a consumer app's `package.json`:

```json
"dependencies": {
  "@start-today/platform-shared": "github:Starttodaybiz/platform-shared#main"
}
```

For pinning to a tag instead of `main`:

```json
"@start-today/platform-shared": "github:Starttodaybiz/platform-shared#v0.1.0"
```

In the consumer's `next.config.js`:

```js
module.exports = {
  transpilePackages: ['@start-today/platform-shared'],
  // ...
}
```

Import in code:

```jsx
import { OrgMap, xfMindMapNodes } from '@start-today/platform-shared/orgmap'
```

## Why a shared component

The OrgMap was originally hand-implemented twice — once in `client-dashboard` (2,515 lines, d3-based, full CARL Lens™ AI integration) and once in `sales` (554 lines, raw SVG simulation, no AI). Reps and customers were seeing two different shapes of the same data — a structural inconsistency we needed to remove.

This package is the canonical implementation. Consumers pass data in via props and the rendering is identical everywhere.

## Architecture

The OrgMap is **prop-driven and feature-gated**. The d3 layout engine, node/edge rendering, hull grouping, interaction model, and detail panel are all core (always on). The AI sidebar (CARL Lens™), guided tour, time-lapse playback, and voice control are optional features the consumer enables via props.

```jsx
<OrgMap
  // ── Data (required) ──
  mindMap={mm}                  // raw result of get_mind_map_data_for_org RPC

  // ── Optional enrichment ──
  beneficialOwners={bo}         // BO enrichment for entity nodes
  scoreMap={scv}                // pillar-level Start Score breakdown
  provenance={prov}             // STVerified / authoritative / document / asserted rungs
  investments={inv}             // cap-table investments to layer as ◆ nodes

  // ── Features (off by default) ──
  carlLensEnabled={false}       // AI sidebar — client-dashboard only
  onCarlAsk={async (q, ctx) => fetch('/api/carl', { ... })}
  tourEnabled={false}           // guided cinematic walkthrough
  timeLapseEnabled={false}      // structure-formation playback
  voiceEnabled={false}          // mic capture → CARL command

  // ── Visual customization (defaults shipped) ──
  brandTokens={{
    navy: '#1E3A5F', emerald: '#059669', text: '#0F172A',
    /* … see src/orgmap/tokens.js for the full token shape … */
  }}

  // ── Callbacks ──
  onNodeClick={(node) => ...}
  renderNodeDetail={(node) => <YourEntityDetailComponent ... />}
/>
```

## Versioning

Semver. Bump `version` in `package.json` on every release, tag with `git tag v0.x.y`, and update consumers' `package.json` to point at the new tag. Breaking changes get a major bump.

## Dev workflow

When iterating, consumers can `npm link` to a local clone of this repo and verify changes before pushing. To avoid the link dance for small fixes, push directly to `main` and run `npm update @start-today/platform-shared` in the consumer.

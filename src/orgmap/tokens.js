// Brand-aligned tokens for the OrgMap™ component.
//
// These mirror the Start Today™ design system (navy + emerald chrome, with
// categorical hues for graph node TYPES that match mylegal SECTION_COLORS).
// Consumers can override any of these by passing { brandTokens: {...} } to
// <OrgMap />. Anything not overridden falls back to these defaults.

// Chrome (UI surfaces) — brand-pure navy + emerald.
export const CHROME = {
  navy:      '#1E3A5F',
  navyDeep:  '#0F1E35',
  emerald:   '#059669',
  emeraldSoft:'#34D399',
  text:      '#0F172A',
  textSec:   '#475569',
  muted:     '#64748B',
  border:    '#E2E8F0',
  border2:   '#CBD5E1',
  bg:        '#F8FAFC',
  white:     '#FFFFFF',
  cream:     '#F5F4F1',
  red:       '#DC2626',
  redBg:     '#FEE2E2',
  amber:     '#D97706',
  amberBg:   '#FEF3C7',
  greenBg:   '#F0FDF4',
}

// Categorical hue palette for graph node TYPES — hue separation is sanctioned
// for categorical data only (matches mylegal SECTION_COLORS exactly).
export const NODE_HUE = {
  entity:    '#1E3A5F',   // Corporate (navy)
  trust:     '#7E22CE',   // Estate (violet — matches mylegal SECTION_COLORS.Estate)
  property:  '#059669',   // Property (emerald)
  person:    '#D97706',   // amber
  employee:  '#D97706',   // amber (same family as person)
  staff:     '#D97706',
  board:     '#D97706',
  insurance: '#4F46E5',   // Insurance (indigo — matches mylegal)
  loan:      '#1565C0',   // Banking (royal blue — matches mylegal)
  ucc:       '#475569',   // slate (legal filing — neutral)
  investment:'#0E7490',   // Finance teal (per orgmap-investments.js)
  govbody:   '#475569',
  dept:      '#1E3A5F',
  taxauthority:'#475569',
  dilcat:    '#7E22CE',
  taxobl:    '#475569',
  propitem:  '#059669',
  dilitem:   '#7E22CE',
  scorepillar:'#1E3A5F',
}

// Per-type styling for nodes. Radius scales with importance (entity > leaf).
export const NODE_STYLE = {
  entity:    { fill: NODE_HUE.entity,    stroke: '#0F1E35', radius: 22, label: 'Entity',     icon: '◉' },
  trust:     { fill: NODE_HUE.trust,     stroke: '#5B21B6', radius: 20, label: 'Trust',      icon: '◈' },
  property:  { fill: NODE_HUE.property,  stroke: '#065F46', radius: 18, label: 'Property',   icon: '⌂' },
  person:    { fill: NODE_HUE.person,    stroke: '#92400E', radius: 17, label: 'Person',     icon: '◇' },
  employee:  { fill: NODE_HUE.employee,  stroke: '#92400E', radius: 15, label: 'Employee',   icon: '◇' },
  staff:     { fill: NODE_HUE.staff,     stroke: '#92400E', radius: 15, label: 'Staff',      icon: '◇' },
  board:     { fill: NODE_HUE.board,     stroke: '#92400E', radius: 15, label: 'Board',      icon: '◇' },
  insurance: { fill: NODE_HUE.insurance, stroke: '#3730A3', radius: 14, label: 'Insurance',  icon: '▢' },
  loan:      { fill: NODE_HUE.loan,      stroke: '#0F4C81', radius: 14, label: 'Loan',       icon: '$' },
  ucc:       { fill: NODE_HUE.ucc,       stroke: '#334155', radius: 12, label: 'UCC',        icon: '⊕' },
  investment:{ fill: NODE_HUE.investment,stroke: '#155E75', radius: 14, label: 'Investment', icon: '◆' },
  govbody:   { fill: NODE_HUE.govbody,   stroke: '#334155', radius: 14, label: 'Gov body',   icon: '⚖' },
  dept:      { fill: NODE_HUE.dept,      stroke: '#0F1E35', radius: 14, label: 'Department', icon: '▦' },
  taxauthority:{ fill: NODE_HUE.taxauthority, stroke: '#334155', radius: 13, label: 'Tax authority', icon: '%' },
  dilcat:    { fill: NODE_HUE.dilcat,    stroke: '#5B21B6', radius: 13, label: 'Due diligence', icon: '◯' },
  taxobl:    { fill: NODE_HUE.taxobl,    stroke: '#334155', radius: 9,  label: 'Tax obligation', icon: '·' },
  propitem:  { fill: NODE_HUE.propitem,  stroke: '#065F46', radius: 9,  label: 'Property item',  icon: '·' },
  dilitem:   { fill: NODE_HUE.dilitem,   stroke: '#5B21B6', radius: 9,  label: 'Diligence item', icon: '·' },
  scorepillar:{ fill: NODE_HUE.scorepillar, stroke: '#0F1E35', radius: 10, label: 'Score pillar', icon: '◎' },
}

// Edge styles by relation kind. Solid for active relationships, dashed for
// pending / probabilistic.
export const EDGE_STYLE = {
  owns:            { color: '#1E3A5F', dash: null,  label: 'Owns',          width: 2 },
  owns_property:   { color: '#059669', dash: null,  label: 'Owns property', width: 2 },
  employs:         { color: '#D97706', dash: null,  label: 'Employs',       width: 1.5 },
  insured_by:      { color: '#4F46E5', dash: null,  label: 'Insured by',    width: 1.5 },
  borrowed_from:   { color: '#1565C0', dash: null,  label: 'Borrowed from', width: 1.5 },
  filed_against:   { color: '#475569', dash: '4,3', label: 'UCC filed',     width: 1.2 },
  beneficiary_of:  { color: '#7E22CE', dash: null,  label: 'Beneficiary',   width: 1.5 },
  trustee_of:      { color: '#7E22CE', dash: null,  label: 'Trustee',       width: 1.5 },
  invests:         { color: '#0E7490', dash: null,  label: 'Investment',    width: 1.5 },
  invests_pending: { color: '#0E7490', dash: '7,6', label: 'Pending conversion', width: 1.5 },
  stake_in:        { color: '#0E7490', dash: null,  label: 'Stake',         width: 1.5 },
  governs:         { color: '#475569', dash: null,  label: 'Governs',       width: 1.2 },
  reports_to:      { color: '#475569', dash: null,  label: 'Reports to',    width: 1.2 },
  default:         { color: '#94A3B8', dash: null,  label: '',              width: 1.0 },
}

// Composite token bundle the OrgMap consumes. Pass partial overrides via
// props.brandTokens — anything not specified falls back to these defaults.
export const DEFAULT_TOKENS = {
  chrome: CHROME,
  nodeStyle: NODE_STYLE,
  edgeStyle: EDGE_STYLE,
  fontSans: "'DM Sans', system-ui, sans-serif",
  fontSerif: "'DM Serif Display', Georgia, serif",
}

// Helper — deep-merge consumer overrides onto defaults so partial brandTokens
// props don't blow away unspecified categories.
export function mergeTokens(overrides = {}) {
  if (!overrides) return DEFAULT_TOKENS
  return {
    chrome:    { ...CHROME,    ...(overrides.chrome    || {}) },
    nodeStyle: { ...NODE_STYLE,...(overrides.nodeStyle || {}) },
    edgeStyle: { ...EDGE_STYLE,...(overrides.edgeStyle || {}) },
    fontSans:  overrides.fontSans  || DEFAULT_TOKENS.fontSans,
    fontSerif: overrides.fontSerif || DEFAULT_TOKENS.fontSerif,
  }
}

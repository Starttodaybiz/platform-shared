// xfMindMapNodes — transformer from the raw shape returned by
// get_mind_map_data_for_org(p_org_id uuid) RPC into the {nodes, links}
// arrays the OrgMap renders.
//
// Lifted verbatim from client-dashboard ClientShell.js (lines 118-298).
// Pure data shaping — no React, no d3, no DOM. Safe to call on the server
// or during build. The shape it emits is the contract the OrgMap renders against.
//
// Signature:
//   xfMindMapNodes(mm, bo, dept, tax, prop, dilv, scv)
//     mm   — raw RPC result { entities, trusts, properties, employees, ownership,
//                              entity_roles, insurance, compliance, chamber_staff,
//                              governance, ... }
//     bo   — beneficial-owner enrichment array (optional)
//     dept — department rollup array (optional)
//     tax  — taxation tier array (optional)
//     prop — property tier array (optional)
//     dilv — diligence-readiness tier array (optional)
//     scv  — Start Score™ pillar breakdown array (optional)
//   returns { nodes:[…], links:[…] } or null if mm is empty

import { INVEST_TC, INVEST_ES } from './orgmap-investments.js'

// Role classifiers — owner vs governance roles.
export const _isOwnerRole = rc => /member|shareholder|grantor|owner|partner/i.test(rc || '')
export const _isGovRole = rc => /trustee|manag|director|officer|chair|president|secretary|treasur|principal|governor/i.test(rc || '')

// Role-rank order for choosing the "primary" role to display on a governance node.
export const _ROLE_RANK = [
  'chairman', 'vice chairman', 'president', 'chief executive officer',
  'chief financial officer', 'chief operating officer', 'general counsel',
  'managing member', 'treasurer', 'secretary', 'vice president',
  'director', 'manager', 'trustee', 'officer',
]
export const _ROLE_ABBR = {
  'chief executive officer': 'CEO',
  'chief financial officer': 'CFO',
  'chief operating officer': 'COO',
  'general counsel': 'General Counsel',
}
export const _govPrimaryRole = roles => {
  const u = [...new Set((roles || []).filter(Boolean))]
  if (!u.length) return ''
  let best = u[0], bi = 999
  u.forEach(r => {
    const i = _ROLE_RANK.indexOf((r || '').toLowerCase())
    const ii = i < 0 ? 500 : i
    if (ii < bi) { bi = ii; best = r }
  })
  return _ROLE_ABBR[(best || '').toLowerCase()] || best
}

// Type-config descriptor — every node type gets a per-type entry for use by
// the renderer. Mirrors the legacy TC shape in client-dash for compatibility.
export const TC = {
  trust:        { color: '#7E22CE', bg: '#F5F3FF', icon: '◈', radius: 20, label: 'Trust' },
  entity:       { color: '#1E3A5F', bg: '#EFF6FF', icon: '◉', radius: 22, label: 'Entity' },
  property:     { color: '#059669', bg: '#F0FDFA', icon: '⌂', radius: 18, label: 'Property' },
  employee:     { color: '#D97706', bg: '#FFFBEB', icon: '◇', radius: 15, label: 'Employee' },
  person:       { color: '#D97706', bg: '#FFFBEB', icon: '◇', radius: 17, label: 'Person' },
  staff:        { color: '#D97706', bg: '#FFFBEB', icon: '◇', radius: 15, label: 'Chamber Staff' },
  board:        { color: '#D97706', bg: '#FFFBEB', icon: '⚖', radius: 15, label: 'Board' },
  compliance:   { color: '#B45309', bg: '#FFFBEB', icon: '▤', radius: 11, label: 'Compliance' },
  insurance:    { color: '#4F46E5', bg: '#EEF2FF', icon: '▢', radius: 14, label: 'Insurance' },
  owner:        { color: '#D97706', bg: '#FFFBEB', icon: '◇', radius: 14, label: 'Direct Owner' },
  govbody:      { color: '#475569', bg: '#F1F5F9', icon: '⚖', radius: 14, label: 'Governing Body' },
  dept:         { color: '#1E3A5F', bg: '#EFF6FF', icon: '▦', radius: 13, label: 'Department' },
  taxauthority: { color: '#475569', bg: '#F1F5F9', icon: '%', radius: 13, label: 'Tax Authority' },
  taxobl:       { color: '#475569', bg: '#F1F5F9', icon: '·', radius: 9,  label: 'Tax Obligation' },
  propitem:     { color: '#059669', bg: '#F0FDFA', icon: '·', radius: 9,  label: 'Property Item' },
  dilcat:       { color: '#7E22CE', bg: '#F5F3FF', icon: '◯', radius: 13, label: 'Workstream' },
  dilitem:      { color: '#7E22CE', bg: '#F5F3FF', icon: '·', radius: 9,  label: 'Diligence Item' },
  scorepillar:  { color: '#059669', bg: '#F0FDFA', icon: '◎', radius: 10, label: 'Score Pillar' },
}
Object.assign(TC, INVEST_TC)

// Edge-style descriptor — per relation kind.
export const ES = {
  owns:            { color: '#1E3A5F', dash: null,  label: 'Owns',          width: 2 },
  owns_property:   { color: '#059669', dash: null,  label: 'Owns property', width: 2 },
  employs:         { color: '#D97706', dash: '2,3', label: 'Employee',      width: 1.5 },
  requires:        { color: '#B45309', dash: '4,3', label: 'Compliance',    width: 1.2 },
  covered_by:      { color: '#4F46E5', dash: '6,3', label: 'Insurance',     width: 1.5 },
  governs:         { color: '#475569', dash: '3,3', label: 'Governance',    width: 1.2 },
  governs_body:    { color: '#475569', dash: null,  label: 'Governing body',width: 1.2 },
  governed_by:     { color: '#475569', dash: '3,3', label: 'Governed by',   width: 1.2 },
  tax_files:       { color: '#475569', dash: '4,3', label: 'Tax filing',    width: 1.2 },
  tax_obl:         { color: '#475569', dash: '2,3', label: 'Tax obligation',width: 1.0 },
  prop_item:       { color: '#059669', dash: '2,3', label: 'Property item', width: 1.0 },
  dil_cat:         { color: '#7E22CE', dash: '4,3', label: 'Workstream',    width: 1.2 },
  dil_item:        { color: '#7E22CE', dash: '2,3', label: 'Diligence item',width: 1.0 },
  score_pillar:    { color: '#059669', dash: '2,3', label: 'Score pillar',  width: 1.0 },
  chamber_staff:   { color: '#D97706', dash: '2,3', label: 'Chamber staff', width: 1.2 },
  hr_manages:      { color: '#1E3A5F', dash: '4,3', label: 'HR',            width: 1.2 },
}
Object.assign(ES, INVEST_ES)

// Type taxonomy — which types are spines (centers of clusters) vs leaves
// (orbit around their parent).
export const SPINE_TYPES = new Set(['entity', 'trust', 'property'])
export const SCORABLE = new Set(['entity', 'trust', 'property'])
export const LEAF_TYPES = new Set([
  'taxobl', 'propitem', 'dilitem', 'scorepillar',
])

// Filter taxonomy — which node types belong to which "domain lens" in the
// filter chip bar (Legal/Finance/Taxation/etc.).
export const DOMAIN_TYPES = {
  legal:      ['owner'],
  finance:    ['investment'],
  people:     ['employee', 'hr', 'person', 'staff', 'board', 'govbody', 'dept'],
  compliance: ['compliance'],
  risk:       ['insurance'],
  taxation:   ['taxauthority', 'taxobl'],
  property:   ['propitem'],
  diligence:  ['dilcat', 'dilitem'],
  score:      ['scorepillar'],
}

export const DOMAINS = [
  { k: 'legal',      l: 'Legal & Ownership', c: '#1E3A5F' },
  { k: 'finance',    l: 'Finance & Capital', c: '#0E7490' },
  { k: 'taxation',   l: 'Taxation',          c: '#7E22CE' },
  { k: 'property',   l: 'Property',          c: '#059669' },
  { k: 'people',     l: 'People',            c: '#D97706' },
  { k: 'compliance', l: 'Compliance',        c: '#B45309' },
  { k: 'risk',       l: 'Risk',              c: '#4F46E5' },
  { k: 'diligence',  l: 'Diligence',         c: '#7E22CE' },
  { k: 'score',      l: 'Start Score™',      c: '#059669' },
]

// Score band → color mapping. Pure function — no DB lookup. Callers can
// override by passing custom bands via OrgMap props later.
const DEFAULT_BANDS = [
  { grade: 'A', label: 'Excellent',    min: 90, max: 100, color: '#059669' },
  { grade: 'B', label: 'Compliant',    min: 80, max: 89,  color: '#059669' },
  { grade: 'C', label: 'Needs Review', min: 70, max: 79,  color: '#D97706' },
  { grade: 'D', label: 'At Risk',      min: 50, max: 69,  color: '#D97706' },
  { grade: 'F', label: 'Critical',     min: 0,  max: 49,  color: '#DC2626' },
]
export const scoreColor = (s, bands = DEFAULT_BANDS) => {
  if (s == null) return '#94A3B8'
  for (const b of bands) if (s >= b.min && s <= b.max) return b.color
  return '#94A3B8'
}
export const scoreGrade = (s, bands = DEFAULT_BANDS) => {
  if (s == null) return ''
  for (const b of bands) if (s >= b.min && s <= b.max) return b.grade
  return ''
}

// ─── Main transformer ────────────────────────────────────────────────────────
// Faithful port from client-dash ClientShell.js xfMindMapNodes. Builds nodes
// and links from the raw RPC payload. Same logic, same output shape.

export default function xfMindMapNodes(mm, bo, dept, tax, prop, dilv, scv) {
  if (!mm) return null
  const nodes = []
  const links = []
  const nodesByLabel = {}
  const addNode = (n) => { if (!nodesByLabel[n.label]) { nodes.push(n); nodesByLabel[n.label] = n } }

  // Entities + trusts
  ;(mm.entities || []).forEach(e => {
    addNode({
      id: e.id,
      owning_entity_id: e.owning_entity_id,
      label: e.label,
      type: e.legal_type === 'Trust' ? 'trust' : 'entity',
      start_score: parseFloat(e.start_score) || null,
      status: e.score_band ? (e.score_band.replace(/[🟢🟡🔴⚪]\s?/g, '')) : null,
      details: {
        legal_type: e.legal_type, domestic_state: e.domestic_state, ein: e.ein,
        formation_date: e.formation_date, dissolution_date: e.dissolution_date,
        state_file_number: e.state_file_number, good_standing: e.good_standing,
        tax_structure: e.tax_structure, accounting_basis: e.accounting_basis,
        fiscal_year_end: e.fiscal_year_end, tax_year_end: e.tax_year_end,
        naics: e.naics, sic: e.sic || '', s_election_effective: e.s_election_effective,
        client_org: e.client_org || '', next_annual_report_due: e.next_annual_report_due,
        dba_name: e.dba_name || '', duns: e.duns || '', ncci: e.ncci || '',
        business_activity_code: e.business_activity_code || '',
        registration_count: e.registration_count,
        registered_agent: e.registered_agent,
      },
    })
  })
  ;(mm.trusts || []).forEach(t => {
    const lbl = t.label || t.trust_name
    if (lbl) addNode({ id: t.id, label: lbl, type: 'trust', details: t })
  })

  // Properties
  ;(mm.properties || []).forEach(p => {
    const lbl = p.nick_name || p.address || 'Property'
    addNode({
      id: p.id, label: lbl, type: 'property',
      start_score: parseFloat(p.start_score) || null,
      details: {
        property_type: p.property_type, property_subtype: p.property_subtype,
        address: p.address, city: p.city, state: p.state, postal_code: p.postal_code,
        sqft: p.sqft, owning_entity: p.owning_entity,
        acquisition_date: p.acquisition_date, pin_apn: p.pin,
        occupancy: p.occupancy_status, risk_flags: p.risk_flags,
        reason_codes: p.reason_codes,
      },
    })
  })

  // Employees, chamber staff, governance board
  ;(mm.employees || []).forEach(e => {
    addNode({
      id: e.id, label: e.full_name, type: 'employee',
      details: { job_title: e.job_title, entity_name: e.entity_name,
        employment_type: e.employment_type, hire_date: e.hire_date },
    })
  })
  ;(mm.chamber_staff || []).forEach(s => {
    if (!s.full_name) return
    addNode({
      id: s.id || ('staff-' + (s.full_name || '').replace(/\s+/g, '-').toLowerCase()),
      label: s.full_name, type: 'staff',
      details: { job_title: s.job_title, email: s.email, phone: s.phone,
        photo_url: s.photo_url, is_executive: s.is_executive, entity_name: s.entity_name },
    })
  })
  ;(mm.governance || []).forEach(b => {
    if (!b.full_name) return
    addNode({
      id: b.id || ('board-' + (b.full_name || '').replace(/\s+/g, '-').toLowerCase()),
      label: b.full_name, type: 'board',
      details: { title_at_chamber: b.title_at_chamber, is_officer: b.is_officer,
        employer: b.employer, employer_title: b.employer_title,
        term_start: b.term_start, term_end: b.term_end, term_status: b.term_status,
        email: b.email, phone: b.phone, photo_url: b.photo_url, entity_name: b.entity_name },
    })
  })

  // Insurance — group by entity, render one node per policy
  ;(() => {
    const _insGrp = {}
    ;(mm.insurance || []).forEach(i => {
      const k = i.entity_name || '_'
      if (!_insGrp[k]) _insGrp[k] = []
      _insGrp[k].push(i)
    })
    ;(mm.insurance || []).forEach(i => {
      addNode({
        id: i.id || ('ins-' + Math.random().toString(36).slice(2, 8)),
        label: i.policy_type + (i.entity_name ? ' — ' + i.entity_name : ''),
        type: 'insurance',
        details: {
          policy_type: i.policy_type, policy_number: i.policy_number,
          carrier: i.carrier, status: i.status,
          effective: i.effective, expiration: i.expiration,
          entity_name: i.entity_name, coverage_limit: i.coverage_limit,
          broker: i.broker, annual_premium: i.annual_premium,
          insurance_policies: _insGrp[i.entity_name || '_'] || [],
        },
      })
    })
  })()

  // People as PER-ENTITY instances — governance & ownership read as
  // self-contained per-entity clusters with no cross-entity lines.
  const _govInst = {}, _ownInst = {}
  const _mkK = (e, n) => e + '|' + n
  ;(mm.ownership || []).forEach(o => {
    const nm = (o.owner_person_name || '').trim(), eid = o.entity_id
    if (!nm || !eid) return
    const rc = o.role_class || '', k = _mkK(eid, nm)
    const oi = _ownInst[k] || (_ownInst[k] = {
      entity_id: eid, name: nm, contact_id: o.contact_id || null,
      roles: [], pct: null, email: o.contact_email || '',
      phone: o.contact_phone || '', title: o.contact_title || '',
      contact_type: o.contact_type || 'Individual',
      security_class: o.security_class || '',
    })
    if (rc) oi.roles.push(rc)
    if (o.percent != null && oi.pct == null) oi.pct = o.percent
    if (rc && _isGovRole(rc)) {
      const g = _govInst[k] || (_govInst[k] = {
        entity_id: eid, name: nm, contact_id: o.contact_id || null, roles: [],
      })
      g.roles.push(rc)
    }
  })
  ;(mm.entity_roles || []).forEach(r => {
    const nm = (r.person_name || '').trim(), eid = r.entity_id
    if (!nm || !eid) return
    const rn = r.role_name || '', k = _mkK(eid, nm)
    const isOwn = _isOwnerRole(rn), isGov = _isGovRole(rn) || (rn && !isOwn)
    if (isGov) {
      const g = _govInst[k] || (_govInst[k] = {
        entity_id: eid, name: nm, contact_id: r.contact_id || null, roles: [],
      })
      if (rn) g.roles.push(rn)
    }
    if (isOwn) {
      const oi = _ownInst[k] || (_ownInst[k] = {
        entity_id: eid, name: nm, contact_id: r.contact_id || null, roles: [], pct: null,
      })
      if (rn) oi.roles.push(rn)
    }
  })

  // Materialize governance people as nodes wired straight to their entity
  ;(() => {
    const _bodyOf = (roles) => {
      const _r = (roles || []).join(' ').toLowerCase()
      if (/trustee/.test(_r)) return 'Trustees'
      if (/managing member|manager/.test(_r)) return 'Managers'
      if (/director|chair|board/.test(_r)) return 'Board'
      return 'Officers'
    }
    Object.values(_govInst).forEach(g => {
      const body = _bodyOf(g.roles)
      const bid = 'gbody-' + g.entity_id + '-' + body.toLowerCase()
      const pid = 'govp-' + g.entity_id + '-' + g.name.replace(/\s+/g, '-').toLowerCase()
      nodes.push({
        id: pid, label: g.name, type: 'person',
        details: {
          contact_id: g.contact_id, role_class: g.roles[0] || '', roles: g.roles,
          gov: true, _lens: 'governance', entity_id: g.entity_id, body, bodyId: bid,
          title: g.roles.join(' · '), contact_type: 'Individual',
        },
      })
      links.push({ source: pid, target: g.entity_id, label: '', weight: 0, relation: 'governs' })
    })
  })()

  // Beneficial owners (BO enrichment) → ownership-flavored person nodes
  if (bo && bo.length) {
    const _byEnt = {}
    bo.forEach(r => { const e = r.entity_id; if (!e) return; (_byEnt[e] = _byEnt[e] || []).push(r) })
    const _shortTrust = x => (x || '').replace(/^The\s+/i, '').replace(/^Bowie-Stardust\s+/i, '').trim()
    Object.entries(_byEnt).forEach(([eid, rows]) => {
      const seen = {}
      rows.forEach(r => {
        const nm = r.person_name || ''
        if (!nm) return
        const id = 'ownp-' + eid + '-' + nm.replace(/\s+/g, '-').toLowerCase()
        if (seen[id]) return
        seen[id] = 1
        const direct = r.basis === 'direct'
        const roleLabel = direct
          ? ((r.effective_pct != null ? Math.round(r.effective_pct) + '% · ' : '') + 'Direct')
          : ((r.basis ? r.basis.charAt(0).toUpperCase() + r.basis.slice(1) : 'Beneficial') + ' · via ' + _shortTrust(r.via_trust))
        nodes.push({
          id, label: nm, type: 'person',
          details: {
            contact_id: null, _lens: 'ownership', gov: false, entity_id: eid,
            basis: r.basis, via_trust: r.via_trust, effective_pct: r.effective_pct,
            trust_context_pct: r.trust_context_pct, boi_category: r.boi_category,
            present_interest: r.present_interest, can_revoke: r.can_revoke,
            is_25plus: r.is_25plus, ownRole: roleLabel, contact_type: 'Individual',
          },
        })
        links.push({
          source: id, target: eid,
          label: r.effective_pct != null ? Math.round(r.effective_pct) + '%' : '',
          weight: parseFloat(r.effective_pct) || 0, relation: 'owns', viaTrust: !direct,
        })
        if (direct) {
          const oid = 'lown-' + eid + '-' + nm.replace(/\s+/g, '-').toLowerCase()
          nodes.push({
            id: oid, label: nm, type: 'owner',
            details: { _lens: 'legal', entity_id: eid, pct: r.effective_pct, contact_type: 'Individual' },
          })
          links.push({
            source: oid, target: eid,
            label: r.effective_pct != null ? Math.round(r.effective_pct) + '%' : '',
            weight: parseFloat(r.effective_pct) || 0, relation: 'owns',
          })
        }
      })
    })
  }

  // Trusts referenced as owners but not in the trust list
  ;(mm.ownership || []).forEach(o => {
    const tn = (o.owner_trust_name || '').trim()
    if (tn && !nodesByLabel[tn]) {
      addNode({
        id: 'trust-' + tn.replace(/\s+/g, '-').toLowerCase(),
        label: tn, type: 'trust', details: {},
      })
    }
  })

  // Entity-to-entity / trust-to-entity ownership links
  ;(mm.ownership || []).forEach(o => {
    const srcName = (o.owner_entity_name || '').trim() || (o.owner_trust_name || '').trim()
    if (!srcName) return
    const srcNode = nodesByLabel[srcName]
    if (!srcNode) return
    let tgtNode = null
    let relation = 'owns'
    if (o.asset_type === 'property' && o.property_name) {
      tgtNode = nodesByLabel[o.property_name]
      relation = 'owns_property'
    } else if (o.entity_name) {
      if (o.entity_name !== srcName) tgtNode = nodesByLabel[o.entity_name]
    }
    if (!tgtNode) return
    if (srcNode.id === tgtNode.id) return
    links.push({
      source: srcNode.id, target: tgtNode.id,
      label: o.percent ? parseFloat(o.percent).toFixed(0) + '%' : '',
      weight: parseFloat(o.percent) || 0, relation,
    })
  })

  // Insurance → entity links
  ;(mm.insurance || []).forEach(i => {
    const entName = (i.entity_name || '').trim()
    const entNode = nodesByLabel[entName]
    const insLabel = i.policy_type + (i.entity_name ? ' — ' + i.entity_name : '')
    const insNode = nodesByLabel[insLabel]
    if (entNode && insNode && entNode.id !== insNode.id) {
      links.push({ source: entNode.id, target: insNode.id, label: '', weight: 0, relation: 'covered_by' })
    }
  })

  // Property → entity links
  ;(mm.properties || []).forEach(p => {
    const entName = (p.owning_entity || '').trim()
    const entNode = nodesByLabel[entName]
    const propLabel = p.nick_name || p.address || 'Property'
    const propNode = nodesByLabel[propLabel]
    if (entNode && propNode && entNode.id !== propNode.id) {
      links.push({ source: entNode.id, target: propNode.id, label: '', weight: 0, relation: 'owns_property' })
    }
  })

  // Employee → entity links
  ;(mm.employees || []).forEach(e => {
    const entName = (e.entity_name || '').trim()
    const entNode = nodesByLabel[entName]
    const empNode = nodesByLabel[e.full_name]
    if (entNode && empNode && entNode.id !== empNode.id) {
      links.push({ source: entNode.id, target: empNode.id, label: '', weight: 0, relation: 'employs' })
    }
  })

  // Chamber staff + board → entity links
  ;(mm.chamber_staff || []).forEach(s => {
    const entName = (s.entity_name || '').trim()
    const entNode = nodesByLabel[entName]
    const stNode = nodesByLabel[s.full_name]
    if (entNode && stNode && entNode.id !== stNode.id) {
      links.push({ source: entNode.id, target: stNode.id, label: '', weight: 0, relation: 'chamber_staff' })
    }
  })
  ;(mm.governance || []).forEach(b => {
    const entName = (b.entity_name || '').trim()
    const entNode = nodesByLabel[entName]
    const bdNode = nodesByLabel[b.full_name]
    if (entNode && bdNode && entNode.id !== bdNode.id) {
      links.push({
        source: entNode.id, target: bdNode.id,
        label: b.title_at_chamber || 'Director', weight: 0, relation: 'governed_by',
      })
    }
  })

  // Compliance aggregate nodes (one per entity)
  const compByEnt = {}
  const cleanLabel = (s) => s ? s.replace(/^["\s]+|["\s]+$/g, '').trim() : ''
  ;(mm.compliance || []).forEach(c => {
    const eName = cleanLabel(c.entity_name)
    if (!eName) return
    if (!compByEnt[eName]) compByEnt[eName] = { total: 0, open: 0, overdue: 0, items: [] }
    compByEnt[eName].total++
    if (c.status === 'Open' || c.status === 'Pending') compByEnt[eName].open++
    if (c.status === 'Overdue' ||
        (c.due_date && new Date(c.due_date) < new Date() &&
         c.status !== 'Filed' && c.status !== 'Closed' && c.status !== 'Expired')) {
      compByEnt[eName].overdue++
    }
    compByEnt[eName].items.push(c)
  })
  Object.entries(compByEnt).forEach(([eName, data]) => {
    const entNode = nodesByLabel[eName]
    if (!entNode) return
    const label = data.overdue > 0
      ? data.total + ' items (' + data.overdue + ' overdue)'
      : data.total + ' items'
    const compId = 'comp-' + entNode.id
    const compNode = {
      id: compId, label, type: 'compliance', start_score: null,
      status: data.overdue > 0 ? 'At Risk' : data.open > 0 ? 'Needs Review' : 'Compliant',
      details: { entity_name: eName, total: data.total, open: data.open,
        overdue: data.overdue, items: data.items },
    }
    nodes.push(compNode)
    nodesByLabel[label] = compNode
    links.push({ source: entNode.id, target: compId, label: '', weight: 0, relation: 'requires' })
  })

  // HR per-entity employee nodes with department rollup context
  const empByEnt = {}
  ;(mm.employees || []).forEach(e => {
    const eName = (e.entity_name || '').trim()
    if (!eName) return
    if (!empByEnt[eName]) empByEnt[eName] = []
    empByEnt[eName].push(e)
  })
  const _empDeptOf = {}
  ;(dept || []).forEach(d => {
    (d.members || []).forEach(mb => {
      if (mb && mb.name) {
        _empDeptOf[(d.entity_id || '') + '|' + mb.name.trim().toLowerCase()] = d.department_name || ''
      }
    })
  })
  Object.entries(empByEnt).forEach(([eName, emps]) => {
    const entNode = nodesByLabel[eName]
    if (!entNode) return
    emps.forEach(e => {
      const _enm = (e.full_name || '').trim()
      if (!_enm) return
      const epid = 'emp-' + entNode.id + '-' + _enm.replace(/\s+/g, '-').toLowerCase()
      const _dn = _empDeptOf[entNode.id + '|' + _enm.toLowerCase()] || ''
      nodes.push({
        id: epid, label: _enm, type: 'person',
        details: {
          _lens: 'employees', gov: false, entity_id: entNode.id, entity_name: eName,
          title: e.job_title || '', hire_date: e.hire_date || '',
          employment_type: e.employment_type || '', department_name: _dn,
          empRole: (e.job_title || 'Staff') + (_dn ? ' · ' + _dn : ''),
          contact_type: 'Individual',
        },
      })
      links.push({ source: entNode.id, target: epid, label: '', weight: 0, relation: 'employs' })
    })
  })

  // Taxation tier — entity → tax authority → obligation
  if (tax && tax.length) {
    tax.forEach(t => {
      const eid = t.entity_id
      if (!eid) return
      const _buck = { Federal: [], State: [] }
      ;(t.authorities || []).forEach(au => {
        const _b = (au.auth_code === 'IRS') ? 'Federal' : 'State'
        ;(au.items || []).forEach(it => {
          _buck[_b].push(Object.assign({}, it, { authority: au.authority, auth_code: au.auth_code }))
        })
      })
      ;['Federal', 'State'].forEach(jur => {
        const _items = _buck[jur]
        if (!_items.length) return
        const _ov = _items.filter(x => x.status === 'Overdue').length
        const _ds = _items.filter(x => x.status === 'Due Soon').length
        const aid = 'taxauth-' + eid + '-' + jur
        nodes.push({
          id: aid, label: jur, type: 'taxauthority',
          details: {
            _lens: 'taxation', entity_id: eid, entity_name: t.entity_name,
            authority: jur + ' authorities', jurisdiction: jur,
            overdue: _ov, due_soon: _ds, total: _items.length,
            count: _items.length, items: _items,
          },
        })
        links.push({ source: eid, target: aid, label: '', weight: 0, relation: 'tax_files' })
        _items.forEach((it, ii) => {
          const _st = (it.status === 'Overdue') ? 'overdue' :
                      (it.status === 'Due Soon') ? 'due' :
                      (/flow/i.test(it.status || '')) ? 'flow' : 'current'
          const oid = 'taxobl-' + aid + '-' + ii
          nodes.push({
            id: oid, label: (it.tax_type || 'Filing'), type: 'taxobl',
            details: {
              _lens: 'taxation', entity_id: eid, entity_name: t.entity_name, bodyId: aid,
              authority: it.authority, auth_code: it.auth_code,
              tax_type: it.tax_type, form: it.form, frequency: it.frequency,
              next_due: it.next_due, status: it.status, _status: _st,
              registration_id: it.registration_id, face: it.face,
              has_registration: it.has_registration, contact_type: 'Filing',
            },
          })
          links.push({ source: aid, target: oid, label: '', weight: 0, relation: 'tax_obl' })
        })
      })
    })
  }

  // Property items
  if (prop && prop.length) {
    prop.forEach(pp => {
      const pid = pp.property_id
      if (!pid) return
      ;(pp.items || []).forEach((it, ii) => {
        const _st = (it.status === 'Overdue') ? 'overdue' :
                    (it.status === 'Due Soon') ? 'due' :
                    (it.status === 'Info') ? 'flow' : 'current'
        const oid = 'propitem-' + pid + '-' + ii
        nodes.push({
          id: oid, label: (it.label || 'Item'), type: 'propitem',
          details: {
            _lens: 'property', property_id: pid,
            property_name: pp.property_name, owner_entity: pp.owner_entity,
            bodyId: pid, category: it.category, label: it.label,
            sublabel: it.sublabel, status: it.status, _status: _st,
            color: it.color, face: it.face, contact_type: 'Property',
          },
        })
        links.push({ source: pid, target: oid, label: '', weight: 0, relation: 'prop_item' })
      })
    })
  }

  // Diligence categories + items
  if (dilv && dilv.length) {
    dilv.forEach(tg => {
      const eid = tg.entity_id
      if (!eid) return
      ;(tg.categories || []).forEach(cc => {
        const cid = 'dilcat-' + eid + '-' + (cc.code || '').replace(/[^A-Za-z0-9]/g, '')
        nodes.push({
          id: cid, label: (cc.code || cc.category), type: 'dilcat',
          details: {
            _lens: 'diligence', entity_id: eid, entity_name: tg.entity_name,
            category: cc.category, code: cc.code,
            r_done: cc.r_done, r_total: cc.r_total,
            overdue: cc.overdue, due_soon: cc.due_soon,
            count: (cc.items || []).length, items: cc.items || [],
            deal_name: tg.deal_name,
          },
        })
        links.push({ source: eid, target: cid, label: '', weight: 0, relation: 'dil_cat' })
        ;(cc.items || []).forEach((it, ii) => {
          const _st = (it.status === 'Overdue') ? 'overdue' :
                      (it.status === 'Due Soon') ? 'due' :
                      (it.status === 'Info') ? 'flow' : 'current'
          const oid = 'dilitem-' + cid + '-' + ii
          nodes.push({
            id: oid, label: (it.label || 'Item'), type: 'dilitem',
            details: {
              _lens: 'diligence', entity_id: eid, entity_name: tg.entity_name,
              deal_name: tg.deal_name, bodyId: cid, category: cc.category,
              face: it.face, label: it.label, sublabel: it.sublabel,
              status: it.status, _status: _st, contact_type: 'Diligence',
            },
          })
          links.push({ source: cid, target: oid, label: '', weight: 0, relation: 'dil_item' })
        })
      })
    })
  }

  // Start Score™ pillar nodes
  if (scv && scv.length) {
    scv.forEach(sc => {
      const eid = sc.entity_id
      if (!eid) return
      ;(sc.pillars || []).forEach((pp, ii) => {
        const oid = 'scorepillar-' + eid + '-' + ii
        nodes.push({
          id: oid, label: pp.pillar_name || pp.code || 'Pillar',
          type: 'scorepillar',
          details: {
            _lens: 'score', entity_id: eid, entity_name: sc.entity_name,
            pillar: pp.pillar_name, code: pp.code, weight: pp.weight,
            score: pp.score, status: pp.status,
          },
        })
        links.push({ source: eid, target: oid, label: '', weight: 0, relation: 'score_pillar' })
      })
    })
  }

  return { nodes, links }
}

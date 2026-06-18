// orgmap-investments.js — bridge model for Investment nodes in the OrgMap.
// Every investment row becomes a ◆ node anchored by entity ID:
//   investor_entity_id ──invests/invests_pending──► ◆  ──stake_in──► target_entity_id
// ◆ is terminal when the target is external (target_entity_id absent from nodeIds).
// ◆ nodes carry no start_score.
//
// Wiring (in ClientShell OrgMap fd construction):
//   import { INVEST_TC, INVEST_ES, buildInvestmentBridge } from "@/app/components/ownership-capital/orgmap-investments";
//   const TC = { ...EXISTING_TC, ...INVEST_TC };
//   const ES = { ...EXISTING_ES, ...INVEST_ES };
//   const nodeIds = new Set(base.nodes.map(n => n.id));
//   const ig = buildInvestmentBridge(investments, nodeIds);
//   fd.nodes.push(...ig.nodes); fd.links.push(...ig.links);

// Investment node type — Finance teal, distinct glyph from entity/trust/individual.
// Keys mirror the OrgMap TC shape: { color, bg, icon, radius, label }.
export const INVEST_TC = {
  investment: { color: '#0E7490', bg: '#ECFEFF', icon: '◆', radius: 14, label: 'Investments' },
};

// Edge types. Pending convertible renders dashed; settled renders solid; stake_in
// is the second hop of the bridge (◆ → investee entity).
export const INVEST_ES = {
  invests:         { color: '#0E7490', dash: null,  label: 'Investment' },
  invests_pending: { color: '#0E7490', dash: '7,6', label: 'Pending conversion' },
  stake_in:        { color: '#0E7490', dash: null,  label: 'Stake' },
};

const PENDING_INSTR = new Set(['safe', 'convertible_note']);

// investments: rows from get_investments.
// nodeIds: Set of entity node IDs currently in the graph — used to anchor
// holder→◆ and to gate the ◆→investee stake_in edge (external = terminal).
export function buildInvestmentBridge(investments = [], nodeIds = new Set()) {
  const nodes = [];
  const links = [];
  for (const iv of investments) {
    if (!iv.id) continue;
    if (iv.direction === 'inbound') continue;
    const id = `inv:${iv.id}`;
    const pending = PENDING_INSTR.has(iv.instrument_type) && iv.status !== 'converted';

    // ◆ bridge node — no start_score
    nodes.push({
      id,
      type: 'investment',
      label: iv.target || iv.investor || 'Investment',
      sublabel: instrumentLabel(iv.instrument_type),
      instrument_type: iv.instrument_type,
      direction: iv.direction,
      status: iv.status,
      verification_status: iv.verification_status,
      committed_amount: iv.committed_amount,
      funded_amount: iv.funded_amount,
      pending,
      start_score: null,
      details: { close_date: iv.close_date, term_sheet_date: iv.term_sheet_date, maturity_date: iv.maturity_date },
      raw: iv,
    });

    // holder → ◆ : anchor by entity ID, skip if investor not in graph (incl. inbound/external)
    const holderId = iv.investor_entity_id || null;
    if (holderId && nodeIds.has(holderId)) {
      links.push({ source: holderId, target: id, relation: pending ? 'invests_pending' : 'invests' });
    }

    // ◆ → investee (stake_in) — only when target is an internal entity
    const investeeId = iv.target_entity_id || null;
    if (investeeId && nodeIds.has(investeeId)) {
      links.push({ source: id, target: investeeId, relation: 'stake_in' });
    }
    // external investee: ◆ is terminal — no stake_in link emitted
  }
  return { nodes, links };
}

export function instrumentLabel(t) {
  return ({
    safe: 'SAFE',
    convertible_note: 'Convertible note',
    priced_equity: 'Priced equity',
    lp_commitment: 'LP commitment',
    warrant: 'Warrant',
    option: 'Option',
    founding_stake: 'Founding stake (IP)',
    cps: 'Convertible preferred',
    convertible_equity: 'Convertible + equity',
  })[t] || 'Investment';
}

// Quick-action menu items for an investment node (hover menu on the map).
export function investmentNodeActions(node) {
  return [
    { key: 'open',   label: 'Open detail' },
    { key: 'verify', label: 'Run verification' },
    { key: 'terms',  label: 'View terms' },
    ...(PENDING_INSTR.has(node.instrument_type) ? [{ key: 'tranches', label: 'Show tranches' }] : []),
  ];
}

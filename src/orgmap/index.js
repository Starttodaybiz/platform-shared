// @start-today/platform-shared/orgmap
//
// Canonical OrgMap™ visualization for the Start Today ecosystem.

export { default as OrgMap } from './OrgMap.jsx'
export { default as xfMindMapNodes } from './xfMindMapNodes.js'
export {
  TC, ES,
  SPINE_TYPES, SCORABLE, LEAF_TYPES,
  DOMAIN_TYPES, DOMAINS,
  scoreColor, scoreGrade,
  _isOwnerRole, _isGovRole, _govPrimaryRole,
} from './xfMindMapNodes.js'
export {
  INVEST_TC, INVEST_ES,
  buildInvestmentBridge,
  instrumentLabel,
  investmentNodeActions,
} from './orgmap-investments.js'
export {
  CHROME, NODE_HUE, NODE_STYLE, EDGE_STYLE,
  DEFAULT_TOKENS, mergeTokens,
} from './tokens.js'

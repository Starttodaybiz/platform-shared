'use client'
// ============================================================================
// OrgMap™ — canonical d3 force-directed organization map for the Start Today
// ecosystem. Phase 1 of @start-today/platform-shared.
//
// VISUAL IDENTITY (matches client-dashboard's inline version):
//   • d3.forceSimulation with link/charge/center/collision/edge-offset forces
//   • Type-coded nodes (entity/trust/property/insurance/loan/UCC/person/etc.)
//   • Curved quadratic edges with arrow markers + flow animation
//   • Score badges (A/B/C/D/F) overlaid on scorable nodes
//   • Provenance rings (STVerified ✓ / authoritative / document / asserted)
//   • Click a node → highlight its neighborhood, dim everything else
//   • Pan + zoom + drag with d3.zoom
//   • Detail panel — built-in basic version; consumer can override via
//     `renderNodeDetail` prop for rich panels
//
// FEATURE FLAGS (Phase 2 — not yet wired):
//   carlLensEnabled — AI sidebar that drives the map by natural-language query
//   tourEnabled     — cinematic walkthrough with CARL-authored narration
//   timeLapseEnabled — structure-formation playback in chronological order
//   voiceEnabled    — mic capture → SpeechRecognition → CARL command
//
// CONSUMER:
//   import { OrgMap, xfMindMapNodes } from '@start-today/platform-shared/orgmap'
//   const fd = useMemo(() => xfMindMapNodes(rpcResult), [rpcResult])
//   return <OrgMap fd={fd} onNodeClick={...} renderNodeDetail={...} />
// ============================================================================

import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import * as d3 from 'd3'
import { mergeTokens, DEFAULT_TOKENS } from './tokens.js'
import { scoreColor, scoreGrade, SPINE_TYPES, LEAF_TYPES } from './xfMindMapNodes.js'

// ─── small util ──────────────────────────────────────────────────────────────
const isLeaf = (t) => LEAF_TYPES.has(t)
const isSpine = (t) => SPINE_TYPES.has(t)

// Default detail panel — consumer can override via renderNodeDetail prop.
function DefaultNodeDetail({ node, tokens }) {
  if (!node) return null
  const { chrome, nodeStyle } = tokens
  const ns = nodeStyle[node.type] || nodeStyle.entity
  const d = node.details || {}
  const rows = Object.entries(d)
    .filter(([k, v]) => v != null && v !== '' && typeof v !== 'object')
    .slice(0, 12)
  return (
    <div style={{
      padding: 14,
      fontSize: 12,
      fontFamily: tokens.fontSans,
      color: chrome.text,
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 99, background: ns.fill,
          color: '#fff', display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 700, fontSize: 13,
        }}>{ns.icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{node.label}</div>
          <div style={{ fontSize: 10, color: chrome.muted, textTransform: 'uppercase', letterSpacing: '.05em' }}>
            {ns.label}
          </div>
        </div>
      </div>
      {node.start_score != null && (
        <div style={{
          display: 'inline-block', marginBottom: 10, padding: '3px 8px',
          background: scoreColor(node.start_score), color: '#fff',
          borderRadius: 4, fontSize: 11, fontWeight: 700,
        }}>
          Start Score™ {Math.round(node.start_score)} · {scoreGrade(node.start_score)}
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rows.map(([k, v]) => (
          <div key={k} style={{
            display: 'flex', justifyContent: 'space-between', gap: 12, padding: '4px 0',
            borderBottom: `1px solid ${chrome.border}`,
          }}>
            <span style={{ color: chrome.muted, fontSize: 10, textTransform: 'capitalize' }}>
              {k.replace(/_/g, ' ')}
            </span>
            <span style={{ fontWeight: 500, fontSize: 11, textAlign: 'right' }}>{String(v)}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ color: chrome.muted, fontSize: 11, fontStyle: 'italic' }}>
            No additional details for this node.
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function OrgMap({
  // Data — pass the output of xfMindMapNodes(rpc, ...) as `fd`
  fd = null,
  // Visual customization (defaults from tokens.js)
  brandTokens = null,
  // Sizing
  height = '640px',
  // Interactions
  onNodeClick = null,
  renderNodeDetail = null,
  // Phase 2 feature flags — accepted now so consumers can pass them without
  // breaking when the plugins ship.
  carlLensEnabled: _carlLens = false,
  tourEnabled: _tour = false,
  timeLapseEnabled: _timeLapse = false,
  voiceEnabled: _voice = false,
  onCarlAsk: _onCarlAsk = null,
  // Loading state
  loading = false,
  emptyMessage = 'Pick a target to render its organization map.',
}) {
  const tokens = useMemo(() => mergeTokens(brandTokens), [brandTokens])
  const { chrome, nodeStyle, edgeStyle, fontSans } = tokens

  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const simRef = useRef(null)
  const zoomRef = useRef(null)
  const [selectedNode, setSelectedNode] = useState(null)
  const [hoverNode, setHoverNode] = useState(null)
  const [zoomLevel, setZoomLevel] = useState(1)

  // d3 effect — runs whenever the graph data changes
  useEffect(() => {
    if (!svgRef.current || !fd || !fd.nodes || fd.nodes.length === 0) return
    const svgEl = svgRef.current
    const W = svgEl.clientWidth
    const H = svgEl.clientHeight
    if (W === 0 || H === 0) return

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove() // clean re-render on data change

    // ─── arrow markers (one per relation, normal + highlighted + dimmed) ──
    const defs = svg.append('defs')
    const relationKinds = new Set(fd.links.map(l => l.relation))
    relationKinds.forEach(rel => {
      const es = edgeStyle[rel] || edgeStyle.default
      ;['', '-hi', '-dim'].forEach(suffix => {
        const opacity = suffix === '-dim' ? 0.15 : 1
        defs.append('marker')
          .attr('id', `a-${rel}${suffix}`)
          .attr('viewBox', '0 -5 10 10')
          .attr('refX', 8)
          .attr('refY', 0)
          .attr('markerWidth', 6)
          .attr('markerHeight', 6)
          .attr('orient', 'auto')
          .append('path')
          .attr('d', 'M0,-4L8,0L0,4')
          .attr('fill', es.color)
          .attr('opacity', opacity)
      })
    })

    // Wrap everything in a zoomable group
    const g = svg.append('g').attr('class', 'orgmap-zoom-root')

    // ─── shadow nodes for the d3 simulation (separate from React state) ──
    const simNodes = fd.nodes.map(n => ({
      ...n,
      __r: (nodeStyle[n.type] || nodeStyle.entity).radius,
    }))
    const byId = {}
    simNodes.forEach(n => { byId[n.id] = n })
    const simLinks = fd.links
      .map(l => ({
        ...l,
        source: typeof l.source === 'string' ? byId[l.source] : l.source,
        target: typeof l.target === 'string' ? byId[l.target] : l.target,
      }))
      .filter(l => l.source && l.target)

    // ─── force simulation — same force mix as client-dash, slightly simplified ──
    const sim = d3.forceSimulation(simNodes)
      .velocityDecay(0.55)
      .alphaDecay(0.04)
      .force('link', d3.forceLink(simLinks)
        .id(d => d.id)
        .distance(l => {
          const sLeaf = l.source.type && isLeaf(l.source.type)
          const tLeaf = l.target.type && isLeaf(l.target.type)
          if (sLeaf || tLeaf) return 75
          return 130
        })
        .strength(0.7))
      .force('charge', d3.forceManyBody().strength(d =>
        isSpine(d.type) ? -650 : -300
      ))
      .force('center', d3.forceCenter(W / 2, H / 2))
      .force('collision', d3.forceCollide()
        .radius(d => {
          const baseR = (d.__r || 14) + 28
          const labelW = (Math.min((d.label || '').length, 22) * 5.8 + 22) / 2 + 22
          return Math.max(baseR, labelW)
        })
        .strength(0.9)
        .iterations(2))
      .force('x', d3.forceX(W / 2).strength(0.04))
      .force('y', d3.forceY(H / 2).strength(0.04))

    simRef.current = sim

    // ─── links ─────────────────────────────────────────────────────────────
    const linkLayer = g.append('g').attr('class', 'orgmap-links')

    const lnk = linkLayer.selectAll('path.link')
      .data(simLinks)
      .join('path')
      .attr('class', 'link')
      .attr('fill', 'none')
      .attr('stroke', d => (edgeStyle[d.relation] || edgeStyle.default).color)
      .attr('stroke-width', d => (edgeStyle[d.relation] || edgeStyle.default).width)
      .attr('stroke-dasharray', d => (edgeStyle[d.relation] || edgeStyle.default).dash || null)
      .attr('stroke-opacity', 0.55)
      .attr('marker-end', d => `url(#a-${d.relation})`)

    // edge labels (just for high-weight links to keep readable)
    const linkLabel = linkLayer.selectAll('text.linklabel')
      .data(simLinks.filter(l => l.label))
      .join('text')
      .attr('class', 'linklabel')
      .attr('font-size', 9)
      .attr('font-family', fontSans)
      .attr('fill', chrome.muted)
      .attr('text-anchor', 'middle')
      .attr('pointer-events', 'none')
      .text(d => d.label)

    // ─── nodes ─────────────────────────────────────────────────────────────
    const nodeLayer = g.append('g').attr('class', 'orgmap-nodes')

    const nd = nodeLayer.selectAll('g.node')
      .data(simNodes, d => d.id)
      .join('g')
      .attr('class', 'node')
      .attr('cursor', 'pointer')
      .call(d3.drag()
        .on('start', (e, d) => {
          if (!e.active) sim.alphaTarget(0.3).restart()
          d.fx = d.x; d.fy = d.y
        })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y })
        .on('end', (e, d) => {
          if (!e.active) sim.alphaTarget(0)
          // Pin spines in place, let leaves float free
          if (isSpine(d.type)) { d.fx = d.x; d.fy = d.y }
          else { d.fx = null; d.fy = null }
        }))

    // Provenance ring (small indicator at top-left of each node)
    nd.filter(d => d.__rung && d.__rung !== 'none').each(function (d) {
      const s = d3.select(this)
      const offset = -(d.__r || 14) * 0.72
      const ring = s.append('g').attr('transform', `translate(${offset},${offset})`)
      if (d.__rung === 'stverified') {
        ring.append('circle').attr('r', 7).attr('fill', chrome.emerald)
          .attr('stroke', '#fff').attr('stroke-width', 1.5)
        ring.append('path').attr('d', 'M -3 0 L -1 2 L 3 -2.6')
          .attr('fill', 'none').attr('stroke', '#fff').attr('stroke-width', 1.4)
          .attr('stroke-linecap', 'round').attr('stroke-linejoin', 'round')
      } else {
        const fill = d.__rung === 'authoritative' ? chrome.emerald
                   : d.__rung === 'document' ? chrome.amber
                   : chrome.border2
        ring.append('circle').attr('r', 6).attr('fill', fill)
          .attr('stroke', '#fff').attr('stroke-width', 1.5)
      }
      ring.append('title').text(`Provenance: ${d.__rung}`)
    })

    // Main node circle
    nd.append('circle')
      .attr('r', d => d.__r || 14)
      .attr('fill', d => (nodeStyle[d.type] || nodeStyle.entity).fill)
      .attr('stroke', d => (nodeStyle[d.type] || nodeStyle.entity).stroke)
      .attr('stroke-width', 2)

    // Node icon glyph (centered)
    nd.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', d => (d.__r || 14) * 0.75)
      .attr('fill', '#fff')
      .attr('font-weight', 700)
      .attr('pointer-events', 'none')
      .text(d => (nodeStyle[d.type] || nodeStyle.entity).icon)

    // Score badge (top-right corner)
    nd.filter(d => d.start_score != null).each(function (d) {
      const s = d3.select(this)
      const x = (d.__r || 14) * 0.7
      const y = -(d.__r || 14) * 0.7
      s.append('circle')
        .attr('cx', x).attr('cy', y).attr('r', 8)
        .attr('fill', scoreColor(d.start_score))
        .attr('stroke', '#fff').attr('stroke-width', 1.5)
      s.append('text')
        .attr('x', x).attr('y', y)
        .attr('text-anchor', 'middle').attr('dy', '0.35em')
        .attr('font-size', 7).attr('fill', '#fff').attr('font-weight', 700)
        .attr('pointer-events', 'none')
        .text(scoreGrade(d.start_score))
    })

    // Label below
    nd.append('text')
      .attr('class', 'nlbl')
      .attr('text-anchor', 'middle')
      .attr('dy', d => (d.__r || 14) + 12)
      .attr('font-size', 10)
      .attr('font-family', fontSans)
      .attr('font-weight', 600)
      .attr('fill', chrome.text)
      .attr('pointer-events', 'none')
      .text(d => {
        const l = d.label || ''
        return l.length > 22 ? l.slice(0, 21) + '…' : l
      })

    // Click + hover interactions
    nd.on('click', (e, d) => {
      e.stopPropagation()
      setSelectedNode(d)
      onNodeClick && onNodeClick(d)
      // Highlight neighborhood
      const active = new Set([d.id])
      simLinks.forEach(l => {
        const s = l.source.id || l.source
        const t = l.target.id || l.target
        if (s === d.id) active.add(t)
        if (t === d.id) active.add(s)
      })
      nd.transition().duration(180).style('opacity', n => active.has(n.id) ? 1 : 0.18)
      lnk.transition().duration(180)
        .attr('stroke-opacity', l => {
          const s = l.source.id || l.source
          const t = l.target.id || l.target
          return active.has(s) || active.has(t) ? 0.85 : 0.08
        })
        .attr('marker-end', l => {
          const s = l.source.id || l.source
          const t = l.target.id || l.target
          const isOn = active.has(s) || active.has(t)
          return `url(#a-${l.relation}${isOn ? '-hi' : '-dim'})`
        })
      linkLabel.transition().duration(180).attr('opacity', l => {
        const s = l.source.id || l.source
        const t = l.target.id || l.target
        return active.has(s) || active.has(t) ? 1 : 0.1
      })
    })

    nd.on('mouseenter', (e, d) => setHoverNode(d))
    nd.on('mouseleave', () => setHoverNode(null))

    // Background click clears the highlight
    svg.on('click', () => {
      setSelectedNode(null)
      nd.transition().duration(180).style('opacity', 1)
      lnk.transition().duration(180)
        .attr('stroke-opacity', 0.55)
        .attr('marker-end', l => `url(#a-${l.relation})`)
      linkLabel.transition().duration(180).attr('opacity', 1)
    })

    // ─── zoom + pan ────────────────────────────────────────────────────────
    const zoom = d3.zoom()
      .scaleExtent([0.2, 4])
      .filter(e => {
        if (e.type === 'dblclick') return false
        return true
      })
      .on('zoom', e => {
        g.attr('transform', e.transform)
        setZoomLevel(e.transform.k)
      })
    svg.call(zoom)
    zoomRef.current = zoom

    // ─── tick — render curved edges + node positions ──────────────────────
    sim.on('tick', () => {
      lnk.attr('d', d => {
        const dx = d.target.x - d.source.x
        const dy = d.target.y - d.source.y
        const dist = Math.hypot(dx, dy) || 1
        const ux = dx / dist, uy = dy / dist
        const sr = (d.source.__r || 14) + 6
        const tr = (d.target.__r || 14) + 8
        const sx = d.source.x + ux * sr
        const sy = d.source.y + uy * sr
        const ex = d.target.x - ux * tr
        const ey = d.target.y - uy * tr
        const off = Math.min(dist * 0.12, 45)
        const cx = (sx + ex) / 2 - uy * off
        const cy = (sy + ey) / 2 + ux * off
        d.__mx = 0.25 * sx + 0.5 * cx + 0.25 * ex
        d.__my = 0.25 * sy + 0.5 * cy + 0.25 * ey
        return `M${sx},${sy}Q${cx},${cy} ${ex},${ey}`
      })
      linkLabel
        .attr('x', d => d.__mx ?? (d.source.x + d.target.x) / 2)
        .attr('y', d => d.__my ?? (d.source.y + d.target.y) / 2)
      nd.attr('transform', d => `translate(${d.x},${d.y})`)
    })

    // ─── fit-to-screen once layout settles ────────────────────────────────
    let fitTimer = setTimeout(() => {
      try {
        const root = g.node()
        if (!root) return
        const bb = root.getBBox()
        if (bb.width > 0 && bb.height > 0) {
          const scale = Math.min(W / (bb.width + 120), H / (bb.height + 120), 1.0)
          const tx = W / 2 - (bb.x + bb.width / 2) * scale
          const ty = H / 2 - (bb.y + bb.height / 2) * scale
          svg.transition().duration(750)
            .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale))
        }
      } catch (_) { /* getBBox can throw if detached */ }
    }, 900)

    return () => {
      clearTimeout(fitTimer)
      sim.stop()
    }
  }, [fd, nodeStyle, edgeStyle, chrome, fontSans, onNodeClick])

  // ─── zoom button controls ──────────────────────────────────────────────
  const zoomBy = useCallback((factor) => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(200)
      .call(zoomRef.current.scaleBy, factor)
  }, [])
  const resetZoom = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return
    d3.select(svgRef.current).transition().duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity)
  }, [])

  // ─── render ────────────────────────────────────────────────────────────
  const totalNodes = fd?.nodes?.length || 0
  const nodeTypes = useMemo(() => {
    if (!fd?.nodes) return []
    const counts = {}
    fd.nodes.forEach(n => { counts[n.type] = (counts[n.type] || 0) + 1 })
    return Object.entries(counts)
      .map(([t, c]) => ({ type: t, count: c, style: nodeStyle[t] || nodeStyle.entity }))
      .sort((a, b) => b.count - a.count)
  }, [fd, nodeStyle])

  return (
    <div
      ref={containerRef}
      style={{
        display: 'grid',
        gridTemplateColumns: selectedNode ? '1fr 320px' : '1fr',
        gap: 12,
        height,
        fontFamily: fontSans,
        color: chrome.text,
      }}
    >
      {/* ─── Map surface ─── */}
      <div style={{
        position: 'relative',
        background: chrome.white,
        border: `1px solid ${chrome.border}`,
        borderRadius: 10,
        overflow: 'hidden',
      }}>
        {loading && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(255,255,255,0.7)', zIndex: 5,
            color: chrome.muted, fontSize: 12,
          }}>Loading map…</div>
        )}

        {!fd || totalNodes === 0 ? (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: chrome.muted, fontSize: 12,
          }}>{emptyMessage}</div>
        ) : (
          <svg
            ref={svgRef}
            style={{ width: '100%', height: '100%', display: 'block', background: chrome.bg }}
          />
        )}

        {/* Zoom controls (top-right) */}
        <div style={{
          position: 'absolute', top: 12, right: 12,
          display: 'flex', flexDirection: 'column', gap: 4,
          background: chrome.white, border: `1px solid ${chrome.border}`,
          borderRadius: 7, padding: 4, boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        }}>
          <button onClick={() => zoomBy(1.4)} title="Zoom in" style={zBtn(chrome)}>+</button>
          <button onClick={() => zoomBy(0.7)} title="Zoom out" style={zBtn(chrome)}>−</button>
          <button onClick={resetZoom} title="Reset view" style={zBtn(chrome)}>⊙</button>
        </div>

        {/* Legend strip (bottom-left) */}
        {nodeTypes.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 12, left: 12,
            display: 'flex', gap: 12, flexWrap: 'wrap',
            background: chrome.white, border: `1px solid ${chrome.border}`,
            borderRadius: 7, padding: '7px 11px',
            fontSize: 10, color: chrome.textSec,
            maxWidth: 'calc(100% - 110px)',
          }}>
            {nodeTypes.slice(0, 9).map(({ type, count, style }) => (
              <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{
                  width: 10, height: 10, borderRadius: 99,
                  background: style.fill,
                  border: `1.5px solid ${style.stroke}`,
                  flexShrink: 0,
                }} />
                <span>{count} {style.label}</span>
              </span>
            ))}
          </div>
        )}

        {/* Hint strip (top-left) */}
        <div style={{
          position: 'absolute', top: 12, left: 12,
          fontSize: 10, color: chrome.muted,
          background: chrome.white, padding: '4px 8px',
          border: `1px solid ${chrome.border}`, borderRadius: 6,
          pointerEvents: 'none',
        }}>
          Drag to pan · scroll to zoom · click a node for detail · zoom {(zoomLevel * 100).toFixed(0)}%
        </div>
      </div>

      {/* ─── Detail panel ─── */}
      {selectedNode && (
        <div style={{
          background: chrome.white,
          border: `1px solid ${chrome.border}`,
          borderRadius: 10,
          overflow: 'auto',
        }}>
          {renderNodeDetail
            ? renderNodeDetail(selectedNode, { tokens, hoverNode })
            : <DefaultNodeDetail node={selectedNode} tokens={tokens} />}
        </div>
      )}
    </div>
  )
}

// ─── small style helper ─────────────────────────────────────────────────────
function zBtn(chrome) {
  return {
    width: 28, height: 28, border: 'none',
    background: 'transparent', color: chrome.text,
    fontSize: 15, cursor: 'pointer',
    fontWeight: 600, borderRadius: 5,
  }
}

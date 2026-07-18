/**
 * Force-directed layout via d3-force: links, charge, collide, center,
 * and connected-component clustering (forceX/forceY).
 *
 * Simulates in a world sized by node count (not the panel), so hundreds of
 * notes can spread out — the UI pans/zooms into that space.
 */
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  forceX,
  forceY,
} from 'd3-force';

/**
 * @typedef {{ id: string, x: number, y: number, vx: number, vy: number, fx?: number | null, fy?: number | null, cluster?: number }} SimNode
 * @typedef {{ source: SimNode | string | number, target: SimNode | string | number }} SimLink
 */

/**
 * @param {number} n
 * @returns {number}
 */
export function worldSizeForCount(n) {
  // ~48px of space per node on a square grid, floored for small graphs.
  return Math.max(640, Math.ceil(48 * Math.sqrt(Math.max(n, 1))));
}

/**
 * @param {string[]} ids
 * @param {Array<{ source: string, target: string }>} links
 * @returns {Map<string, number>}
 */
function connectedComponentClusters(ids, links) {
  /** @type {Map<string, string>} */
  const parent = new Map();
  for (const id of ids) parent.set(id, id);

  /** @param {string} a */
  function find(a) {
    let p = parent.get(a) ?? a;
    while (p !== (parent.get(p) ?? p)) {
      parent.set(p, parent.get(parent.get(p) ?? p) ?? p);
      p = parent.get(p) ?? p;
    }
    return p;
  }

  /** @param {string} a @param {string} b */
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }

  for (const link of links) {
    if (parent.has(link.source) && parent.has(link.target)) {
      union(link.source, link.target);
    }
  }

  /** @type {Map<string, number>} */
  const rootToCluster = new Map();
  /** @type {Map<string, number>} */
  const idToCluster = new Map();
  let next = 0;
  for (const id of ids) {
    const root = find(id);
    if (!rootToCluster.has(root)) rootToCluster.set(root, next++);
    idToCluster.set(id, rootToCluster.get(root) ?? 0);
  }
  return idToCluster;
}

/**
 * @param {number} count
 * @param {number} size
 * @returns {Array<{ x: number, y: number }>}
 */
function clusterCenters(count, size) {
  const cx = size / 2;
  const cy = size / 2;
  if (count <= 1) return [{ x: cx, y: cy }];
  const radius = size * 0.32;
  /** @type {Array<{ x: number, y: number }>} */
  const centers = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    centers.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
    });
  }
  return centers;
}

/**
 * @param {object} opts
 * @param {Array<{ id: string }>} opts.nodes
 * @param {Array<{ source: string, target: string }>} opts.links
 * @param {number} [opts.width] ignored for world size; kept for API compat
 * @param {number} [opts.height] ignored for world size; kept for API compat
 */
export function createForceSimulation({ nodes, links }) {
  const n = nodes.length;
  let size = worldSizeForCount(n);

  const ids = nodes.map((node) => node.id);
  const clusters = connectedComponentClusters(ids, links);
  let clusterCount = 0;
  for (const c of clusters.values()) clusterCount = Math.max(clusterCount, c + 1);
  let centers = clusterCenters(Math.max(1, clusterCount), size);

  const cx = size / 2;
  const cy = size / 2;
  const ring = size * 0.08;

  /** @type {SimNode[]} */
  const simNodes = nodes.map((node, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2;
    const cluster = clusters.get(node.id) ?? 0;
    const center = centers[cluster] || { x: cx, y: cy };
    return {
      id: node.id,
      cluster,
      x: center.x + Math.cos(angle) * ring + (Math.random() - 0.5) * 12,
      y: center.y + Math.sin(angle) * ring + (Math.random() - 0.5) * 12,
      vx: 0,
      vy: 0,
    };
  });

  /** @type {SimLink[]} */
  const simLinks = links
    .filter((l) => l.source !== l.target)
    .map((l) => ({ source: l.source, target: l.target }));

  const linkForce = forceLink(simLinks)
    .id((d) => d.id)
    .distance(42)
    .strength(0.4);

  const chargeForce = forceManyBody().strength(-180).distanceMax(size * 0.55);
  const centerForce = forceCenter(cx, cy).strength(0.02);
  const collideForce = forceCollide().radius(8).strength(0.9).iterations(2);

  const clusterX = forceX((d) => centers[d.cluster]?.x ?? cx).strength(0.06);
  const clusterY = forceY((d) => centers[d.cluster]?.y ?? cy).strength(0.06);

  const simulation = forceSimulation(simNodes)
    .force('link', linkForce)
    .force('charge', chargeForce)
    .force('center', centerForce)
    .force('collide', collideForce)
    .force('clusterX', clusterX)
    .force('clusterY', clusterY)
    .alphaDecay(0.03)
    .velocityDecay(0.32)
    .stop();

  simulation.alpha(1);

  /** @param {number} [_w] @param {number} [_h] */
  function setSize(_w, _h) {
    // World size is driven by node count, not the panel. No-op for resize.
  }

  function reheat() {
    simulation.alphaTarget(0);
    simulation.alpha(0.85);
  }

  /** @returns {number} */
  function tick() {
    if (n === 0) return 0;
    simulation.tick();
    let energy = 0;
    for (const node of simNodes) {
      energy += (node.vx || 0) ** 2 + (node.vy || 0) ** 2;
    }
    return energy;
  }

  /**
   * @param {SimNode} node
   * @param {number} x
   * @param {number} y
   */
  function dragStart(node, x, y) {
    node.fx = x;
    node.fy = y;
    simulation.alphaTarget(0.28);
    if (simulation.alpha() < 0.35) simulation.alpha(0.35);
  }

  /**
   * @param {SimNode} node
   * @param {number} x
   * @param {number} y
   */
  function drag(node, x, y) {
    node.fx = x;
    node.fy = y;
    if (simulation.alpha() < 0.2) simulation.alpha(0.2);
  }

  /**
   * @param {SimNode} node
   */
  function dragEnd(node) {
    node.fx = null;
    node.fy = null;
    simulation.alphaTarget(0);
    if (simulation.alpha() < 0.25) simulation.alpha(0.25);
  }

  return {
    nodes: simNodes,
    links: simLinks,
    worldSize: size,
    tick,
    reheat,
    setSize,
    dragStart,
    drag,
    dragEnd,
    get alpha() {
      return simulation.alpha();
    },
  };
}

/**
 * Tiny force-directed layout (no d3). Verlet integration with repulsion,
 * edge springs, and weak center gravity.
 */

/**
 * @typedef {{ id: string, x: number, y: number, vx: number, vy: number }} SimNode
 * @typedef {{ source: number, target: number }} SimLink
 */

/**
 * @param {object} opts
 * @param {Array<{ id: string }>} opts.nodes
 * @param {Array<{ source: string, target: string }>} opts.links
 * @param {number} opts.width
 * @param {number} opts.height
 */
export function createForceSimulation({ nodes, links, width, height }) {
  const cx = width / 2;
  const cy = height / 2;
  const n = nodes.length;

  /** @type {SimNode[]} */
  const simNodes = nodes.map((node, i) => {
    const angle = (i / Math.max(n, 1)) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.28;
    return {
      id: node.id,
      x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 8,
      y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 8,
      vx: 0,
      vy: 0,
    };
  });

  const indexById = new Map(simNodes.map((node, i) => [node.id, i]));

  /** @type {SimLink[]} */
  const simLinks = [];
  for (const link of links) {
    const source = indexById.get(link.source);
    const target = indexById.get(link.target);
    if (source == null || target == null || source === target) continue;
    simLinks.push({ source, target });
  }

  const repulsion = 1200;
  const springLength = 56;
  const springStrength = 0.04;
  const centerStrength = 0.015;
  const damping = 0.85;
  const maxSpeed = 8;

  let alpha = 1;

  /**
   * @param {number} [w]
   * @param {number} [h]
   */
  function setSize(w = width, h = height) {
    width = Math.max(1, w);
    height = Math.max(1, h);
  }

  function reheat() {
    alpha = 1;
  }

  /** @returns {number} kinetic energy proxy */
  function tick() {
    if (n === 0) return 0;

    const midX = width / 2;
    const midY = height / 2;
    const a = alpha;

    for (let i = 0; i < n; i++) {
      const aNode = simNodes[i];
      for (let j = i + 1; j < n; j++) {
        const bNode = simNodes[j];
        let dx = bNode.x - aNode.x;
        let dy = bNode.y - aNode.y;
        let dist2 = dx * dx + dy * dy;
        if (dist2 < 0.01) {
          dx = (Math.random() - 0.5) * 0.5;
          dy = (Math.random() - 0.5) * 0.5;
          dist2 = dx * dx + dy * dy;
        }
        const dist = Math.sqrt(dist2);
        const force = (repulsion * a) / dist2;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        aNode.vx -= fx;
        aNode.vy -= fy;
        bNode.vx += fx;
        bNode.vy += fy;
      }
    }

    for (const link of simLinks) {
      const aNode = simNodes[link.source];
      const bNode = simNodes[link.target];
      let dx = bNode.x - aNode.x;
      let dy = bNode.y - aNode.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const displacement = dist - springLength;
      const force = springStrength * displacement * a;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      aNode.vx += fx;
      aNode.vy += fy;
      bNode.vx -= fx;
      bNode.vy -= fy;
    }

    let energy = 0;
    for (const node of simNodes) {
      node.vx += (midX - node.x) * centerStrength * a;
      node.vy += (midY - node.y) * centerStrength * a;
      node.vx *= damping;
      node.vy *= damping;

      const speed = Math.sqrt(node.vx * node.vx + node.vy * node.vy);
      if (speed > maxSpeed) {
        node.vx = (node.vx / speed) * maxSpeed;
        node.vy = (node.vy / speed) * maxSpeed;
      }

      node.x += node.vx;
      node.y += node.vy;

      const pad = 12;
      node.x = Math.min(width - pad, Math.max(pad, node.x));
      node.y = Math.min(height - pad, Math.max(pad, node.y));

      energy += node.vx * node.vx + node.vy * node.vy;
    }

    alpha *= 0.98;
    if (alpha < 0.02) alpha = 0;

    return energy;
  }

  return {
    nodes: simNodes,
    links: simLinks,
    tick,
    reheat,
    setSize,
    get alpha() {
      return alpha;
    },
  };
}

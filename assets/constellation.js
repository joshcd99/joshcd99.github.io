// Auriga constellation: D3 stereographic projection of the six brightest
// stars, drawn in the top-left corner. Loaded on demand by terminal.js so
// pages other than / don't pull in D3 unless the user navigates back home.
//
// Usage:
//   Constellation.render({ skipAnimation })  // create / reveal
//   Constellation.hide()                     // fade out, keep DOM
//
// Star data: RA in decimal degrees (RA_hours * 15), Dec in degrees.
//   α Capella    RA 5h 16.7m → 79.17°   Dec +46.00°
//   β Menkalinan RA 5h 59.5m → 89.88°   Dec +44.95°
//   θ Mahasim    RA 5h 59.7m → 89.93°   Dec +37.21°
//   β Tau ElNath RA 5h 26.3m → 81.58°   Dec +28.61°
//   ι Hassaleh   RA 4h 56.97m → 74.24°  Dec +33.17°
//   ε Almaaz     RA 5h 02.0m → 75.50°   Dec +43.82°
//
// Projection: geoStereographic centered on Auriga (RA 82.5° Dec 37°);
// reflectX(true) corrects celestial east→left.
(function () {
  'use strict';

  const W = 420;
  const STAR_DATA = [
    { id: 'capella',    name: 'α · Capella',     ra: 79.17, dec: 46.00, r: 6   },
    { id: 'menkalinan', name: 'β · Menkalinan',  ra: 89.88, dec: 44.95, r: 3.5 },
    { id: 'theta',      name: 'θ · Mahasim',     ra: 89.93, dec: 37.21, r: 3   },
    { id: 'elnath',     name: 'β Tau · El Nath', ra: 81.58, dec: 28.61, r: 3.5 },
    { id: 'iota',       name: 'ι · Hassaleh',    ra: 74.24, dec: 33.17, r: 3   },
    { id: 'epsilon',    name: 'ε · Almaaz',      ra: 75.50, dec: 43.82, r: 2.5 },
  ];
  const PENTAGON = ['capella', 'menkalinan', 'theta', 'elnath', 'iota', 'capella'];

  // Cached DOM + projection state across show/hide cycles.
  let svgEl = null;
  let built = false;

  function ensureSvg() {
    if (svgEl && document.body.contains(svgEl)) return svgEl;
    svgEl = document.getElementById('constellation');
    if (!svgEl) {
      svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgEl.id = 'constellation';
      svgEl.setAttribute('viewBox', '0 0 420 490');
      svgEl.style.cssText = [
        'position: fixed',
        'top: 28px',
        'left: 28px',
        'width: min(420px, 38vw)',
        'height: auto',
        'z-index: 1',
        'opacity: 0',
        'transition: opacity 0.6s ease',
        'pointer-events: auto',
      ].join('; ');
      document.body.appendChild(svgEl);
    }
    return svgEl;
  }

  function build(opts) {
    if (built) return; // already drawn
    if (typeof d3 === 'undefined') {
      console.warn('Constellation: D3 not loaded; skipping');
      return;
    }
    built = true;
    const skipAnimation = !!opts.skipAnimation;
    const svg = ensureSvg();

    const projection = d3.geoStereographic()
      .rotate([-82.5, -37, 0])
      .reflectX(true)
      .scale(1500)
      .translate([210, 255]);

    const byId = {};
    STAR_DATA.forEach(s => {
      const [x, y] = projection([s.ra, s.dec]);
      s.x = x; s.y = y;
      byId[s.id] = s;
    });

    const d3svg = d3.select(svg);

    // Tooltip group (raised above everything).
    const tipG = d3svg.append('g').attr('pointer-events', 'none').style('opacity', 0);
    const tipBg = tipG.append('rect').attr('fill', 'rgba(5,8,15,0.82)').attr('rx', 3).attr('ry', 3);
    const tipTxt = tipG.append('text')
      .attr('font-family', "'Share Tech Mono', monospace")
      .attr('font-size', 11)
      .attr('fill', 'rgba(220,235,255,0.95)');

    function showTooltip(s) {
      tipTxt.text(s.name);
      const bbox = tipTxt.node().getBBox();
      const pad = 5;
      const bw = bbox.width + pad * 2;
      const bh = bbox.height + pad;
      const tx = s.x + 12 + bw > W ? s.x - 14 - bw : s.x + 12;
      const ty = s.y - bh / 2;
      tipBg.attr('x', tx).attr('y', ty).attr('width', bw).attr('height', bh);
      tipTxt.attr('x', tx + pad).attr('y', ty + bbox.height - 1);
      tipG.style('opacity', 1);
    }
    function hideTooltip() { tipG.style('opacity', 0); }

    // Pentagon edges (drawn line by line via stroke-dashoffset).
    const lineEls = {};
    for (let i = 0; i < PENTAGON.length - 1; i++) {
      const a = byId[PENTAGON[i]];
      const b = byId[PENTAGON[i + 1]];
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      lineEls[`${PENTAGON[i]}-${PENTAGON[i + 1]}`] = d3svg.insert('line', ':first-child')
        .attr('x1', a.x).attr('y1', a.y)
        .attr('x2', b.x).attr('y2', b.y)
        .attr('stroke', 'rgba(110,165,255,0.65)')
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round')
        .attr('stroke-dasharray', len)
        .attr('stroke-dashoffset', skipAnimation ? 0 : len);
    }

    // Stars + hover hit areas.
    STAR_DATA.forEach(s => {
      const g = d3svg.append('g').attr('cursor', 'default');
      g.append('circle')
        .attr('cx', s.x).attr('cy', s.y).attr('r', 18)
        .attr('fill', 'transparent').attr('pointer-events', 'all');
      g.append('circle')
        .attr('id', `star-${s.id}`)
        .attr('cx', s.x).attr('cy', s.y).attr('r', s.r)
        .attr('fill', 'rgba(220,235,255,0.95)')
        .style('filter', 'drop-shadow(0 0 5px rgba(170,210,255,0.9))')
        .style('opacity', skipAnimation ? 1 : 0);
      g.on('mouseenter', () => {
        d3.select(`#star-${s.id}`).style('filter', 'drop-shadow(0 0 10px rgba(200,230,255,1))');
        showTooltip(s);
        tipG.raise();
      });
      g.on('mouseleave', () => {
        d3.select(`#star-${s.id}`).style('filter', 'drop-shadow(0 0 5px rgba(170,210,255,0.9))');
        hideTooltip();
      });
    });

    if (skipAnimation) {
      svg.style.opacity = '1';
      return;
    }

    // Animated reveal: fade SVG, pop Capella, draw lines one by one,
    // popping the trailing star at each line's end. Add Almaaz last.
    function animateLine(fromId, toId, delay) {
      return new Promise(resolve => {
        setTimeout(() => {
          lineEls[`${fromId}-${toId}`].transition().duration(450).ease(d3.easeLinear)
            .attr('stroke-dashoffset', 0).on('end', resolve);
        }, delay);
      });
    }
    function popStar(id, delay) {
      if (!id || !byId[id]) return;
      setTimeout(() => {
        d3.select(`#star-${id}`).style('opacity', 1)
          .attr('r', byId[id].r * 1.5)
          .transition().duration(200).ease(d3.easeBounceOut)
          .attr('r', byId[id].r);
      }, delay);
    }

    (async function () {
      await new Promise(r => setTimeout(r, 500));
      svg.style.opacity = '1';
      popStar('capella', 200);
      const seq = [
        ['capella',    'menkalinan', 400],
        ['menkalinan', 'theta',      900],
        ['theta',      'elnath',     1350],
        ['elnath',     'iota',       1800],
        ['iota',       'capella',    2200],
      ];
      for (const [from, to, delay] of seq) {
        animateLine(from, to, delay);
        setTimeout(() => { if (to !== 'capella') popStar(to, 0); }, delay + 460);
      }
      setTimeout(() => popStar('epsilon', 0), 2800);
    })();
  }

  function render(opts) {
    opts = opts || {};
    const svg = ensureSvg();
    if (!built) {
      build(opts);
    } else {
      svg.style.opacity = '1';
      svg.style.display = '';
    }
  }

  function hide() {
    if (!svgEl) return;
    svgEl.style.opacity = '0';
    // Don't display:none: let the opacity transition finish naturally.
  }

  window.Constellation = { render, hide };
})();

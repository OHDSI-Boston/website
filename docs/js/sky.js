/**
 * sky.js — the night sky behind the dark panels.
 *
 * Each .panel--dark gets a <canvas> that draws the same star field as
 * assets/stars.svg (parsed at runtime, so the look is unchanged), slowly
 * rotating about a pole above the panel. Rarely, a faint shooting star
 * crosses one visible panel; waits between them are exponential, so they
 * arrive at random with a set mean.
 *
 * A sun rises and sets in the lower right on a slow day cycle. Its elevation
 * moves the panel's warm glow (the CSS ::after gradient, via --sun-x, --sun-y
 * and --sun-glow) and fades the stars as it climbs. The page opens at dawn,
 * which is the static look CSS draws without JavaScript.
 *
 * Under reduced motion the sky is drawn once, at dawn, and never moves.
 *
 * Public interface:
 *     const sky = startSky(panels, { revolutionSeconds, shootingStarMeanSeconds,
 *                                    dayCycleSeconds, reducedMotion });
 *     sky.setReducedMotion(bool);
 */

const STAR_SVG = 'assets/stars.svg';
const TILE_SVG = 400;          // viewBox size of stars.svg
const TILE_PX = 460;           // matches background-size in site.css
const STAR_ALPHA = 0.5;        // matches the ::before opacity in site.css
const POLE = { x: 0.72, y: -0.18 };   // pivot, as a fraction of panel size
const IDLE_FRAME_MS = 50;      // ~20 fps is plenty for the rotation alone
const GLOW_UPDATE_MS = 250;    // CSS glow repaints the whole panel; keep it rare
const DAWN_PHASE = -0.02;      // day-cycle phase at page load: just before sunrise

const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/* Sun for a day-cycle phase in [0, 1): 0 = sunrise, 0.25 = highest,
   0.5 = sunset, 0.75 = midnight. Positions are fractions of the panel. */
export function sunAt(phase) {
  const a = phase * Math.PI * 2;
  const e = Math.sin(a);                           // elevation, -1..1
  return {
    e,
    x: 0.9 + 0.08 * Math.cos(a),                   // rises at 0.98, sets at 0.82
    y: 1 - 0.32 * e,                               // peaks 32% above the bottom edge
    /* Warm glow is strongest near the horizon, faint at midday, gone at night. */
    glow: 0.40 * Math.exp(-(((e - 0.05) / 0.3) ** 2)) + 0.08 * Math.max(e, 0),
    stars: 1 - 0.6 * smoothstep(-0.15, 0.4, e)
  };
}

async function loadTile() {
  const text = await (await fetch(STAR_SVG)).text();
  const scale = TILE_PX / TILE_SVG;
  const stars = [];
  for (const m of text.matchAll(/<circle\b([^>]*)>/g)) {
    const attr = (name) => Number((m[1].match(new RegExp(`\\b${name}="([\\d.]+)"`)) || [])[1]);
    const star = { x: attr('cx') * scale, y: attr('cy') * scale, r: attr('r') * scale, o: attr('opacity') };
    if ([star.x, star.y, star.r, star.o].every(Number.isFinite)) stars.push(star);
  }
  return stars;
}

function createPanelSky(panel, tile) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sky';
  canvas.setAttribute('aria-hidden', 'true');
  panel.prepend(canvas);
  panel.classList.add('has-sky');
  const ctx = canvas.getContext('2d');

  let w = 0, h = 0, pole = { x: 0, y: 0 }, field = [];

  /* Tile the star pattern over a disc around the pole large enough that the
     panel stays covered at every angle. */
  function layout() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = panel.clientWidth; h = panel.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    pole = { x: w * POLE.x, y: h * POLE.y };
    const R = Math.max(...[[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.hypot(x - pole.x, y - pole.y))) + 4;
    const n = Math.ceil(R / TILE_PX);
    field = [];
    for (let i = -n; i < n; i++) {
      for (let j = -n; j < n; j++) {
        for (const s of tile) {
          const dx = i * TILE_PX + s.x, dy = j * TILE_PX + s.y;
          if (dx * dx + dy * dy <= R * R) field.push({ dx, dy, r: s.r, o: s.o * STAR_ALPHA });
        }
      }
    }
  }

  function draw(angle, meteor, sun) {
    ctx.clearRect(0, 0, w, h);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    ctx.fillStyle = '#fff';
    const starAlpha = sun ? sun.stars : 1;
    for (const s of field) {
      const x = pole.x + s.dx * cos - s.dy * sin;
      const y = pole.y + s.dx * sin + s.dy * cos;
      if (x < -2 || y < -2 || x > w + 2 || y > h + 2) continue;
      ctx.globalAlpha = s.o * starAlpha;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (sun) drawSun(sun);
    if (meteor) drawMeteor(meteor);
  }

  /* A soft amber disc with a wide halo; off the canvas while below the horizon. */
  function drawSun(sun) {
    const x = sun.x * w, y = sun.y * h;
    const core = 18, halo = 110;
    if (y - halo > h) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, halo);
    g.addColorStop(0, 'rgba(253,197,13,0.55)');
    g.addColorStop(core / halo, 'rgba(239,127,27,0.35)');
    g.addColorStop(0.45, 'rgba(239,127,27,0.08)');
    g.addColorStop(1, 'rgba(239,127,27,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, halo, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,214,120,0.8)';
    ctx.beginPath();
    ctx.arc(x, y, core, 0, Math.PI * 2);
    ctx.fill();
  }

  /* Move the CSS glow to follow the sun. */
  function setGlow(sun) {
    panel.style.setProperty('--sun-x', `${(sun.x * 100).toFixed(2)}%`);
    panel.style.setProperty('--sun-y', `${(sun.y * 100 + 8).toFixed(2)}%`);
    panel.style.setProperty('--sun-glow', sun.glow.toFixed(3));
  }

  /* A thin streak: bright head, fading tail, fading in and out over its life. */
  function drawMeteor(m) {
    const t = m.t;
    const head = { x: m.x + m.vx * m.travel * t, y: m.y + m.vy * m.travel * t };
    const tail = { x: head.x - m.vx * m.length, y: head.y - m.vy * m.length };
    const fade = Math.sin(Math.PI * t) * m.alpha;
    const g = ctx.createLinearGradient(tail.x, tail.y, head.x, head.y);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(1, `rgba(255,255,255,${fade.toFixed(3)})`);
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.1;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(tail.x, tail.y);
    ctx.lineTo(head.x, head.y);
    ctx.stroke();
  }

  function newMeteor() {
    const dir = (Math.random() < 0.5 ? -1 : 1);
    const theta = (20 + Math.random() * 25) * Math.PI / 180;   // below horizontal
    return {
      x: w * (0.15 + Math.random() * 0.7),
      y: h * (0.05 + Math.random() * 0.45),
      vx: dir * Math.cos(theta), vy: Math.sin(theta),
      length: 70 + Math.random() * 60,
      travel: 160 + Math.random() * 120,
      duration: 800 + Math.random() * 500,
      alpha: 0.45 + Math.random() * 0.2,
      start: 0, t: 0
    };
  }

  layout();
  return { panel, layout, draw, setGlow, newMeteor, visible: false, meteor: null };
}

export function startSky(panels, options = {}) {
  const revolutionMs = (options.revolutionSeconds || 3600) * 1000;
  const meanMs = (options.shootingStarMeanSeconds || 180) * 1000;
  const dayMs = (options.dayCycleSeconds || 1200) * 1000;
  let reducedMotion = !!options.reducedMotion;
  let skies = [];
  let angle = 0, phase = DAWN_PHASE, last = 0, lastDraw = 0, lastGlow = 0, frame = 0, timer = 0;

  const drawAll = (force) => {
    const sun = sunAt(phase);
    skies.forEach((s) => (force || s.visible) && s.draw(angle, s.meteor, sun));
    return sun;
  };

  function tick(now) {
    frame = 0;
    const dt = Math.min(now - (last || now), 100);   // no jump after a pause
    last = now;
    angle += (dt / revolutionMs) * Math.PI * 2;
    phase = (phase + dt / dayMs) % 1;
    const meteorActive = skies.some((s) => s.meteor);
    if (meteorActive || now - lastDraw >= IDLE_FRAME_MS) {
      for (const s of skies) {
        if (s.meteor) {
          if (!s.meteor.start) s.meteor.start = now;
          s.meteor.t = (now - s.meteor.start) / s.meteor.duration;
          if (s.meteor.t >= 1) s.meteor = null;
        }
      }
      const sun = drawAll(false);
      lastDraw = now;
      if (now - lastGlow >= GLOW_UPDATE_MS) { skies.forEach((s) => s.setGlow(sun)); lastGlow = now; }
    }
    schedule();
  }

  function schedule() {
    if (frame || reducedMotion || document.hidden || !skies.some((s) => s.visible)) return;
    frame = requestAnimationFrame(tick);
  }
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0; last = 0;
  }

  /* Exponential waits give a memoryless, genuinely random rhythm with the
     requested mean. A star due while nothing is on screen is skipped. */
  function scheduleMeteor() {
    clearTimeout(timer);
    if (reducedMotion) return;
    const wait = -Math.log(1 - Math.random()) * meanMs;
    timer = setTimeout(() => {
      const visible = skies.filter((s) => s.visible && !s.meteor);
      if (!document.hidden && visible.length) {
        const sky = visible[(Math.random() * visible.length) | 0];
        sky.meteor = sky.newMeteor();
      }
      scheduleMeteor();
    }, wait);
  }

  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const sky = skies.find((s) => s.panel === e.target);
      if (sky) sky.visible = e.isIntersecting;
    }
    schedule();
  });
  const ro = new ResizeObserver((entries) => {
    for (const e of entries) {
      const sky = skies.find((s) => s.panel === e.target);
      if (sky) { sky.layout(); sky.draw(angle, sky.meteor, sunAt(phase)); }
    }
  });

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else schedule();
  });

  loadTile().then((tile) => {
    if (!tile.length) return;          // keep the CSS fallback
    skies = Array.from(panels, (p) => createPanelSky(p, tile));
    skies.forEach((s) => { io.observe(s.panel); ro.observe(s.panel); });
    const sun = drawAll(true);
    skies.forEach((s) => s.setGlow(sun));
    scheduleMeteor();
  }).catch(() => { /* CSS fallback stays visible */ });

  return {
    setReducedMotion(value) {
      reducedMotion = !!value;
      if (reducedMotion) {
        stop(); clearTimeout(timer);
        phase = DAWN_PHASE;
        skies.forEach((s) => { s.meteor = null; });
        const sun = drawAll(true);
        skies.forEach((s) => s.setGlow(sun));
      }
      else { scheduleMeteor(); schedule(); }
    }
  };
}

/**
 * PRODUCT RENDER MODULE
 * Draws a floating "product hologram" above the visitor's open palm.
 * Hand position -> hologram position
 * Hand rotation (wrist->middle finger) -> hologram rotation
 * Hand spread (thumb-to-pinky distance) -> hologram scale
 * Pinch (thumb+index) -> locks the current colour variant + fires a shockwave
 *
 * The "product" itself is an abstract faceted gem/capsule shape — generic
 * enough to stand in for a phone, bottle, or device, but distinctive
 * enough to look designed rather than like a placeholder cube.
 */
window.AirShowcase = window.AirShowcase || {};

(function () {
  const AS = window.AirShowcase;

  const bgCanvas = document.getElementById('bgCanvas');
  const mainCanvas = document.getElementById('mainCanvas');
  const bgCtx = bgCanvas.getContext('2d');
  const ctx = mainCanvas.getContext('2d');

  let width = 0, height = 0;

  const VARIANTS = {
    Onyx:  { core: '#2a2a32', glow: '#9a9aa8', particle: '#cfcfd6' },
    Amber: { core: '#ff6b35', glow: '#ffb088', particle: '#ffd9bd' },
    Steel: { core: '#3d5a80', glow: '#7fa8d9', particle: '#bcd6f0' },
    Mint:  { core: '#2d8a52', glow: '#4ade80', particle: '#bdf5d3' }
  };
  let currentVariant = 'Onyx';
  let lockedVariant = null; // set on pinch-lock

  let smoothedPos = null;
  let smoothedScale = 0.5;
  let smoothedRot = 0;
  let time = 0;
  let lastTime = performance.now();

  let particles = [];
  let ripples = [];
  let lockPulse = 0; // animates briefly when a variant is locked

  function resize() {
    width = mainCanvas.clientWidth;
    height = mainCanvas.clientHeight;
    bgCanvas.width = width; bgCanvas.height = height;
    mainCanvas.width = width; mainCanvas.height = height;
  }
  window.addEventListener('resize', resize);

  function mapToCanvas(pt) {
    return { x: pt.x * width, y: pt.y * height };
  }

  function lerp(a, b, t) { return a + (b - a) * t; }

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  // ---- Particle / ripple effects (ambient polish around the hologram) ----
  function spawnParticles(pos, color, count = 2) {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: pos.x, y: pos.y,
        vx: (Math.random() - 0.5) * 1.4,
        vy: -Math.random() * 1.6 - 0.4,
        life: 1, color, size: Math.random() * 2 + 1
      });
    }
  }
  function spawnRipple(pos, color) {
    ripples.push({ x: pos.x, y: pos.y, r: 0, maxR: 90 + Math.random() * 40, life: 1, color });
  }
  function updateEffects() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.018;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    for (let i = ripples.length - 1; i >= 0; i--) {
      const r = ripples[i];
      r.r += (r.maxR - r.r) * 0.12;
      r.life -= 0.025;
      if (r.life <= 0) { ripples.splice(i, 1); continue; }
      ctx.globalAlpha = r.life;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 2.5 * r.life;
      ctx.beginPath();
      ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  // ---- Ambient background: soft drifting glow field, themed to variant ----
  function drawBackground() {
    bgCtx.globalCompositeOperation = 'destination-out';
    bgCtx.fillStyle = 'rgba(0,0,0,0.06)';
    bgCtx.fillRect(0, 0, width, height);
    bgCtx.globalCompositeOperation = 'source-over';

    const v = VARIANTS[lockedVariant || currentVariant];
    const cx = width / 2 + Math.sin(time * 0.2) * width * 0.08;
    const cy = height * 0.42 + Math.cos(time * 0.15) * height * 0.05;
    const grad = bgCtx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(width, height) * 0.5);
    grad.addColorStop(0, v.glow + '22');
    grad.addColorStop(1, 'transparent');
    bgCtx.fillStyle = grad;
    bgCtx.fillRect(0, 0, width, height);
  }

  // ---- The hologram itself: a faceted crystal silhouette with real light/shadow facets ----
  function drawHologram(center, scale, rotation, variant) {
    const v = VARIANTS[variant];
    const s = Math.min(width, height) * 0.17 * scale;

    ctx.save();
    ctx.translate(center.x, center.y);
    ctx.rotate(rotation);

    // Soft outer glow behind the whole object
    ctx.shadowBlur = 50 * scale;
    ctx.shadowColor = v.glow;
    ctx.beginPath();
    ctx.ellipse(0, 0, s * 0.55, s * 1.3, 0, 0, Math.PI * 2);
    ctx.fillStyle = v.core;
    ctx.globalAlpha = 0.18;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Define an elongated hexagonal gem outline (tip, shoulders, base)
    const outline = [
      { x: 0,          y: -s * 1.3 },   // top tip
      { x: s * 0.55,   y: -s * 0.45 },  // right shoulder
      { x: s * 0.42,   y: s * 0.95 },   // right base
      { x: 0,          y: s * 1.3 },    // bottom tip
      { x: -s * 0.42,  y: s * 0.95 },   // left base
      { x: -s * 0.55,  y: -s * 0.45 },  // left shoulder
    ];

    // Split into facets sharing a center spine so each catches light differently
    const facets = [
      { pts: [outline[0], outline[1], { x: 0, y: -s * 0.45 }], light: 1.0 },
      { pts: [outline[1], outline[2], { x: 0, y: s * 0.1 }, { x: 0, y: -s * 0.45 }], light: 0.7 },
      { pts: [outline[2], outline[3], { x: 0, y: s * 0.1 }], light: 0.45 },
      { pts: [outline[3], outline[4], { x: 0, y: s * 0.1 }], light: 0.55 },
      { pts: [outline[4], outline[5], { x: 0, y: -s * 0.45 }, { x: 0, y: s * 0.1 }], light: 0.8 },
      { pts: [outline[5], outline[0], { x: 0, y: -s * 0.45 }], light: 1.0 },
    ];

    ctx.shadowBlur = 0;
    facets.forEach((f) => {
      ctx.beginPath();
      ctx.moveTo(f.pts[0].x, f.pts[0].y);
      for (let i = 1; i < f.pts.length; i++) ctx.lineTo(f.pts[i].x, f.pts[i].y);
      ctx.closePath();
      ctx.fillStyle = v.core;
      ctx.globalAlpha = 0.55 + f.light * 0.4;
      ctx.fill();
      ctx.strokeStyle = v.glow;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;

    // Crisp bright outline so it reads as a defined object, not a haze
    ctx.shadowBlur = 18 * scale;
    ctx.shadowColor = v.glow;
    ctx.beginPath();
    ctx.moveTo(outline[0].x, outline[0].y);
    for (let i = 1; i < outline.length; i++) ctx.lineTo(outline[i].x, outline[i].y);
    ctx.closePath();
    ctx.strokeStyle = v.particle;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Center spine highlight (subtle, gives the gem an internal facet line)
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, -s * 0.45);
    ctx.lineTo(0, s * 0.1);
    ctx.strokeStyle = v.particle;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Lock pulse ring
    if (lockPulse > 0) {
      ctx.globalAlpha = lockPulse;
      ctx.beginPath();
      ctx.arc(0, 0, s * (1.5 + (1 - lockPulse) * 1.1), 0, Math.PI * 2);
      ctx.strokeStyle = v.glow;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // ---- Hand math ----
  function handMetrics(hand) {
    const wrist = hand[0];
    const middleTip = hand[12];
    const thumbTip = hand[4];
    const pinkyTip = hand[20];
    const indexTip = hand[8];

    const palmCenter = {
      x: (wrist.x + hand[9].x) / 2,
      y: (wrist.y + hand[9].y) / 2
    };

    const rotation = Math.atan2(middleTip.y - wrist.y, middleTip.x - wrist.x) + Math.PI / 2;
    const spread = AS.dist(thumbTip, pinkyTip);
    const scale = Math.min(Math.max(spread * 4.2, 0.45), 1.7);
    const pinchDist = AS.dist(thumbTip, indexTip);
    const isPinching = pinchDist < 0.045;

    return { palmCenter, rotation, scale, isPinching, indexTip };
  }

  let wasPinching = false;

  function detectGesture(hand) {
    const m = handMetrics(hand);

    if (m.isPinching && !wasPinching) {
      // Lock current variant on pinch start
      lockedVariant = currentVariant;
      lockPulse = 1;
      const pos = mapToCanvas(m.palmCenter);
      spawnRipple(pos, VARIANTS[currentVariant].glow);
      AS.setGestureLabel(`Locked: ${currentVariant}`);
      if (typeof AS.onVariantLocked === 'function') AS.onVariantLocked(currentVariant);
    } else if (!m.isPinching && wasPinching) {
      AS.setGestureLabel('Open hand');
    } else if (!m.isPinching) {
      AS.setGestureLabel(m.scale > 1 ? 'Open hand' : 'Hand');
    }
    wasPinching = m.isPinching;
    return m;
  }

  function render(timestamp) {
    requestAnimationFrame(render);
    const dt = (timestamp - lastTime) / 1000;
    lastTime = timestamp;
    time += dt;

    if (lockPulse > 0) lockPulse = Math.max(0, lockPulse - dt * 1.2);

    drawBackground();

    ctx.clearRect(0, 0, width, height);

    const hands = AS.state.hands;

    if (hands && hands.length > 0) {
      const hand = hands[0];
      const m = detectGesture(hand);

      const target = mapToCanvas(m.palmCenter);
      // Float the hologram slightly above the palm
      target.y -= height * 0.14;

      if (!smoothedPos) smoothedPos = { ...target };
      smoothedPos.x = lerp(smoothedPos.x, target.x, 0.25);
      smoothedPos.y = lerp(smoothedPos.y, target.y, 0.25);
      smoothedScale = lerp(smoothedScale, m.scale, 0.18);
      smoothedRot = lerpAngle(smoothedRot, m.rotation, 0.15);

      drawHologram(smoothedPos, smoothedScale, smoothedRot, lockedVariant || currentVariant);

      if (Math.random() > 0.55) {
        spawnParticles(
          { x: smoothedPos.x + (Math.random() - 0.5) * 30, y: smoothedPos.y + 20 },
          VARIANTS[lockedVariant || currentVariant].particle,
          1
        );
      }
    } else {
      AS.setGestureLabel('—');
    }

    updateEffects();
  }

  AS.setVariant = function (name) {
    if (VARIANTS[name]) {
      currentVariant = name;
      lockedVariant = null; // changing manually clears the lock
    }
  };

  AS.startRenderLoop = function () {
    resize();
    requestAnimationFrame(render);
  };

  // expose resize for ui.js init sequencing if needed
  AS.resizeCanvases = resize;
})();

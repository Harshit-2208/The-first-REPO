// ── Game states ───────────────────────────────────────────
const STATE = { IDLE: 0, PLAYING: 1, DEAD: 2, PAUSED: 3 };
let state = STATE.IDLE;

// ── Canvas ─────────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let W, H, GROUND_H, BIRD_X;

function resize() {
  W        = canvas.width  = window.innerWidth;
  H        = canvas.height = window.innerHeight;
  GROUND_H = Math.round(H * 0.10);
  BIRD_X   = Math.round(W * 0.18);
  if (state !== STATE.IDLE) {
    bird.x = BIRD_X;
    bird.y = Math.min(bird.y, H - GROUND_H - bird.h);
  } else {
    bird.x = BIRD_X;
    bird.y = H / 2 - 20;
  }
}
window.addEventListener('resize', resize);

// ── Physics constants (standard Flappy Bird values) ────────
const PHYSICS = {
  gravity:      0.4,    // px/frame²
  flapVel:     -8.0,    // px/frame  (upward impulse)
  holdBonus:   -0.18,   // extra lift per frame while holding
  maxFall:      8,      // terminal velocity px/frame
  pipeSpeed:    2.5,    // px/frame  obstacle moves left
  pipeInterval: 2200,   // ms between new pairs (wider horizontal gap)
};

// vertical gap: 42% of playable height  (wider than before)
function fireGap()   { return (H - GROUND_H) * 0.42; }

// ── Flap sound ─────────────────────────────────────────────

function playFlapSound() {
  // Audio removed as per user request
}
const birdImg = new Image();
birdImg.src   = 'bird.png';

const bird = {
  x: 0, y: 0, vy: 0,
  w: 90, h: 90,
  rot: 0, wingFrame: 0, wingTimer: 0,
  holding: false,

  reset() {
    this.x = BIRD_X; this.y = H / 2 - 20;
    this.vy = 0; this.rot = 0;
    this.wingFrame = 0; this.holding = false;
  },

  flap() {
    this.vy      = PHYSICS.flapVel;
    this.holding = true;
    playFlapSound();
  },

  releaseFlap() { this.holding = false; },

  update() {
    if (this.holding && this.vy < 0) this.vy += PHYSICS.holdBonus;
    this.vy  = Math.min(this.vy + PHYSICS.gravity, PHYSICS.maxFall);
    this.y  += this.vy;
    this.rot = Math.min(Math.max(this.vy * 3.5, -30), 85);
    const spd = this.vy < 0 ? 3 : 6;
    if (++this.wingTimer >= spd) {
      this.wingFrame = (this.wingFrame + 1) % 3;
      this.wingTimer = 0;
    }
  },

  draw() {
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate((this.rot * Math.PI) / 180);
    if (birdImg.complete && birdImg.naturalWidth > 0) {
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 18;
      ctx.drawImage(birdImg, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.shadowBlur  = 0;
    } else {
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.w / 2, this.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  hitbox() {
    const p = 10;
    return { x: this.x + p, y: this.y + p, w: this.w - p * 2, h: this.h - p * 2 };
  },
};

// ── Flame jet particles ────────────────────────────────────
// Each "jet" is attached to one side (top wall or bottom wall).
// Particles shoot horizontally LEFT (toward the bird) from x=jetX.

function makeJet(nozzleX, nozzleY, dir) {
  // dir: -1 = top wall shoots DOWN, 1 = bottom wall shoots UP
  return { nozzleX, nozzleY, dir, particles: [], timer: 0 };
}

const JET_LEN      = 220;  // how far the flame jet reaches horizontally
const NOZZLE_SIZE  = 28;   // nozzle head radius

function spawnJetParticles(jet, dt) {
  jet.timer += dt;

  // ── Flame puffs (big, slow, drift outward) ──
  while (jet.timer >= 18) {
    jet.timer -= 18;
    const count = 6 + Math.floor(Math.random() * 5);
    for (let i = 0; i < count; i++) {
      const dir    = jet.dir; // -1 = top (shoots down), 1 = bottom (shoots up)
      const speedY = dir === -1
        ? (2.5 + Math.random() * 4.5)
        : -(2.5 + Math.random() * 4.5);
      jet.particles.push({
        type: 'puff',
        x:    jet.nozzleX + (Math.random() - 0.5) * 22,
        y:    jet.nozzleY,
        vx:   (Math.random() - 0.5) * 1.8,
        vy:   speedY,
        life: 0.6 + Math.random() * 0.5,
        maxLife: 1,
        r:    10 + Math.random() * 16,
        hue:  12 + Math.random() * 32,
      });
    }
  }
}

// Separate spark pool — erupts continuously
function spawnSparks(jet, dt, gapEdgeY) {
  if (!jet.sparkTimer) jet.sparkTimer = 0;
  jet.sparkTimer += dt;
  while (jet.sparkTimer >= 28) {
    jet.sparkTimer -= 28;
    const dir   = jet.dir;
    const span  = Math.abs(gapEdgeY - jet.nozzleY);
    const count = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < count; i++) {
      // Sparks erupt from random heights along the flame column
      const frac = 0.05 + Math.random() * 0.7;
      const sy   = jet.nozzleY + dir * span * frac;
      // Initial velocity: mostly sideways, slight component along flame dir
      const angle  = (Math.random() - 0.5) * Math.PI * 0.9;
      const speed  = 2.5 + Math.random() * 4.5;
      if (!jet.sparks) jet.sparks = [];
      jet.sparks.push({
        x:    jet.nozzleX + (Math.random() - 0.5) * 18,
        y:    sy,
        vx:   Math.cos(angle) * speed,
        vy:   Math.sin(angle) * speed * 0.5 + dir * (0.5 + Math.random() * 1.5),
        life: 0.5 + Math.random() * 0.7,
        maxLife: 1,
        r:    1.2 + Math.random() * 2.2,
        hue:  40 + Math.random() * 20,
        trail: [],
      });
    }
  }
}

function updateJetParticles(jet) {
  // Puffs
  for (const p of jet.particles) {
    p.x    += p.vx;
    p.y    += p.vy;
    p.vx   *= 0.92;
    p.r    *= 0.968;
    p.life -= 0.024;
  }
  jet.particles = jet.particles.filter(p => p.life > 0 && p.r > 0.8);

  // Sparks — gravity pulls them back toward flame origin
  if (!jet.sparks) jet.sparks = [];
  for (const s of jet.sparks) {
    s.trail.push({ x: s.x, y: s.y });
    if (s.trail.length > 6) s.trail.shift();
    s.x    += s.vx;
    s.y    += s.vy;
    s.vx   *= 0.97;
    s.vy   += jet.dir === -1 ? 0.18 : -0.18; // slight gravity toward flame dir
    s.life -= 0.028;
  }
  jet.sparks = jet.sparks.filter(s => s.life > 0);
}

function drawJet(jet, gapEdgeY) {
  const t     = performance.now() / 1000;
  const isTop = jet.dir === -1;
  const fromY = jet.nozzleY;
  const span  = Math.abs(gapEdgeY - fromY);
  const nx    = jet.nozzleX;
  const dir   = isTop ? 1 : -1;

  if (span < 4) return;

  // Spawn sparks each draw (driven by real time, not dt)
  spawnSparks(jet, 16, gapEdgeY);

  // ── CLIP to this flame's zone ──
  ctx.save();
  ctx.beginPath();
  if (isTop) ctx.rect(nx - 80, 0,         160, gapEdgeY + 2);
  else        ctx.rect(nx - 80, gapEdgeY - 2, 160, H - gapEdgeY + 2);
  ctx.clip();

  // ══ 1. FLAME POLYGON BODY ══
  // Build a closed flame shape: wide at base, pointy lobed tip.
  const tongues = 5;
  const baseHW  = 28; // half-width at base
  const pts     = [];

  // Left edge of base
  pts.push({ x: nx - baseHW, y: fromY });

  // Left side going toward tip — generate lobe points
  for (let i = 1; i <= tongues * 2; i++) {
    const frac  = i / (tongues * 2 + 1);
    const phase = t * 3.8 + frac * Math.PI * 2.5;
    const lobe  = Math.sin(phase * 1.7) * (baseHW * 0.55) * (1 - frac * 0.6);
    const w     = baseHW * (1 - frac * 0.88) + lobe;
    pts.push({ x: nx - Math.abs(w), y: fromY + dir * span * frac });
  }

  // Tip point
  const tipWobble = Math.sin(t * 5.1) * 6;
  pts.push({ x: nx + tipWobble, y: fromY + dir * span * 0.97 });

  // Right side (mirror)
  for (let i = tongues * 2; i >= 1; i--) {
    const frac  = i / (tongues * 2 + 1);
    const phase = t * 3.8 + frac * Math.PI * 2.5 + Math.PI;
    const lobe  = Math.sin(phase * 1.7) * (baseHW * 0.55) * (1 - frac * 0.6);
    const w     = baseHW * (1 - frac * 0.88) + lobe;
    pts.push({ x: nx + Math.abs(w), y: fromY + dir * span * frac });
  }

  // Right edge of base
  pts.push({ x: nx + baseHW, y: fromY });

  // Draw filled flame shape with gradient
  const flameGrd = ctx.createLinearGradient(nx, fromY, nx, fromY + dir * span);
  flameGrd.addColorStop(0,    'rgba(255,255,180,0.95)');  // white-yellow at base
  flameGrd.addColorStop(0.12, 'rgba(255,200,30,0.92)');   // bright yellow
  flameGrd.addColorStop(0.35, 'rgba(255,100,0,0.85)');    // orange
  flameGrd.addColorStop(0.65, 'rgba(220,30,0,0.65)');     // deep red
  flameGrd.addColorStop(0.85, 'rgba(150,10,0,0.30)');     // dark red
  flameGrd.addColorStop(1,    'rgba(80,0,0,0)');          // transparent tip

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const prev = pts[i - 1];
    const cur  = pts[i];
    const mx   = (prev.x + cur.x) / 2;
    const my   = (prev.y + cur.y) / 2;
    ctx.quadraticCurveTo(prev.x, prev.y, mx, my);
  }
  ctx.closePath();
  ctx.fillStyle = flameGrd;
  ctx.fill();

  // ── Brighter inner core (narrower polygon, same shape) ──
  const innerPts = pts.map(p => ({
    x: nx + (p.x - nx) * 0.42,
    y: p.y,
  }));
  const innerGrd = ctx.createLinearGradient(nx, fromY, nx, fromY + dir * span * 0.75);
  innerGrd.addColorStop(0,    'rgba(255,255,230,0.98)');
  innerGrd.addColorStop(0.20, 'rgba(255,230,80,0.90)');
  innerGrd.addColorStop(0.55, 'rgba(255,130,0,0.55)');
  innerGrd.addColorStop(1,    'rgba(255,60,0,0)');

  ctx.beginPath();
  ctx.moveTo(innerPts[0].x, innerPts[0].y);
  for (let i = 1; i < innerPts.length; i++) {
    const prev = innerPts[i - 1];
    const cur  = innerPts[i];
    ctx.quadraticCurveTo(prev.x, prev.y, (prev.x + cur.x) / 2, (prev.y + cur.y) / 2);
  }
  ctx.closePath();
  ctx.fillStyle = innerGrd;
  ctx.fill();

  // ══ 2. FLAME PUFF PARTICLES ══
  for (const p of jet.particles) {
    if (p.type !== 'puff') continue;
    const a   = (p.life / p.maxLife);
    const grd = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
    grd.addColorStop(0,   `hsla(${p.hue + 30}, 100%, 75%, ${a * 0.80})`);
    grd.addColorStop(0.4, `hsla(${p.hue},      100%, 55%, ${a * 0.55})`);
    grd.addColorStop(1,   `hsla(${p.hue - 10}, 100%, 35%, 0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore(); // end clip

  // ══ 3. SPARKS — drawn OUTSIDE clip so they fly past the gap edge ══
  if (jet.sparks) {
    for (const s of jet.sparks) {
      const a = s.life / s.maxLife;

      // Spark trail
      if (s.trail.length > 1) {
        ctx.strokeStyle = `hsla(${s.hue}, 100%, 72%, ${a * 0.55})`;
        ctx.lineWidth   = s.r * 0.9;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(s.trail[0].x, s.trail[0].y);
        for (let ti = 1; ti < s.trail.length; ti++) {
          ctx.lineTo(s.trail[ti].x, s.trail[ti].y);
        }
        ctx.stroke();
      }

      // Spark head — tiny bright dot
      ctx.fillStyle = `hsla(55, 100%, 92%, ${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// ── Fire pairs ─────────────────────────────────────────────
let firePairs    = [];
let lastFireTime = 0;

function spawnFirePair() {
  const gap    = fireGap();
  const playH  = H - GROUND_H;
  const minGapY = playH * 0.10;
  const maxGapY = playH - gap - playH * 0.10;
  const gapY    = minGapY + Math.random() * (maxGapY - minGapY);

  const nx = W + 40;
  firePairs.push({
    x: nx,
    gapY,
    scored: false,
    // Top nozzle is FIXED to ceiling (y=0), flame shoots DOWN to gapY
    topJet:    makeJet(nx, 0,           -1),
    // Bottom nozzle is FIXED to ground (y=H-GROUND_H), flame shoots UP to gapY+gap
    bottomJet: makeJet(nx, H - GROUND_H, 1),
  });
}

function updateFirePairs(dt) {
  lastFireTime += dt;
  if (lastFireTime >= PHYSICS.pipeInterval) {
    spawnFirePair();
    lastFireTime = 0;
  }

  for (const fp of firePairs) {
    fp.x                  -= PHYSICS.pipeSpeed;
    fp.topJet.nozzleX      = fp.x;
    fp.bottomJet.nozzleX   = fp.x;
    // Nozzles stay pinned to boundaries — never move vertically
    fp.topJet.nozzleY      = 0;
    fp.bottomJet.nozzleY   = H - GROUND_H;

    spawnJetParticles(fp.topJet,    dt);
    spawnJetParticles(fp.bottomJet, dt);
    updateJetParticles(fp.topJet);
    updateJetParticles(fp.bottomJet);
    spawnSparks(fp.topJet,    dt, fp.gapY);
    spawnSparks(fp.bottomJet, dt, fp.gapY + fireGap());
  }

  // Remove pairs fully off screen
  firePairs = firePairs.filter(fp => fp.x + 80 > 0);
}

function drawFirePairs() {
  for (const fp of firePairs) {
    drawJet(fp.topJet,    fp.gapY);
    drawJet(fp.bottomJet, fp.gapY + fireGap());
  }
}

// ── Collision ──────────────────────────────────────────────
function checkFireCollisions() {
  const hb  = bird.hitbox();
  const gap = fireGap();

  for (const fp of firePairs) {
    // Score when bird passes the flame column x
    if (!fp.scored && bird.x > fp.x + 30) {
      fp.scored = true; score++;
      updateScoreDisplay(); saveBest();
      
      const scoreSound = document.getElementById('scoreSound');
      if (scoreSound) {
        scoreSound.currentTime = 0;
        scoreSound.volume = 1;
        scoreSound.play().catch((e) => { console.warn("Score audio play blocked or failed:", e); });
      }
    }

    // Flame column collision: bird is within the horizontal width of the flame
    const flameHW = 32; // half-width of flame base
    const inX = hb.x + hb.w > fp.x - flameHW && hb.x < fp.x + flameHW;
    if (inX) {
      if (hb.y < fp.gapY)              return true;
      if (hb.y + hb.h > fp.gapY + gap) return true;
    }
  }
  return false;
}

// ── Background ─────────────────────────────────────────────
let bgX = 0;

function updateBackground() {
  bgX -= PHYSICS.pipeSpeed;
  if (bgX <= -W) bgX = 0;
}

function drawBackground() {
  // White background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H - GROUND_H);
}

function drawGround() {
  const gY = H - GROUND_H;
  const t  = performance.now() / 1000;

  // ── 1. Dark cooled crust base ──────────────────────────
  ctx.fillStyle = '#1a0800';
  ctx.fillRect(0, gY, W, GROUND_H);

  // ── 2. Lava rivers — glowing channels between dark rock ──
  // Draw several winding horizontal lava rivers
  const rivers = [
    { yOff: 0.18, width: 18, speed: 0.6,  phase: 0 },
    { yOff: 0.42, width: 12, speed: 0.9,  phase: 2.1 },
    { yOff: 0.65, width: 22, speed: 0.5,  phase: 4.4 },
    { yOff: 0.85, width: 10, speed: 1.1,  phase: 1.3 },
  ];

  for (const r of rivers) {
    const ry    = gY + GROUND_H * r.yOff;
    const steps = 12; // Reduced for performance
    const grd   = ctx.createLinearGradient(0, ry - r.width / 2, 0, ry + r.width / 2);
    grd.addColorStop(0,    'rgba(255,220,60,0.0)');
    grd.addColorStop(0.18, 'rgba(255,160,0,0.85)');
    grd.addColorStop(0.5,  'rgba(255,80,0,1.0)');
    grd.addColorStop(0.82, 'rgba(200,30,0,0.85)');
    grd.addColorStop(1,    'rgba(100,0,0,0.0)');

    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const px  = (s / steps) * W;
      const py  = ry + Math.sin(t * r.speed + s * 0.38 + r.phase) * 3
                     + Math.sin(t * r.speed * 1.7 + s * 0.22) * 1.5;
      const hw  = (r.width / 2) * (0.7 + 0.3 * Math.sin(t * r.speed * 2 + s * 0.5));
      if (s === 0) {
        ctx.moveTo(px, py - hw);
      } else {
        ctx.lineTo(px, py - hw);
      }
    }
    for (let s = steps; s >= 0; s--) {
      const px = (s / steps) * W;
      const py = ry + Math.sin(t * r.speed + s * 0.38 + r.phase) * 3
                    + Math.sin(t * r.speed * 1.7 + s * 0.22) * 1.5;
      const hw = (r.width / 2) * (0.7 + 0.3 * Math.sin(t * r.speed * 2 + s * 0.5));
      ctx.lineTo(px, py + hw);
    }
    ctx.closePath();
    ctx.fillStyle = grd;
    ctx.fill();

    // Bright specular highlight in river centre
    ctx.beginPath();
    for (let s = 0; s <= steps; s++) {
      const px = (s / steps) * W;
      const py = ry + Math.sin(t * r.speed + s * 0.38 + r.phase) * 3;
      const hw = r.width * 0.12 * (0.8 + 0.2 * Math.sin(t * 4 + s * 0.6));
      if (s === 0) ctx.moveTo(px, py - hw);
      else         ctx.lineTo(px, py - hw);
    }
    for (let s = steps; s >= 0; s--) {
      const px = (s / steps) * W;
      const py = ry + Math.sin(t * r.speed + s * 0.38 + r.phase) * 3;
      const hw = r.width * 0.12 * (0.8 + 0.2 * Math.sin(t * 4 + s * 0.6));
      ctx.lineTo(px, py + hw);
    }
    ctx.closePath();
    ctx.fillStyle = `rgba(255,245,180,${0.55 + 0.25 * Math.sin(t * 3 + r.phase)})`;
    ctx.fill();
  }

  // ── 3. Dark cooled rock slabs (cracked texture) ──────────
  const rockSlabs = [
    { x: 0.02, w: 0.14, h: 0.55 }, { x: 0.18, w: 0.09, h: 0.45 },
    { x: 0.29, w: 0.12, h: 0.60 }, { x: 0.43, w: 0.08, h: 0.38 },
    { x: 0.53, w: 0.15, h: 0.52 }, { x: 0.70, w: 0.10, h: 0.42 },
    { x: 0.82, w: 0.11, h: 0.58 }, { x: 0.95, w: 0.04, h: 0.48 },
  ];

  for (const rs of rockSlabs) {
    const rx = rs.x * W;
    const rw = rs.w * W;
    const rh = rs.h * GROUND_H;
    const ry = gY + GROUND_H - rh;

    const rGrd = ctx.createLinearGradient(rx, ry, rx, ry + rh);
    rGrd.addColorStop(0,   '#2a1000');
    rGrd.addColorStop(0.4, '#1a0800');
    rGrd.addColorStop(1,   '#0a0400');
    ctx.fillStyle = rGrd;

    // Irregular rock shape
    ctx.beginPath();
    ctx.moveTo(rx,            ry + rh * 0.25);
    ctx.lineTo(rx + rw * 0.1, ry);
    ctx.lineTo(rx + rw * 0.5, ry + rh * 0.05);
    ctx.lineTo(rx + rw * 0.9, ry + rh * 0.02);
    ctx.lineTo(rx + rw,       ry + rh * 0.20);
    ctx.lineTo(rx + rw,       ry + rh);
    ctx.lineTo(rx,            ry + rh);
    ctx.closePath();
    ctx.fill();

    // Cracks glowing orange from within
    ctx.strokeStyle = `rgba(255,80,0,${0.3 + 0.2 * Math.sin(t * 1.5 + rx)})`;
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(rx + rw * 0.3, ry + rh * 0.1);
    ctx.lineTo(rx + rw * 0.35, ry + rh * 0.5);
    ctx.lineTo(rx + rw * 0.25, ry + rh * 0.85);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(rx + rw * 0.65, ry + rh * 0.05);
    ctx.lineTo(rx + rw * 0.60, ry + rh * 0.4);
    ctx.lineTo(rx + rw * 0.70, ry + rh * 0.75);
    ctx.stroke();
  }

  // ── 4. Lava surface bubbles ───────────────────────────────
  for (let i = 0; i < 18; i++) {
    const bx    = ((i * 57 + bgX * 2.5) % W + W) % W;
    const bPhase = t * (0.8 + (i % 4) * 0.25) + i * 0.9;
    const bLife  = (Math.sin(bPhase) + 1) / 2; // 0→1 bubble inflate
    if (bLife < 0.05) continue;

    // Place bubble on top of a lava river
    const riverIdx = i % rivers.length;
    const river    = rivers[riverIdx];
    const by       = gY + GROUND_H * river.yOff - river.width * 0.3;
    const br       = (3 + (i % 5) * 2.5) * bLife;

    // Bubble ring
    ctx.strokeStyle = `rgba(255,${120 + Math.round(bLife * 100)},0,${bLife * 0.9})`;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.stroke();

    // Bright highlight on top of bubble
    ctx.fillStyle = `rgba(255,240,120,${bLife * 0.6})`;
    ctx.beginPath();
    ctx.arc(bx - br * 0.25, by - br * 0.3, br * 0.28, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── 5. Heat shimmer glow at the surface ──────────────────
  const shimmerGrd = ctx.createLinearGradient(0, gY - 18, 0, gY + 12);
  shimmerGrd.addColorStop(0,   'rgba(255,100,0,0)');
  shimmerGrd.addColorStop(0.45,'rgba(255,80,0,0.22)');
  shimmerGrd.addColorStop(1,   'rgba(200,40,0,0)');
  ctx.fillStyle = shimmerGrd;
  ctx.fillRect(0, gY - 18, W, 30);

  // ── 6. Jagged rock edge at top of lava ───────────────────
  const edgeSteps = Math.ceil(W / 16);
  ctx.fillStyle = '#1e0a00';
  ctx.beginPath();
  ctx.moveTo(0, gY);
  for (let i = 0; i <= edgeSteps; i++) {
    const ex  = (i / edgeSteps) * W;
    const ey  = gY - 6 - (i % 3 === 0 ? 10 : i % 2 === 0 ? 5 : 2)
                * (0.7 + 0.3 * Math.sin(t * 0.3 + i * 1.3));
    ctx.lineTo(ex, ey);
  }
  ctx.lineTo(W, gY + 4);
  ctx.lineTo(0, gY + 4);
  ctx.closePath();
  ctx.fill();

  // ── 7. Glowing edge line ──────────────────────────────────
  ctx.strokeStyle = `rgba(255,${100 + Math.round(40 * Math.sin(t * 2))},0,0.9)`;
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, gY);
  for (let i = 0; i <= edgeSteps; i++) {
    const ex = (i / edgeSteps) * W;
    const ey = gY - 6 - (i % 3 === 0 ? 10 : i % 2 === 0 ? 5 : 2)
               * (0.7 + 0.3 * Math.sin(t * 0.3 + i * 1.3));
    ctx.lineTo(ex, ey);
  }
  ctx.stroke();
}

// ── Score / HUD ────────────────────────────────────────────
let score     = 0;
let bestScore = parseInt(localStorage.getItem('flappyFireBest') || '0');

function updateScoreDisplay() {
  document.getElementById('score').textContent = score;
}

function saveBest() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappyFireBest', bestScore);
    document.getElementById('bestScore').textContent = bestScore;
  }
}

function drawHUD() {
  const fs = Math.round(Math.min(W, H) * 0.07);
  ctx.textAlign   = 'center';
  ctx.font        = `bold ${fs}px Arial`;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 4;
  ctx.strokeText(score, W / 2, fs + 12);
  ctx.fillStyle   = '#222';
  ctx.fillText(score, W / 2, fs + 12);
}

// ── Death flash & particles ────────────────────────────────
let flashAlpha     = 0;
let deathParticles = [];

function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.fillStyle = `rgba(255,80,0,${flashAlpha})`;
  ctx.fillRect(0, 0, W, H);
  flashAlpha = Math.max(0, flashAlpha - 0.05);
}

function spawnDeathParticles() {
  const cx = bird.x + bird.w / 2, cy = bird.y + bird.h / 2;
  for (let i = 0; i < 32; i++) {
    const a = (Math.PI * 2 * i) / 32 + Math.random() * 0.3;
    const s = 2 + Math.random() * 6;
    deathParticles.push({
      x: cx, y: cy,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2,
      life: 1, r: 3 + Math.random() * 7,
      color: ['#f5c518','#ff8800','#ff4400','#fff','#ffcc00'][Math.floor(Math.random() * 5)],
    });
  }
}

function updateDeathParticles() {
  for (const p of deathParticles) {
    p.x += p.vx; p.y += p.vy; p.vy += 0.28; p.life -= 0.02;
  }
  deathParticles = deathParticles.filter(p => p.life > 0);
}

function drawDeathParticles() {
  for (const p of deathParticles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.shadowBlur  = 0;
}

// ── Input ──────────────────────────────────────────────────
let flapHeld = false;

function handleFlapDown() {
  flapHeld = true;
  if (state === STATE.IDLE)    { startGame(); return; }
  if (state === STATE.PLAYING) { bird.flap(); }
}
function handleFlapUp() { flapHeld = false; bird.releaseFlap(); }

document.addEventListener('keydown', (e) => {
  const k = e.code === 'Space' ? 'Space' : e.key;
  if (['Space', ' ', 'ArrowUp', 'w', 'W'].includes(k)) {
    e.preventDefault();
    if (!e.repeat) handleFlapDown();
  }
  if (e.key === 'p' || e.key === 'P') togglePause();
});
document.addEventListener('keyup', (e) => {
  const k = e.code === 'Space' ? 'Space' : e.key;
  if (['Space', ' ', 'ArrowUp', 'w', 'W'].includes(k)) handleFlapUp();
});
canvas.addEventListener('mousedown',  (e) => { e.preventDefault(); handleFlapDown(); });
canvas.addEventListener('mouseup',    (e) => { e.preventDefault(); handleFlapUp(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleFlapDown(); }, { passive: false });
canvas.addEventListener('touchend',   (e) => { e.preventDefault(); handleFlapUp();   }, { passive: false });

document.getElementById('startBtn').addEventListener('click',   (e) => { e.stopPropagation(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); startGame(); });

// ── Pause ──────────────────────────────────────────────────
function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
  } else if (state === STATE.PAUSED) {
    state    = STATE.PLAYING;
    lastTime = performance.now();
  }
}

// ── Game lifecycle ─────────────────────────────────────────
let lastTime    = 0;
let animFrameId = null;

function startGame() {
  score          = 0;
  firePairs      = [];
  deathParticles = [];
  lastFireTime   = 0;
  flashAlpha     = 0;
  idleT          = 0;
  bgX            = 0;

  bird.reset();
  bird.flap();

  updateScoreDisplay();
  document.getElementById('bestScore').textContent        = bestScore;
  document.getElementById('startScreen').style.display    = 'none';
  document.getElementById('gameOverScreen').style.display = 'none';

  state       = STATE.PLAYING;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  lastTime    = performance.now();
  animFrameId = requestAnimationFrame(loop);
}

function killBird() {
  state      = STATE.DEAD;
  flashAlpha = 0.9;
  spawnDeathParticles();
  saveBest();

  const deathSound = document.getElementById('deathSound');
  if (deathSound) {
    deathSound.currentTime = 0;
    deathSound.volume = 1;
    deathSound.play().catch((e) => { console.warn("Death audio play blocked or failed:", e); });
  }

  document.getElementById('finalScore').textContent   = score;
  document.getElementById('newBestLabel').textContent =
    score > 0 && score >= bestScore ? '🏆 New Best!' : '';
  document.getElementById('gameOverScreen').style.display = 'flex';

  cancelAnimationFrame(animFrameId);
  lastTime = performance.now();
  requestAnimationFrame(deathLoop);
}

function deathLoop(ts) {
  if (state !== STATE.DEAD) return;
  updateDeathParticles();
  flashAlpha = Math.max(0, flashAlpha - 0.05);
  drawBackground();
  drawFirePairs();
  drawGround();
  bird.draw();
  drawDeathParticles();
  drawFlash();
  if (deathParticles.length > 0 || flashAlpha > 0) requestAnimationFrame(deathLoop);
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font      = `bold ${Math.round(W * 0.08)}px Arial`;
  ctx.fillText('PAUSED', W / 2, H / 2 - 14);
  ctx.font      = `${Math.round(W * 0.035)}px Arial`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Press P to resume', W / 2, H / 2 + 26);
}

// ── Main loop ──────────────────────────────────────────────
function loop(ts) {
  if (state !== STATE.PLAYING && state !== STATE.PAUSED) return;
  const dt = ts - lastTime;
  lastTime = ts;

  if (state === STATE.PAUSED) {
    drawBackground(); drawFirePairs(); drawGround();
    bird.draw(); drawHUD(); drawPauseOverlay();
    animFrameId = requestAnimationFrame(loop);
    return;
  }

  if (flapHeld) bird.holding = true;

  updateBackground();
  updateFirePairs(dt);
  bird.update();

  // Ceiling
  if (bird.y < 0) { bird.y = 0; bird.vy = Math.max(0, bird.vy); }
  // Ground
  if (bird.y + bird.h >= H - GROUND_H) { bird.y = H - GROUND_H - bird.h; killBird(); return; }
  // Flame
  if (checkFireCollisions()) { killBird(); return; }

  drawBackground();
  drawFirePairs();
  drawGround();
  bird.draw();
  drawDeathParticles();
  drawHUD();
  drawFlash();

  animFrameId = requestAnimationFrame(loop);
}

// ── Idle loop ──────────────────────────────────────────────
let idleT = 0;
function idleLoop(ts) {
  if (state !== STATE.IDLE) return;
  idleT += 0.035;
  bird.y = H / 2 - 20 + Math.sin(idleT) * 10;
  drawBackground();
  updateBackground();
  drawGround();
  bird.draw();
  requestAnimationFrame(idleLoop);
}

// ── Init ───────────────────────────────────────────────────
resize();
document.getElementById('bestScore').textContent     = bestScore;
document.getElementById('startScreen').style.display = 'flex';
requestAnimationFrame(idleLoop);

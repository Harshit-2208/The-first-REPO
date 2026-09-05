// ── Game states ───────────────────────────────────────────
const STATE = { IDLE: 0, PLAYING: 1, DEAD: 2, PAUSED: 3, LEVELUP: 4 };
let state = STATE.IDLE;

// ── Canvas — full screen, resizes dynamically ─────────────
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

let W, H, GROUND_H, BIRD_X;

function resize() {
  W        = canvas.width  = window.innerWidth;
  H        = canvas.height = window.innerHeight;
  GROUND_H = Math.round(H * 0.12);
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

// ── Levels ────────────────────────────────────────────────
const SCORES_PER_LEVEL = 5;

const LEVELS = [
  {
    num: 1, name: 'Ember Cave',
    gapFraction: 0.38,
    fireInterval: 1900, fireSpeed: 2.0,   // -2 px/frame
    gravity: 0.32, flapStr: -7.0, maxFall: 8, holdBonus: -0.18,
    bgTop: '#1a0000', bgMid: '#2d0a00', bgBot: '#4a1500',
    lavaTop: '#cc3300', lavaMid: '#ff6600', lavaTip: '#ff8800',
    particleCount: 3, hueRange: [20, 40],
    medal: '🥉', desc: 'Welcome to the fire pits!',
  },
  {
    num: 2, name: 'Inferno Shaft',
    gapFraction: 0.34,
    fireInterval: 1650, fireSpeed: 2.3,   // ~-2.3 px/frame
    gravity: 0.35, flapStr: -7.5, maxFall: 8, holdBonus: -0.18,
    bgTop: '#1a0005', bgMid: '#3d0010', bgBot: '#5a001a',
    lavaTop: '#aa0033', lavaMid: '#ee1144', lavaTip: '#ff4488',
    particleCount: 4, hueRange: [0, 15],
    medal: '🥈', desc: 'The flames grow stronger…',
  },
  {
    num: 3, name: 'Magma Core',
    gapFraction: 0.30,
    fireInterval: 1420, fireSpeed: 2.6,   // ~-2.6 px/frame
    gravity: 0.38, flapStr: -8.0, maxFall: 8, holdBonus: -0.19,
    bgTop: '#000d1a', bgMid: '#001a3a', bgBot: '#00285a',
    lavaTop: '#0044aa', lavaMid: '#0077ff', lavaTip: '#44aaff',
    particleCount: 5, hueRange: [200, 220],
    medal: '🏅', desc: 'Blue fire — hotter than ever!',
  },
  {
    num: 4, name: 'Void Furnace',
    gapFraction: 0.27,
    fireInterval: 1200, fireSpeed: 2.8,   // ~-2.8 px/frame
    gravity: 0.42, flapStr: -8.5, maxFall: 8, holdBonus: -0.20,
    bgTop: '#0d0018', bgMid: '#200040', bgBot: '#380060',
    lavaTop: '#6600cc', lavaMid: '#9933ff', lavaTip: '#cc88ff',
    particleCount: 6, hueRange: [270, 290],
    medal: '🎖️', desc: 'Purple plasma — almost there!',
  },
  {
    num: 5, name: 'Hellfire Apex',
    gapFraction: 0.24,
    fireInterval: 1000, fireSpeed: 3.0,   // -3 px/frame (max)
    gravity: 0.46, flapStr: -9.0, maxFall: 8, holdBonus: -0.20,
    bgTop: '#000000', bgMid: '#111111', bgBot: '#222222',
    lavaTop: '#ffffff', lavaMid: '#aaaaaa', lavaTip: '#eeeeee',
    particleCount: 8, hueRange: [0, 360],
    medal: '🏆', desc: 'Maximum chaos. Good luck.',
  },
];

let currentLevel  = 0;
let levelUpTimer  = 0;
const LEVELUP_DUR = 2400;

function getLvl() { return LEVELS[Math.min(currentLevel, LEVELS.length - 1)]; }
function fireGap() { return (H - GROUND_H) * getLvl().gapFraction; }

// ── Bird image ────────────────────────────────────────────
const birdImg = new Image();
birdImg.src   = 'bird.png';

// ── Bird ──────────────────────────────────────────────────
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
    const lvl    = getLvl();
    this.vy      = lvl.flapStr;   // -7 to -9 px/frame upward impulse
    this.holding = true;
  },

  releaseFlap() { this.holding = false; },

  update() {
    const lvl = getLvl();
    // Extra lift while holding (small bonus, not doubling flap)
    if (this.holding && this.vy < 0) this.vy += lvl.holdBonus;
    // Gravity: 0.32–0.46 px/frame², terminal velocity capped at 8 px/frame
    this.vy  = Math.min(this.vy + lvl.gravity, lvl.maxFall);
    this.y  += this.vy;
    this.rot = Math.min(Math.max(this.vy * 3.5, -30), 85);
    const spd = this.vy < 0 ? 3 : 6;
    if (++this.wingTimer >= spd) { this.wingFrame = (this.wingFrame + 1) % 3; this.wingTimer = 0; }
  },

  draw() {
    ctx.save();
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate((this.rot * Math.PI) / 180);

    if (birdImg.complete && birdImg.naturalWidth > 0) {
      // Draw the custom image centered on the bird position
      // Add a subtle glow so it fits the fire theme
      ctx.shadowColor = '#ffaa00';
      ctx.shadowBlur  = 16;
      ctx.drawImage(birdImg, -this.w / 2, -this.h / 2, this.w, this.h);
      ctx.shadowBlur  = 0;
    } else {
      // Fallback yellow circle while image loads
      ctx.shadowColor = '#ffaa00'; ctx.shadowBlur = 14;
      ctx.fillStyle = '#f5c518';
      ctx.beginPath();
      ctx.ellipse(0, 0, this.w/2, this.h/2, 0, 0, Math.PI*2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  },

  hitbox() {
    const p = 7;
    return { x: this.x + p, y: this.y + p, w: this.w - p*2, h: this.h - p*2 };
  },
};

// ── Fire pairs ────────────────────────────────────────────
// Each pair: nozzles on left edge of the column at fp.x
// Top nozzle blows fire DOWN from gapY toward ground
// Bottom nozzle blows fire UP from (gapY + gap) toward ceiling
// Flames span the FULL distance so the entire zone except the gap is flame

let firePairs    = [];
let lastFireTime = 0;
const NOZZLE_W   = 64;
const NOZZLE_H   = 24;

function makeBlaster(x, y, dir) {
  // dir: 1 = downward (top blaster), -1 = upward (bottom blaster)
  return { x, y, dir, particles: [], timer: 0 };
}

function spawnFirePair() {
  const lvl    = getLvl();
  const gap    = fireGap();
  const playH  = H - GROUND_H;
  const minGapY = playH * 0.12;
  const maxGapY = playH - gap - playH * 0.12;
  const gapY    = minGapY + Math.random() * (maxGapY - minGapY);

  firePairs.push({
    x: W + 20,
    gapY,
    scored: false,
    // top nozzle sits at gapY, shoots DOWN  (fills 0 → gapY)
    topBlaster:    makeBlaster(W + 20, gapY, 1),
    // bottom nozzle sits at gapY+gap, shoots UP (fills gapY+gap → H-GROUND_H)
    bottomBlaster: makeBlaster(W + 20, gapY + gap, -1),
  });
}

function getFireHue() {
  const [lo, hi] = getLvl().hueRange;
  return lo + Math.random() * (hi - lo);
}

// ── Draw animated vertical flame tongues ──────────────────
// isTop=true  → flames hang DOWN from ceiling (y=0) toward gapY
// isTop=false → flames shoot UP from ground (H-GROUND_H) toward gapY+gap
function drawFlameWall(x, wallY, isTop, zoneH, hueRange, t) {
  if (zoneH <= 2) return;

  const [lo, hi] = hueRange;
  const cx = x + NOZZLE_W / 2;

  // Fixed boundary edges
  const boundaryY = isTop ? 0 : H - GROUND_H;

  const tongueCount  = 6;
  const tongueSpread = NOZZLE_W * 1.3;

  for (let ti = 0; ti < tongueCount; ti++) {
    const offset  = (ti / (tongueCount - 1) - 0.5) * tongueSpread;
    const tx      = cx + offset;
    const phase   = ti * 1.4 + t * (1.9 + ti * 0.35);
    const flicker = 0.70 + 0.30 * Math.sin(phase);

    // Tongue reaches from the hard boundary toward the gap edge
    // Height: 65–100% of the zone so it always touches the wall
    const height  = zoneH * (0.65 + 0.35 * flicker);

    // Base is always pinned to the wall boundary
    const baseY = boundaryY + (isTop ? 0 : 0); // top wall: base at 0; bottom wall: base at H-GROUND_H
    // Tip points toward the gap
    const tipY  = isTop
      ? baseY + height        // ceiling → tip points down
      : baseY - height;       // floor   → tip points up

    const tipX  = tx + Math.sin(phase * 1.7) * 7;
    const cp1x  = tx  + Math.sin(phase * 0.9 + 1) * 11;
    const cp1y  = isTop ? baseY + height * 0.30 : baseY - height * 0.30;
    const cp2x  = tipX + Math.sin(phase * 1.3 + 2) * 8;
    const cp2y  = isTop ? baseY + height * 0.68 : baseY - height * 0.68;

    // Outer flame
    const grad1 = ctx.createLinearGradient(tx, baseY, tipX, tipY);
    grad1.addColorStop(0,   `hsla(${lo}, 100%, 55%, 0.92)`);
    grad1.addColorStop(0.5, `hsla(${(lo+hi)/2}, 100%, 62%, 0.65)`);
    grad1.addColorStop(1,   `hsla(${hi}, 100%, 72%, 0)`);
    ctx.strokeStyle = grad1;
    ctx.lineWidth   = 16 * flicker;
    ctx.lineCap     = 'round';
    ctx.shadowColor = `hsla(${lo}, 100%, 50%, 0.7)`;
    ctx.shadowBlur  = 20;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tipX, tipY);
    ctx.stroke();

    // Middle yellow flame
    const grad2 = ctx.createLinearGradient(tx, baseY, tipX, tipY);
    grad2.addColorStop(0,   `hsla(40, 100%, 68%, 0.92)`);
    grad2.addColorStop(0.6, `hsla(50, 100%, 78%, 0.5)`);
    grad2.addColorStop(1,   `hsla(55, 100%, 92%, 0)`);
    ctx.strokeStyle = grad2;
    ctx.lineWidth   = 7 * flicker;
    ctx.shadowBlur  = 10;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tipX, tipY);
    ctx.stroke();

    // White-hot core
    ctx.strokeStyle = `rgba(255,255,230,${0.75 * flicker})`;
    ctx.lineWidth   = 2.5 * flicker;
    ctx.shadowBlur  = 6;
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, tipX, tipY);
    ctx.stroke();

    ctx.shadowBlur = 0;
  }
}

function updateBlaster(b, dt) {
  // No particles needed anymore — flames are purely procedural/drawn
  // Keep timer ticking for dt accumulation if needed elsewhere
  b.timer += dt;
}

function drawBlaster(b, isTop) {
  const lvl        = getLvl();
  const t          = performance.now() / 1000;

  // Zone: top blaster fills ceiling(0) → gapY; bottom fills gapY+gap → ground
  const boundaryY  = isTop ? 0 : H - GROUND_H;
  const zoneH      = isTop ? b.y : (H - GROUND_H) - b.y;

  // Animated vertical flame tongues anchored to the boundary
  drawFlameWall(b.x, boundaryY, isTop, zoneH, lvl.hueRange, t);

  // Nozzle body sits at the gap edge
  const ny   = isTop ? b.y - NOZZLE_H : b.y;
  const nGrd = ctx.createLinearGradient(b.x, ny, b.x + NOZZLE_W, ny);
  nGrd.addColorStop(0,    '#444');
  nGrd.addColorStop(0.45, '#888');
  nGrd.addColorStop(1,    '#2a2a2a');
  ctx.fillStyle = nGrd;
  ctx.beginPath();
  ctx.roundRect(b.x, ny, NOZZLE_W, NOZZLE_H, 5);
  ctx.fill();

  // Nozzle tip glow
  ctx.shadowColor = `hsla(${lvl.hueRange[0]},100%,55%,1)`;
  ctx.shadowBlur  = 22;
  ctx.fillStyle   = `hsla(${lvl.hueRange[0]},100%,45%,1)`;
  const tipCircY  = isTop ? ny + NOZZLE_H - 6 : ny + 4;
  ctx.beginPath();
  ctx.arc(b.x + NOZZLE_W - 8, tipCircY + (isTop ? 2 : 4), 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  // Rivets
  ctx.fillStyle = '#999';
  [10, 24, 40].forEach(rx => {
    ctx.beginPath();
    ctx.arc(b.x + rx, ny + NOZZLE_H / 2, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

function updateFirePairs(dt) {
  const lvl = getLvl();
  lastFireTime += dt;
  if (lastFireTime >= lvl.fireInterval) { spawnFirePair(); lastFireTime = 0; }

  for (const fp of firePairs) {
    fp.x              -= lvl.fireSpeed;
    fp.topBlaster.x    = fp.x;
    fp.bottomBlaster.x = fp.x;
    // Keep blaster y synced if screen was resized
    fp.topBlaster.y    = fp.gapY;
    fp.bottomBlaster.y = fp.gapY + fireGap();
    updateBlaster(fp.topBlaster,    dt);
    updateBlaster(fp.bottomBlaster, dt);
  }
  firePairs = firePairs.filter(fp => fp.x + NOZZLE_W + 200 > 0);
}

function drawFirePairs() {
  for (const fp of firePairs) {
    drawBlaster(fp.topBlaster,    true);
    drawBlaster(fp.bottomBlaster, false);
  }
}

function checkFireCollisions() {
  const hb  = bird.hitbox();
  const gap = fireGap();
  const lvl = getLvl();

  for (const fp of firePairs) {
    // Score
    if (!fp.scored && bird.x > fp.x + 30) {
      fp.scored = true; score++;
      updateScoreDisplay(); checkLevelUp(); saveBest();
    }

    // Collision: bird inside the nozzle x-range and outside the safe gap
    const inX = hb.x + hb.w > fp.x && hb.x < fp.x + NOZZLE_W;
    if (inX) {
      if (hb.y < fp.gapY)               return true;
      if (hb.y + hb.h > fp.gapY + gap)  return true;
    }
  }
  return false;
}

// ── Level up ──────────────────────────────────────────────
function checkLevelUp() {
  const idx = Math.min(Math.floor(score / SCORES_PER_LEVEL), LEVELS.length - 1);
  if (idx > currentLevel) { currentLevel = idx; triggerLevelUp(); }
}

function triggerLevelUp() {
  state = STATE.LEVELUP; levelUpTimer = LEVELUP_DUR;
  firePairs = []; lastFireTime = 0;
  cancelAnimationFrame(animFrameId);
  lastTime = performance.now();
  requestAnimationFrame(levelUpLoop);
}

function levelUpLoop(ts) {
  if (state !== STATE.LEVELUP) return;
  levelUpTimer -= ts - lastTime; lastTime = ts;
  updateBackground(1);
  drawBackground(); drawGround();
  bird.update();
  bird.y = Math.max(0, Math.min(H - GROUND_H - bird.h, bird.y));
  bird.draw();
  drawLevelUpOverlay(levelUpTimer / LEVELUP_DUR);
  if (levelUpTimer <= 0) {
    state = STATE.PLAYING; lastTime = performance.now();
    animFrameId = requestAnimationFrame(loop);
  } else {
    requestAnimationFrame(levelUpLoop);
  }
}

function drawLevelUpOverlay(progress) {
  const lvl   = getLvl();
  const alpha = Math.min(progress * 3, 1) * Math.min((1 - progress) * 3, 1);
  ctx.fillStyle = `rgba(0,0,0,${0.5 * alpha})`;
  ctx.fillRect(0, 0, W, H);

  const bw = Math.min(320, W * 0.8), bh = 150;
  const bx = (W - bw) / 2, by = (H - bh) / 2;
  ctx.fillStyle = `rgba(20,5,0,${0.88 * alpha})`;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 18); ctx.fill();
  ctx.strokeStyle = `rgba(255,150,0,${0.8 * alpha})`; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 18); ctx.stroke();

  ctx.globalAlpha = alpha; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(W * 0.038)}px Arial`; ctx.fillStyle = '#ffaa00';
  ctx.fillText('LEVEL UP!', W/2, by + 30);
  ctx.font = `bold ${Math.round(W * 0.064)}px Arial`; ctx.fillStyle = '#fff';
  ctx.fillText(`${lvl.medal} Level ${lvl.num}`, W/2, by + 72);
  ctx.font = `bold ${Math.round(W * 0.038)}px Arial`; ctx.fillStyle = '#ff8800';
  ctx.fillText(lvl.name, W/2, by + 100);
  ctx.font = `${Math.round(W * 0.030)}px Arial`; ctx.fillStyle = 'rgba(255,200,150,0.85)';
  ctx.fillText(lvl.desc, W/2, by + 126);
  ctx.globalAlpha = 1;
}

// ── Background ────────────────────────────────────────────
let bgX = 0;
const drips = Array.from({ length: 10 }, (_, i) => ({
  x: i * 55 + 15,
  len: 20 + Math.random() * 35,
  phase: Math.random() * Math.PI * 2,
}));

function updateBackground(dt) {
  bgX -= getLvl().fireSpeed;
  if (bgX <= -W) bgX = 0;
}

function drawBackground() {
  const lvl = getLvl();
  const sky = ctx.createLinearGradient(0, 0, 0, H - GROUND_H);
  sky.addColorStop(0, lvl.bgTop); sky.addColorStop(0.5, lvl.bgMid); sky.addColorStop(1, lvl.bgBot);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H - GROUND_H);

  // Ambient embers
  for (let i = 0; i < 8; i++) {
    const ex = ((i * 83 - bgX * 0.3) % W + W) % W;
    const ey = 80 + (i * 53 % (H - GROUND_H - 120));
    const eg = ctx.createRadialGradient(ex, ey, 0, ex, ey, 30);
    eg.addColorStop(0, `${lvl.lavaTip}28`); eg.addColorStop(1, `${lvl.lavaTip}00`);
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.arc(ex, ey, 30, 0, Math.PI * 2); ctx.fill();
  }

  // Ceiling drips
  const t = performance.now() / 1000;
  for (const d of drips) {
    const dx      = ((d.x - bgX * 0.8) % W + W) % W;
    const dripLen = d.len + Math.sin(t * 1.2 + d.phase) * 6;
    ctx.strokeStyle = lvl.lavaTop; ctx.lineWidth = 5;
    ctx.lineCap = 'round'; ctx.shadowColor = lvl.lavaMid; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.moveTo(dx, 0); ctx.lineTo(dx, dripLen); ctx.stroke();
    ctx.fillStyle = lvl.lavaTip;
    ctx.beginPath(); ctx.arc(dx, dripLen, 5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

function drawGround() {
  const lvl = getLvl();
  const gY  = H - GROUND_H;
  const lg  = ctx.createLinearGradient(0, gY, 0, H);
  lg.addColorStop(0, lvl.lavaTop); lg.addColorStop(0.4, lvl.lavaMid); lg.addColorStop(1, '#000');
  ctx.fillStyle = lg; ctx.fillRect(0, gY, W, GROUND_H);

  const t = performance.now() / 600;
  ctx.fillStyle = lvl.lavaTip;
  for (let i = 0; i < 14; i++) {
    const bx = ((i * 41 - bgX * 3) % W + W) % W;
    const by = gY + 8 + Math.sin(t + i * 0.9) * 5;
    ctx.beginPath(); ctx.arc(bx, by, 7 + Math.sin(t * 1.5 + i) * 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#3a1a00';
  for (let x = ((-bgX * 1.5) % 48 + 48) % 48 - 48; x < W + 48; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, gY); ctx.lineTo(x+10, gY-12); ctx.lineTo(x+20, gY-6);
    ctx.lineTo(x+30, gY-14); ctx.lineTo(x+48, gY); ctx.fill();
  }
  ctx.shadowColor = lvl.lavaMid; ctx.shadowBlur = 28;
  ctx.strokeStyle = lvl.lavaTip; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, gY); ctx.lineTo(W, gY); ctx.stroke();
  ctx.shadowBlur = 0;
}

// ── Score / HUD ───────────────────────────────────────────
let score     = 0;
let bestScore = parseInt(localStorage.getItem('flappyFireBest') || '0');

function updateScoreDisplay() {
  document.getElementById('score').textContent = score;
  const lvl      = getLvl();
  document.getElementById('levelDisplay').textContent = `Lv ${lvl.num}`;
  const progress = (score % SCORES_PER_LEVEL) / SCORES_PER_LEVEL;
  document.getElementById('levelBar').style.width = (progress * 100) + '%';
}

function saveBest() {
  if (score > bestScore) {
    bestScore = score;
    localStorage.setItem('flappyFireBest', bestScore);
    document.getElementById('bestScore').textContent = bestScore;
  }
}

function drawHUD() {
  const fs = Math.round(Math.min(W, H) * 0.072);
  ctx.textAlign   = 'center';
  ctx.font        = `bold ${fs}px Arial`;
  ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
  ctx.strokeText(score, W / 2, fs + 10);
  ctx.fillStyle   = '#fff';
  ctx.fillText(score, W / 2, fs + 10);

  const lvl = getLvl();
  const bs  = Math.round(Math.min(W, H) * 0.026);
  ctx.textAlign = 'right';
  ctx.font      = `bold ${bs}px Arial`;
  const lw = bs * 7;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(W - lw - 10, 12, lw, bs + 10);
  ctx.fillStyle = '#ffcc00';
  ctx.fillText(`${lvl.medal} Lv ${lvl.num}`, W - 14, 12 + bs);
}

// ── Death flash & particles ───────────────────────────────
let flashAlpha     = 0;
let deathParticles = [];

function drawFlash() {
  if (flashAlpha <= 0) return;
  ctx.fillStyle = `rgba(255,80,0,${flashAlpha})`;
  ctx.fillRect(0, 0, W, H);
  flashAlpha = Math.max(0, flashAlpha - 0.05);
}

function spawnDeathParticles() {
  const cx = bird.x + bird.w/2, cy = bird.y + bird.h/2;
  for (let i = 0; i < 32; i++) {
    const a = (Math.PI*2*i)/32 + Math.random()*0.3, s = 2 + Math.random()*6;
    deathParticles.push({
      x: cx, y: cy,
      vx: Math.cos(a)*s, vy: Math.sin(a)*s - 2,
      life: 1, r: 3 + Math.random()*7,
      color: ['#f5c518','#ff8800','#ff4400','#fff','#ffcc00'][Math.floor(Math.random()*5)],
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
    ctx.globalAlpha = p.life; ctx.fillStyle = p.color;
    ctx.shadowColor = p.color; ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.fill();
  }
  ctx.globalAlpha = 1; ctx.shadowBlur = 0;
}

// ── Input ─────────────────────────────────────────────────
let flapHeld = false;

function handleFlapDown() {
  flapHeld = true;
  if (state === STATE.IDLE)    { startGame(); return; }
  if (state === STATE.PLAYING || state === STATE.LEVELUP) bird.flap();
}
function handleFlapUp() { flapHeld = false; bird.releaseFlap(); }

document.addEventListener('keydown', (e) => {
  if (['Space',' ','ArrowUp','w','W'].includes(e.code === 'Space' ? 'Space' : e.key)) {
    e.preventDefault(); if (!e.repeat) handleFlapDown();
  }
  if (e.key === 'p' || e.key === 'P') togglePause();
});
document.addEventListener('keyup', (e) => {
  if (['Space',' ','ArrowUp','w','W'].includes(e.code === 'Space' ? 'Space' : e.key)) handleFlapUp();
});

canvas.addEventListener('mousedown',  (e) => { e.preventDefault(); handleFlapDown(); });
canvas.addEventListener('mouseup',    (e) => { e.preventDefault(); handleFlapUp(); });
canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleFlapDown(); }, { passive: false });
canvas.addEventListener('touchend',   (e) => { e.preventDefault(); handleFlapUp();   }, { passive: false });

document.getElementById('startBtn').addEventListener('click',   (e) => { e.stopPropagation(); startGame(); });
document.getElementById('restartBtn').addEventListener('click', (e) => { e.stopPropagation(); startGame(); });

// ── Pause ─────────────────────────────────────────────────
function togglePause() {
  if (state === STATE.PLAYING) {
    state = STATE.PAUSED;
  } else if (state === STATE.PAUSED) {
    state = STATE.PLAYING; lastTime = performance.now();
    requestAnimationFrame(loop);
  }
}

// ── Game lifecycle ────────────────────────────────────────
let lastTime    = 0;
let animFrameId = null;

function startGame() {
  score = 0; currentLevel = 0;
  firePairs = []; deathParticles = [];
  lastFireTime = 0; flashAlpha = 0; idleT = 0;
  bird.reset(); bird.flap();
  updateScoreDisplay();
  document.getElementById('bestScore').textContent        = bestScore;
  document.getElementById('startScreen').style.display    = 'none';
  document.getElementById('gameOverScreen').style.display = 'none';
  state = STATE.PLAYING;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  lastTime = performance.now();
  animFrameId = requestAnimationFrame(loop);
}

function killBird() {
  state = STATE.DEAD; flashAlpha = 0.9;
  spawnDeathParticles(); saveBest();
  const lvl = getLvl();
  document.getElementById('finalScore').textContent   = score;
  document.getElementById('finalLevel').textContent   = `${lvl.medal} ${lvl.name} (Lv ${lvl.num})`;
  document.getElementById('newBestLabel').textContent = score > 0 && score >= bestScore ? '🏆 New Best!' : '';
  document.getElementById('gameOverScreen').style.display = 'flex';
  cancelAnimationFrame(animFrameId);
  lastTime = performance.now();
  requestAnimationFrame(deathLoop);
}

function deathLoop(ts) {
  lastTime = ts;
  updateDeathParticles();
  flashAlpha = Math.max(0, flashAlpha - 0.05);
  drawBackground(); drawFirePairs(); drawGround(); bird.draw();
  drawDeathParticles(); drawFlash();
  if (deathParticles.length > 0 || flashAlpha > 0) requestAnimationFrame(deathLoop);
}

// ── Main loop ─────────────────────────────────────────────
function loop(ts) {
  if (state !== STATE.PLAYING && state !== STATE.PAUSED) return;
  const dt = ts - lastTime; lastTime = ts;

  if (state === STATE.PAUSED) {
    drawBackground(); drawFirePairs(); drawGround();
    bird.draw(); drawHUD(); drawPauseOverlay();
    animFrameId = requestAnimationFrame(loop);
    return;
  }

  if (flapHeld) bird.holding = true;

  updateBackground(dt); updateFirePairs(dt); bird.update();

  if (bird.y < 0)                       { bird.y = 0; bird.vy = Math.max(0, bird.vy); }
  if (bird.y + bird.h >= H - GROUND_H)  { bird.y = H - GROUND_H - bird.h; killBird(); return; }
  if (checkFireCollisions())             { killBird(); return; }

  drawBackground(); drawFirePairs(); drawGround();
  bird.draw(); drawDeathParticles(); drawHUD(); drawFlash();

  if (state === STATE.PAUSED) { drawPauseOverlay(); }
  animFrameId = requestAnimationFrame(loop);
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.52)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
  ctx.font = `bold ${Math.round(W * 0.08)}px Arial`;
  ctx.fillText('PAUSED', W/2, H/2 - 14);
  ctx.font = `${Math.round(W * 0.035)}px Arial`;
  ctx.fillStyle = 'rgba(255,255,255,0.65)';
  ctx.fillText('Press P to resume', W/2, H/2 + 26);
}

// ── Idle loop ─────────────────────────────────────────────
let idleT = 0;
function idleLoop(ts) {
  if (state !== STATE.IDLE) return;
  idleT += 0.035;
  bird.y = H / 2 - 20 + Math.sin(idleT) * 10;
  drawBackground(); updateBackground(1); drawGround(); bird.draw();
  requestAnimationFrame(idleLoop);
}

// ── Init ──────────────────────────────────────────────────
resize(); // set W/H first
document.getElementById('bestScore').textContent    = bestScore;
document.getElementById('levelDisplay').textContent = 'Lv 1';
document.getElementById('levelBar').style.width     = '0%';
document.getElementById('startScreen').style.display = 'flex';
requestAnimationFrame(idleLoop);

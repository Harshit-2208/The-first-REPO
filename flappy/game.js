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
    num: 1, name: 'Common Level',
    gapFraction: 0.30,
    fireInterval: 1500, fireSpeed: 2.5,   // -2.5 px/frame
    gravity: 0.4, flapStr: -8.0, maxFall: 8, holdBonus: -0.18,
    bgTop: '#ffffff', bgMid: '#ffffff', bgBot: '#ffffff',
    lavaTop: '#cc3300', lavaMid: '#ff6600', lavaTip: '#ff8800',
    particleCount: 5, hueRange: [20, 40],
    medal: '🏅', desc: 'Endless Run',
  }
];

function getLvl() { return LEVELS[0]; }
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

  update(dt) {
    const lvl = getLvl();
    const timeScale = (typeof dt === 'number' && dt > 0) ? (dt / (1000 / 60)) : 1;
    // Extra lift while holding (small bonus, not doubling flap)
    if (this.holding && this.vy < 0) this.vy += lvl.holdBonus * timeScale;
    // Gravity: 0.32–0.46 px/frame², terminal velocity capped at 8 px/frame
    this.vy  = Math.min(this.vy + lvl.gravity * timeScale, lvl.maxFall);
    this.y  += this.vy * timeScale;
    this.rot = Math.min(Math.max(this.vy * 3.5, -30), 85);
    const spd = this.vy < 0 ? 3 : 6;
    this.wingTimer += timeScale;
    if (this.wingTimer >= spd) { this.wingFrame = (this.wingFrame + 1) % 3; this.wingTimer = 0; }
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

function drawFlameWall(x, wallY, isTop, zoneH, hueRange, t) {
  if (zoneH <= 2) return;

  const cx = x + NOZZLE_W / 2;
  const boundaryY = isTop ? 0 : H - GROUND_H;

  ctx.globalCompositeOperation = 'lighter'; // Additive blending for realistic fire glow

  // 1. Draw the roaring, chaotic fire column using layered wavy polygons
  const layers = [
    { color: 'hsla(10, 100%, 40%, 0.4)', widthScale: 1.5, speed: 6, wobbleAmp: 18 },
    { color: 'hsla(25, 100%, 50%, 0.6)', widthScale: 1.1, speed: 8, wobbleAmp: 14 },
    { color: 'hsla(40, 100%, 65%, 0.8)', widthScale: 0.7, speed: 10, wobbleAmp: 9 },
    { color: 'rgba(255, 245, 230, 1)',   widthScale: 0.3, speed: 12, wobbleAmp: 4 },
  ];

  // Number of jagged segments (lower = sharper flames, higher = smoother waves)
  const steps = Math.max(6, Math.ceil(zoneH / 20));
  const yStep = zoneH / steps;

  for (let l = 0; l < layers.length; l++) {
    const layer = layers[l];
    ctx.fillStyle = layer.color;
    ctx.beginPath();

    // Left edge of the fire column
    for (let i = 0; i <= steps; i++) {
      const currentY = isTop ? boundaryY + i * yStep : boundaryY - i * yStep;
      const progress = i / steps; 
      
      const wiggleLeft = Math.sin(t * layer.speed + i * 0.9 + l) * layer.wobbleAmp 
                       + Math.sin(t * (layer.speed * 0.6) - i * 1.4) * (layer.wobbleAmp * 0.5);
                       
      const px = cx - (NOZZLE_W / 2 * layer.widthScale) + wiggleLeft;
      
      if (i === 0) ctx.moveTo(px, currentY);
      else ctx.lineTo(px, currentY);
    }
    
    // Right edge of the fire column (drawn in reverse to close the shape)
    for (let i = steps; i >= 0; i--) {
      const currentY = isTop ? boundaryY + i * yStep : boundaryY - i * yStep;
      
      const wiggleRight = Math.sin(t * layer.speed + i * 0.8 + l + 10) * layer.wobbleAmp 
                        + Math.sin(t * (layer.speed * 0.7) - i * 1.2) * (layer.wobbleAmp * 0.5);
                        
      const px = cx + (NOZZLE_W / 2 * layer.widthScale) + wiggleRight;
      ctx.lineTo(px, currentY);
    }
    
    ctx.closePath();
    ctx.fill();
  }

  // 2. Draw detached, licking flame wisps peeling off the sides
  for (let w = 0; w < 6; w++) {
    const wispT = t * 1.5 + w * 2.5;
    const progress = wispT % 1.0; // Wisps travel from base to nozzle
    const side = (w % 2 === 0) ? -1 : 1;
    const wispY = isTop ? boundaryY + zoneH * progress : boundaryY - zoneH * progress;
    const wispX = cx + side * (NOZZLE_W * 0.7) + Math.sin(wispT * 8) * 12;
    
    ctx.fillStyle = `hsla(25, 100%, 55%, ${1 - Math.pow(progress, 2)})`;
    ctx.beginPath();
    
    const wispBaseY = isTop ? wispY - 25 : wispY + 25;
    ctx.moveTo(wispX - side * 12, wispBaseY);
    ctx.lineTo(wispX + side * 12, wispBaseY);
    
    // Tip of wisp pointing towards nozzle
    const wispTipY = isTop ? wispY + 45 : wispY - 45;
    const wispTipX = wispX + Math.sin(wispT * 15) * 20;
    ctx.lineTo(wispTipX, wispTipY);
    ctx.fill();
  }

  // 3. Draw chaotic floating sparks/embers
  for (let si = 0; si < 12; si++) {
    const sparkT = t * (0.8 + (si % 4) * 0.3) + si * 3.1;
    const sparkLife = sparkT % 1.0; 
    const sparkX = cx + Math.sin(sparkT * 4 + si) * NOZZLE_W * 1.4;
    const sparkY = isTop ? boundaryY + zoneH * sparkLife : boundaryY - zoneH * sparkLife;
    const sparkSize = 5 * (1 - sparkLife) * (0.5 + 0.5 * Math.sin(sparkT * 20));
    
    ctx.fillStyle = `hsla(45, 100%, 70%, ${1 - sparkLife})`;
    ctx.beginPath();
    ctx.arc(sparkX, sparkY, sparkSize, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalCompositeOperation = 'source-over'; // restore default blend mode
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
  const timeScale = (typeof dt === 'number' && dt > 0) ? (dt / (1000 / 60)) : 1;
  lastFireTime += dt;
  if (lastFireTime >= lvl.fireInterval) { spawnFirePair(); lastFireTime = 0; }

  for (const fp of firePairs) {
    fp.x              -= lvl.fireSpeed * timeScale;
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
    if (!fp.scored && bird.x > fp.x + NOZZLE_W) {
      fp.scored = true; score++;
      updateScoreDisplay(); saveBest();
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



// ── Background ────────────────────────────────────────────
let bgX = 0;
const drips = Array.from({ length: 10 }, (_, i) => ({
  x: i * 55 + 15,
  len: 20 + Math.random() * 35,
  phase: Math.random() * Math.PI * 2,
}));

function updateBackground(dt) {
  const timeScale = (typeof dt === 'number' && dt > 0) ? (dt / (1000 / 60)) : 1;
  bgX -= getLvl().fireSpeed * timeScale;
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
  if (state === STATE.PLAYING) bird.flap();
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
  }
}

// ── Game lifecycle ────────────────────────────────────────
let lastTime    = 0;
let animFrameId = null;

function startGame() {
  score = 0;
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
  document.getElementById('finalScore').textContent   = score;
  document.getElementById('newBestLabel').textContent = score > 0 && score >= bestScore ? '🏆 New Best!' : '';
  document.getElementById('gameOverScreen').style.display = 'flex';
  cancelAnimationFrame(animFrameId);
  lastTime = performance.now();
  requestAnimationFrame(deathLoop);
}

function deathLoop(ts) {
  if (state !== STATE.DEAD) return;
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

  updateBackground(dt); updateFirePairs(dt); bird.update(dt);

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
document.getElementById('startScreen').style.display = 'flex';
requestAnimationFrame(idleLoop);

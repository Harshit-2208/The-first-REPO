const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');

// ── Constants ────────────────────────────────────────────
const PADDLE_W   = 10;
const PADDLE_H   = 80;
const BALL_R     = 8;
const WIN_SCORE  = 10;
const ACCEL      = 1.5;   // paddle acceleration per frame
const FRICTION   = 0.82;  // paddle deceleration factor

// ── Difficulty presets (AI speed, ball speed) ────────────
const DIFFICULTIES = {
  easy:   { aiSpeed: 2.8, ballSpeed: 4.5 },
  medium: { aiSpeed: 4.0, ballSpeed: 6.0 },
  hard:   { aiSpeed: 5.5, ballSpeed: 7.5 },
};
let difficulty = 'medium';

// ── Game state ───────────────────────────────────────────
let paused      = false;
let gameOver    = false;
let animFrameId = null;

// ── Paddles ──────────────────────────────────────────────
const player = {
  x: 20,
  y: canvas.height / 2 - PADDLE_H / 2,
  width: PADDLE_W,
  height: PADDLE_H,
  dy: 0,
};

const computer = {
  x: canvas.width - 20 - PADDLE_W,
  y: canvas.height / 2 - PADDLE_H / 2,
  width: PADDLE_W,
  height: PADDLE_H,
};

// ── Ball ─────────────────────────────────────────────────
const ball = {
  x: canvas.width / 2,
  y: canvas.height / 2,
  dx: 0,
  dy: 0,
  radius: BALL_R,
};

// ── Scores ───────────────────────────────────────────────
let playerScore   = 0;
let computerScore = 0;

// ── Input ─────────────────────────────────────────────────
const keys   = {};
let mouseY   = canvas.height / 2;
let touching = false;  // true while finger is on canvas

window.addEventListener('keydown', (e) => {
  keys[e.key] = true;

  // Spacebar = pause / resume
  if (e.key === ' ' || e.key === 'Spacebar') {
    e.preventDefault();
    togglePause();
  }
});
window.addEventListener('keyup', (e) => { keys[e.key] = false; });

document.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseY = e.clientY - rect.top;
  touching = false;
});

// Touch controls — drag finger to move paddle
canvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  touching = true;
  const rect = canvas.getBoundingClientRect();
  mouseY = e.touches[0].clientY - rect.top;
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  mouseY = e.touches[0].clientY - rect.top;
}, { passive: false });

canvas.addEventListener('touchend', () => { touching = false; });

// ── Difficulty UI ────────────────────────────────────────
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    difficulty = btn.dataset.diff;
    resetGame();
  });
});

// ── Pause button ─────────────────────────────────────────
document.getElementById('pauseBtn').addEventListener('click', togglePause);

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  document.getElementById('pauseBtn').textContent = paused ? '▶ Resume' : '⏸ Pause';
  if (!paused) gameLoop();
}

// ── Replay button ────────────────────────────────────────
document.getElementById('replayBtn').addEventListener('click', () => {
  document.getElementById('winnerScreen').style.display = 'none';
  resetGame();
});

// ── Reset ─────────────────────────────────────────────────
function resetGame() {
  playerScore   = 0;
  computerScore = 0;
  gameOver      = false;
  paused        = false;
  document.getElementById('pauseBtn').textContent = '⏸ Pause';
  document.getElementById('playerScore').textContent   = '0';
  document.getElementById('computerScore').textContent = '0';
  resetBall(1);

  if (animFrameId) cancelAnimationFrame(animFrameId);
  gameLoop();
}

function resetBall(direction) {
  ball.x  = canvas.width  / 2;
  ball.y  = canvas.height / 2;
  const { ballSpeed } = DIFFICULTIES[difficulty];
  const angle = (Math.random() * Math.PI / 3) - Math.PI / 6; // ±30°
  ball.dx = direction * ballSpeed * Math.cos(angle);
  ball.dy = ballSpeed * Math.sin(angle);

  // Reset paddles to center
  player.y   = canvas.height / 2 - PADDLE_H / 2;
  computer.y = canvas.height / 2 - PADDLE_H / 2;
  player.dy  = 0;
}

// ── Update player (acceleration-based) ──────────────────
function updatePlayer() {
  const targetY = mouseY - PADDLE_H / 2;

  if (keys['ArrowUp'] || keys['w'] || keys['W']) {
    player.dy -= ACCEL;
  } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
    player.dy += ACCEL;
  } else if (!touching) {
    // Mouse/touch: move toward cursor
    const center = player.y + PADDLE_H / 2;
    const dist   = mouseY - center;
    if (Math.abs(dist) > 4) {
      player.dy += Math.sign(dist) * ACCEL;
    } else {
      player.dy *= FRICTION;
    }
  }

  // Cap speed
  const maxSpeed = 9;
  player.dy = Math.max(-maxSpeed, Math.min(maxSpeed, player.dy));

  // Apply friction when no key held
  if (!keys['ArrowUp'] && !keys['w'] && !keys['W'] &&
      !keys['ArrowDown'] && !keys['s'] && !keys['S'] && !touching) {
    player.dy *= FRICTION;
  }

  player.y += player.dy;

  // Clamp to canvas
  player.y = Math.max(0, Math.min(canvas.height - PADDLE_H, player.y));
}

// ── Update AI ────────────────────────────────────────────
function updateComputer() {
  const { aiSpeed } = DIFFICULTIES[difficulty];
  const center = computer.y + PADDLE_H / 2;
  const diff   = ball.y - center;

  // Dead zone so AI isn't perfect
  const deadZone = difficulty === 'easy' ? 28 : difficulty === 'medium' ? 18 : 8;

  if (diff > deadZone) {
    computer.y += Math.min(aiSpeed, diff);
  } else if (diff < -deadZone) {
    computer.y -= Math.min(aiSpeed, -diff);
  }

  computer.y = Math.max(0, Math.min(canvas.height - PADDLE_H, computer.y));
}

// ── Update ball ──────────────────────────────────────────
function updateBall() {
  ball.x += ball.dx;
  ball.y += ball.dy;

  // Top / bottom walls
  if (ball.y - ball.radius < 0) {
    ball.y  = ball.radius;
    ball.dy = Math.abs(ball.dy);
  }
  if (ball.y + ball.radius > canvas.height) {
    ball.y  = canvas.height - ball.radius;
    ball.dy = -Math.abs(ball.dy);
  }

  // Player paddle collision
  if (
    ball.dx < 0 &&
    ball.x - ball.radius <= player.x + player.width &&
    ball.x - ball.radius >= player.x &&
    ball.y >= player.y - ball.radius &&
    ball.y <= player.y + PADDLE_H + ball.radius
  ) {
    reflectBall(player);
    ball.x = player.x + player.width + ball.radius; // push out
  }

  // Computer paddle collision
  if (
    ball.dx > 0 &&
    ball.x + ball.radius >= computer.x &&
    ball.x + ball.radius <= computer.x + computer.width &&
    ball.y >= computer.y - ball.radius &&
    ball.y <= computer.y + PADDLE_H + ball.radius
  ) {
    reflectBall(computer);
    ball.x = computer.x - ball.radius; // push out
  }

  // Scoring
  if (ball.x - ball.radius < 0) {
    computerScore++;
    updateScore();
    if (computerScore >= WIN_SCORE) { endGame('Computer'); return; }
    resetBall(1);
  } else if (ball.x + ball.radius > canvas.width) {
    playerScore++;
    updateScore();
    if (playerScore >= WIN_SCORE) { endGame('Player'); return; }
    resetBall(-1);
  }
}

// Reflect ball off a paddle with angle based on hit position
function reflectBall(paddle) {
  const hitPos    = (ball.y - (paddle.y + PADDLE_H / 2)) / (PADDLE_H / 2); // -1 to 1
  const maxAngle  = Math.PI / 3.5; // ~51°
  const angle     = hitPos * maxAngle;
  const { ballSpeed } = DIFFICULTIES[difficulty];

  // Gradually increase speed on each hit (capped)
  const currentSpeed = Math.sqrt(ball.dx ** 2 + ball.dy ** 2);
  const newSpeed     = Math.min(currentSpeed * 1.04, ballSpeed * 1.6);

  const dir  = paddle === player ? 1 : -1;
  ball.dx = dir * newSpeed * Math.cos(angle);
  ball.dy = newSpeed * Math.sin(angle);
}

function updateScore() {
  document.getElementById('playerScore').textContent   = playerScore;
  document.getElementById('computerScore').textContent = computerScore;
}

// ── Win screen ───────────────────────────────────────────
function endGame(winner) {
  gameOver = true;
  cancelAnimationFrame(animFrameId);
  document.getElementById('winnerText').textContent =
    winner === 'Player' ? '🎉 You Win!' : '💻 Computer Wins!';
  document.getElementById('winnerScreen').style.display = 'flex';
}

// ── Draw ──────────────────────────────────────────────────
function drawPaddle(paddle, color) {
  // Glow
  ctx.shadowColor = color;
  ctx.shadowBlur  = 14;
  ctx.fillStyle   = color;
  // Rounded rect
  const r = 4;
  ctx.beginPath();
  ctx.roundRect(paddle.x, paddle.y, paddle.width, paddle.height, r);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawBall() {
  ctx.shadowColor = '#ff6b6b';
  ctx.shadowBlur  = 16;
  ctx.fillStyle   = '#ff6b6b';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

function drawCenterLine() {
  ctx.strokeStyle = 'rgba(255,255,255,0.2)';
  ctx.setLineDash([12, 10]);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(canvas.width / 2, 0);
  ctx.lineTo(canvas.width / 2, canvas.height);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawPauseOverlay() {
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#fff';
  ctx.font      = 'bold 36px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2 - 10);
  ctx.font      = '16px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.fillText('Press SPACE or click Resume', canvas.width / 2, canvas.height / 2 + 26);
}

function draw() {
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawCenterLine();
  drawPaddle(player,   '#00ff88');
  drawPaddle(computer, '#ff6b6b');
  drawBall();

  if (paused) drawPauseOverlay();
}

// ── Game loop ────────────────────────────────────────────
function gameLoop() {
  if (paused || gameOver) return;
  updatePlayer();
  updateComputer();
  updateBall();
  draw();
  animFrameId = requestAnimationFrame(gameLoop);
}

// ── Start ─────────────────────────────────────────────────
resetBall(1);
gameLoop();

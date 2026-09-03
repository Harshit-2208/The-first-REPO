const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game objects
const paddleWidth = 10;
const paddleHeight = 80;
const ballSize = 8;

// Player paddle
const player = {
    x: 20,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    maxSpeed: 6
};

// Computer paddle
const computer = {
    x: canvas.width - 30,
    y: canvas.height / 2 - paddleHeight / 2,
    width: paddleWidth,
    height: paddleHeight,
    dy: 0,
    speed: 4.5
};

// Ball
const ball = {
    x: canvas.width / 2,
    y: canvas.height / 2,
    dx: 5,
    dy: 5,
    radius: ballSize,
    maxSpeed: 8
};

// Scores
let playerScore = 0;
let computerScore = 0;

// Input handling
const keys = {};
let mouseY = canvas.height / 2;

window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
});

window.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

document.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseY = e.clientY - rect.top;
});

// Update player paddle position
function updatePlayer() {
    const moveSpeed = 7;
    
    // Mouse control
    if (mouseY < player.y + paddleHeight / 2) {
        player.dy = -moveSpeed;
    } else if (mouseY > player.y + paddleHeight / 2) {
        player.dy = moveSpeed;
    } else {
        player.dy = 0;
    }

    // Arrow keys override mouse (for better control)
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        player.dy = -moveSpeed;
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        player.dy = moveSpeed;
    }

    player.y += player.dy;

    // Boundary collision for player
    if (player.y < 0) {
        player.y = 0;
    }
    if (player.y + paddleHeight > canvas.height) {
        player.y = canvas.height - paddleHeight;
    }
}

// Update computer paddle position (AI)
function updateComputer() {
    const computerCenter = computer.y + computer.height / 2;
    const difficulty = 0.7; // Reduces AI accuracy (0-1, lower = easier)

    if (computerCenter < ball.y - 35) {
        computer.y += computer.speed * difficulty;
    } else if (computerCenter > ball.y + 35) {
        computer.y -= computer.speed * difficulty;
    }

    // Boundary collision for computer
    if (computer.y < 0) {
        computer.y = 0;
    }
    if (computer.y + computer.height > canvas.height) {
        computer.y = canvas.height - computer.height;
    }
}

// Update ball position
function updateBall() {
    ball.x += ball.dx;
    ball.y += ball.dy;

    // Ball collision with top and bottom walls
    if (ball.y - ball.radius < 0 || ball.y + ball.radius > canvas.height) {
        ball.dy = -ball.dy;
        ball.y = Math.max(ball.radius, Math.min(canvas.height - ball.radius, ball.y));
    }

    // Ball collision with paddles
    if (
        ball.x - ball.radius < player.x + player.width &&
        ball.y > player.y &&
        ball.y < player.y + player.height
    ) {
        ball.dx = -ball.dx;
        ball.x = player.x + player.width + ball.radius;
        
        // Add spin based on paddle movement
        const deltaY = ball.y - (player.y + player.height / 2);
        ball.dy += deltaY * 0.1;
    }

    if (
        ball.x + ball.radius > computer.x &&
        ball.y > computer.y &&
        ball.y < computer.y + computer.height
    ) {
        ball.dx = -ball.dx;
        ball.x = computer.x - ball.radius;
        
        // Add spin based on paddle movement
        const deltaY = ball.y - (computer.y + computer.height / 2);
        ball.dy += deltaY * 0.1;
    }

    // Ball out of bounds - scoring
    if (ball.x - ball.radius < 0) {
        computerScore++;
        resetBall();
    } else if (ball.x + ball.radius > canvas.width) {
        playerScore++;
        resetBall();
    }

    // Update score display
    document.getElementById('playerScore').textContent = playerScore;
    document.getElementById('computerScore').textContent = computerScore;

    // Limit ball speed
    const speed = Math.sqrt(ball.dx ** 2 + ball.dy ** 2);
    if (speed > ball.maxSpeed) {
        ball.dx = (ball.dx / speed) * ball.maxSpeed;
        ball.dy = (ball.dy / speed) * ball.maxSpeed;
    }
}

// Reset ball to center
function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;
    
    // Random direction
    ball.dx = (Math.random() > 0.5 ? 1 : -1) * 5;
    ball.dy = (Math.random() - 0.5) * 6;
}

// Draw functions
function drawPaddle(paddle) {
    ctx.fillStyle = '#00ff88';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.shadowColor = 'rgba(0, 255, 136, 0.8)';
    ctx.shadowBlur = 10;
}

function drawBall() {
    ctx.fillStyle = '#ff6b6b';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = 'rgba(255, 107, 107, 0.8)';
    ctx.shadowBlur = 10;
}

function drawCenterLine() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(canvas.width / 2, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
}

function draw() {
    // Clear canvas
    ctx.fillStyle = '#1a1a2e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.shadowColor = 'transparent';

    // Draw game elements
    drawCenterLine();
    drawPaddle(player);
    drawPaddle(computer);
    drawBall();
}

// Game loop
function gameLoop() {
    updatePlayer();
    updateComputer();
    updateBall();
    draw();
    requestAnimationFrame(gameLoop);
}

// Start the game
resetBall();
gameLoop();
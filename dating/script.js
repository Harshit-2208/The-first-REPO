// ── Floating Hearts Background ───────────────────────────
const heartEmojis = ['💕', '💖', '💗', '💓', '💞', '🌸', '✨', '💫', '🌷', '💝'];

function spawnHeart() {
  const container = document.getElementById('heartsBg');
  const heart = document.createElement('div');
  heart.className = 'heart-particle';
  heart.textContent = heartEmojis[Math.floor(Math.random() * heartEmojis.length)];
  heart.style.left = Math.random() * 100 + 'vw';
  heart.style.fontSize = (0.9 + Math.random() * 1.4) + 'rem';
  const duration = 6 + Math.random() * 8;
  heart.style.animationDuration = duration + 's';
  heart.style.animationDelay = Math.random() * 4 + 's';
  container.appendChild(heart);

  // Remove after animation completes to avoid DOM bloat
  setTimeout(() => heart.remove(), (duration + 4) * 1000);
}

// Seed initial hearts then keep spawning
for (let i = 0; i < 18; i++) spawnHeart();
setInterval(spawnHeart, 900);


// ── No Button — shows gun popup immediately ───────────────
function handleNo() {
  showModal('noModal');
}


// ── YES Button — open form first ─────────────────────────
function handleYes() {
  // Set today as minimum selectable date
  const dateInput = document.getElementById('dateInput');
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;

  showModal('formModal');
}

// ── Form Submit ───────────────────────────────────────────
function handleFormSubmit(e) {
  e.preventDefault();

  const name     = document.getElementById('girlName').value.trim();
  const date     = document.getElementById('dateInput').value;
  const time     = document.getElementById('timeInput').value;
  const location = document.getElementById('locationInput').value.trim();

  // Format date nicely
  const dateObj = new Date(date + 'T00:00:00');
  const formattedDate = dateObj.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  // Format time nicely
  const [h, m] = time.split(':');
  const hour = parseInt(h);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const formattedTime = `${hour % 12 || 12}:${m} ${ampm}`;

  // Build the summary card inside the yes modal
  document.getElementById('dateSummary').innerHTML = `
    <div class="summary-row"><span class="summary-icon">👩</span><span><strong>${name}</strong></span></div>
    <div class="summary-row"><span class="summary-icon">📅</span><span>${formattedDate}</span></div>
    <div class="summary-row"><span class="summary-icon">⏰</span><span>${formattedTime}</span></div>
    <div class="summary-row"><span class="summary-icon">📍</span><span>${location}</span></div>
  `;

  closeModal('formModal');
  setTimeout(() => {
    spawnConfetti();
    showModal('yesModal');
    updateInviteUrlDisplay();
    updateQuestion('🥳', `Can't wait, ${name}! 💖`);
  }, 200);
}

function handleYesFromNo() {
  closeModal('noModal');
  setTimeout(() => {
    handleYes();
  }, 200);
}

function handleStillNo() {
  closeModal('noModal');
  setTimeout(() => {
    showModal('regretModal');
    updateQuestion('😭', 'Fine… your loss 💔');

    // Autoplay at full volume
    const video = document.getElementById('memeVideo');
    video.volume = 1;
    video.currentTime = 0;
    video.play();
  }, 200);
}

// ── Close regret modal and stop video ────────────────────
function closeRegretModal() {
  const video = document.getElementById('memeVideo');
  video.pause();
  video.currentTime = 0;
  closeModal('regretModal');
}


// ── Question text update ──────────────────────────────────
function updateQuestion(emoji, text) {
  document.getElementById('questionEmoji').textContent = emoji;
  document.getElementById('questionText').textContent  = text;
}


// ── Modal helpers ─────────────────────────────────────────
function showModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.add('active');
  // Prevent background scroll
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  const overlay = document.getElementById(id);
  overlay.classList.remove('active');
  document.body.style.overflow = '';
}

// Close modal when clicking the dark overlay
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', function (e) {
    if (e.target !== this) return;
    if (this.id === 'regretModal') {
      const video = document.getElementById('memeVideo');
      video.pause();
      video.currentTime = 0;
    }
    closeModal(this.id);
  });
});


// ── Confetti Burst ────────────────────────────────────────
const confettiEmojis = ['🎉', '🎊', '💕', '✨', '🌸', '💖', '🌷', '🎆', '⭐', '💫'];

function spawnConfetti() {
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.textContent = confettiEmojis[Math.floor(Math.random() * confettiEmojis.length)];
      piece.style.left   = Math.random() * 100 + 'vw';
      piece.style.top    = '-40px';
      piece.style.fontSize = (1 + Math.random() * 1.2) + 'rem';
      piece.style.animationDuration = (1 + Math.random() * 1.2) + 's';
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 2500);
    }, i * 60);
  }
}


// ── Share / Invite Link ───────────────────────────────────
// Always reflects the actual current page URL so it works on any host
function getInviteUrl() {
  return window.location.href;
}

function updateInviteUrlDisplay() {
  document.getElementById('inviteUrl').textContent = getInviteUrl();
}

function copyInviteLink() {
  const url = getInviteUrl();
  navigator.clipboard.writeText(url).then(() => {
    showToast('✅ Link copied to clipboard!');
    const btn = document.getElementById('copyBtn');
    btn.textContent = '✅';
    setTimeout(() => { btn.textContent = '📋'; }, 2000);
  }).catch(() => {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = url;
    el.style.position = 'fixed';
    el.style.opacity  = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('✅ Link copied to clipboard!');
  });
}

function shareWhatsApp() {
  const name     = document.getElementById('girlName').value.trim() || 'you';
  const url      = getInviteUrl();
  const message  = encodeURIComponent(`Hey ${name}! 💕 You've been invited on a special date 🌹 Open this link: ${url}`);
  window.open(`https://wa.me/?text=${message}`, '_blank');
}

function shareEmail() {
  const name     = document.getElementById('girlName').value.trim() || 'you';
  const url      = getInviteUrl();
  const subject  = encodeURIComponent(`💌 A Special Date Invitation Just for You, ${name}!`);
  const body     = encodeURIComponent(`Hey ${name}! 💕\n\nYou've been invited on a very special date 🌹\n\nOpen this link to see the details:\n${url}\n\nCan't wait! 💖`);
  window.open(`mailto:?subject=${subject}&body=${body}`);
}

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}
function resetPage() {
  // Clear the form
  document.getElementById('dateForm').reset();
  document.getElementById('dateSummary').innerHTML = '';

  // Reset question
  updateQuestion('🥺', 'Will you go on a date with me?');

  // Reset hint
  document.getElementById('hintText').textContent = 'Click Yes to make me smile 💕';

  // Open the form to try again
  handleYes();
}


// ── Keyboard shortcut: Enter = Yes ───────────────────────
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleYes();
  if (e.key === 'Escape') {
    const video = document.getElementById('memeVideo');
    video.pause();
    video.currentTime = 0;
    ['yesModal', 'noModal', 'regretModal', 'formModal'].forEach(closeModal);
  }
});

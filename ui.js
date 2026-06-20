/**
 * UI MODULE
 * Wires the start overlay, variant switcher, demo hint, and the
 * (client-side only, no backend) lead form.
 */
(function () {
  const AS = window.AirShowcase;

  const startBtn = document.getElementById('startBtn');
  const heroStartBtn = document.getElementById('heroStartBtn');
  const startOverlay = document.getElementById('startOverlay');
  const hud = document.getElementById('hud');
  const variants = document.getElementById('variants');
  const demoHint = document.getElementById('demoHint');
  const demoStage = document.querySelector('.demo-stage');

  function activateDemo() {
    startOverlay.classList.add('hidden');
    hud.classList.remove('hidden');
    variants.classList.remove('hidden');
    demoHint.classList.remove('hidden');

    AS.initHandTracking();
    AS.startRenderLoop();

    // Hide the hint after a while so it doesn't clutter once people get it
    setTimeout(() => demoHint.classList.add('hidden'), 9000);
  }

  startBtn.addEventListener('click', activateDemo, { once: true });

  // The hero CTA scrolls to the demo and, if not yet started, triggers it
  heroStartBtn.addEventListener('click', () => {
    demoStage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (!startOverlay.classList.contains('hidden')) {
      // small delay so the scroll lands before camera permission prompt
      setTimeout(() => startBtn.click(), 500);
    }
  });

  // Variant switcher buttons
  document.querySelectorAll('.variant-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.variant-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      AS.setVariant(btn.getAttribute('data-variant'));
    });
  });

  // Keep variant buttons in sync if a pinch-lock happens
  AS.onVariantLocked = function (variant) {
    document.querySelectorAll('.variant-btn').forEach((b) => {
      b.classList.toggle('active', b.getAttribute('data-variant') === variant);
    });
  };

  // ---- Lead form (front-end only demo — no backend wired up) ----
  const bookForm = document.getElementById('bookForm');
  const formNote = document.getElementById('formNote');

  bookForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(bookForm);
    const name = (data.get('name') || '').toString().trim();

    // This is a static front-end demo: no server endpoint is wired up yet.
    // Replace this block with a fetch() to your form backend / mailer of choice.
    formNote.textContent = `Thanks${name ? ', ' + name : ''} — this demo form isn't connected to an inbox yet. Wire it to your email service or a form backend to go live.`;
    bookForm.reset();
  });
})();

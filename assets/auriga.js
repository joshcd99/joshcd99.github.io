// Shared starfield background: used by all pages.
(function () {
  const canvas = document.getElementById('stars-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = Math.max(window.innerHeight, document.body.scrollHeight || 0);
  }
  function initStars(n) {
    n = n || Math.min(320, Math.floor((canvas.width * canvas.height) / 6500));
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.2,
      a: Math.random() * 0.7 + 0.2,
      da: (Math.random() - 0.5) * 0.003,
    }));
  }
  function drawStars() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.a += s.da;
      if (s.a > 0.9 || s.a < 0.1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,220,255,' + s.a + ')';
      ctx.fill();
    }
    requestAnimationFrame(drawStars);
  }
  resize();
  initStars();
  drawStars();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { resize(); initStars(); }, 100);
  });

  // Re-extend canvas height after layout settles (handles scroll pages).
  window.addEventListener('load', () => { resize(); initStars(); });
})();

document.addEventListener('DOMContentLoaded', () => {
  const observer = new IntersectionObserver(
    (entries) => entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.opacity = '1';
        e.target.style.transform = 'translateY(0)';
      }
    }),
    { threshold: 0.15 }
  );

  document.querySelectorAll('.skill-card, .contact-card, .about-grid').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(24px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    observer.observe(el);
  });

  /* ── TETRIS ── */
  const COLS = 10, ROWS = 20, BLOCK = 20;
  const COLORS = ['', '#58a6ff','#3fb950','#f78166','#d2a8ff','#ffa657','#79c0ff','#56d364'];

  const PIECES = [
    [],
    [[1,1,1,1]],
    [[2,2],[2,2]],
    [[0,3,0],[3,3,3]],
    [[0,4,4],[4,4,0]],
    [[5,5,0],[0,5,5]],
    [[6,0,0],[6,6,6]],
    [[0,0,7],[7,7,7]],
  ];

  const modal   = document.getElementById('tetris-modal');
  const canvas  = document.getElementById('tetris-canvas');
  const ctx     = canvas.getContext('2d');
  const nextCvs = document.getElementById('tetris-next');
  const nCtx    = nextCvs.getContext('2d');
  const scoreEl = document.getElementById('tetris-score');
  const levelEl = document.getElementById('tetris-level');
  const msgEl   = document.getElementById('tetris-message');

  let board, piece, next, score, level, lines, paused, over, rafId, lastTime, dropInterval;

  function newBoard() {
    return Array.from({length: ROWS}, () => Array(COLS).fill(0));
  }

  function randPiece() {
    const idx = Math.floor(Math.random() * 7) + 1;
    const shape = PIECES[idx].map(r => [...r]);
    return { shape, color: idx, x: Math.floor(COLS/2) - Math.floor(shape[0].length/2), y: 0 };
  }

  function init() {
    board = newBoard();
    score = 0; level = 1; lines = 0;
    paused = false; over = false;
    dropInterval = 800;
    lastTime = 0;
    piece = randPiece();
    next  = randPiece();
    scoreEl.textContent = '0';
    levelEl.textContent = '1';
    msgEl.textContent   = '';
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(loop);
  }

  function rotate(shape) {
    const rows = shape.length, cols = shape[0].length;
    return Array.from({length: cols}, (_, c) =>
      Array.from({length: rows}, (_, r) => shape[rows - 1 - r][c])
    );
  }

  function valid(shape, ox, oy) {
    return shape.every((row, r) =>
      row.every((v, c) => {
        if (!v) return true;
        const nx = ox + c, ny = oy + r;
        return nx >= 0 && nx < COLS && ny < ROWS && (ny < 0 || !board[ny][nx]);
      })
    );
  }

  function place() {
    piece.shape.forEach((row, r) =>
      row.forEach((v, c) => {
        if (v && piece.y + r >= 0) board[piece.y + r][piece.x + c] = piece.color;
      })
    );
    clearLines();
    piece = next;
    next  = randPiece();
    if (!valid(piece.shape, piece.x, piece.y)) {
      over = true;
      msgEl.textContent = 'GAME OVER';
      cancelAnimationFrame(rafId);
    }
  }

  function clearLines() {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r].every(v => v)) {
        board.splice(r, 1);
        board.unshift(Array(COLS).fill(0));
        cleared++; r++;
      }
    }
    if (!cleared) return;
    lines += cleared;
    const pts = [0, 100, 300, 500, 800];
    score += (pts[cleared] || 800) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 800 - (level - 1) * 70);
    scoreEl.textContent = score;
    levelEl.textContent = level;
  }

  function ghostY() {
    let gy = piece.y;
    while (valid(piece.shape, piece.x, gy + 1)) gy++;
    return gy;
  }

  function drawBlock(context, x, y, color, alpha = 1) {
    context.globalAlpha = alpha;
    context.fillStyle = color;
    context.fillRect(x * BLOCK + 1, y * BLOCK + 1, BLOCK - 2, BLOCK - 2);
    context.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#f4f6fb';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // grid
    ctx.strokeStyle = 'rgba(180,190,210,0.5)';
    ctx.lineWidth = 0.5;
    for (let r = 0; r < ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r*BLOCK); ctx.lineTo(canvas.width, r*BLOCK); ctx.stroke();
    }
    for (let c = 0; c < COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c*BLOCK, 0); ctx.lineTo(c*BLOCK, canvas.height); ctx.stroke();
    }

    // board
    board.forEach((row, r) => row.forEach((v, c) => {
      if (v) drawBlock(ctx, c, r, COLORS[v]);
    }));

    // ghost
    const gy = ghostY();
    piece.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) drawBlock(ctx, piece.x + c, gy + r, COLORS[piece.color], 0.2);
    }));

    // active piece
    piece.shape.forEach((row, r) => row.forEach((v, c) => {
      if (v) drawBlock(ctx, piece.x + c, piece.y + r, COLORS[piece.color]);
    }));

    // next
    nCtx.clearRect(0, 0, nextCvs.width, nextCvs.height);
    nCtx.fillStyle = '#eceef5';
    nCtx.fillRect(0, 0, nextCvs.width, nextCvs.height);
    const ns = next.shape;
    const ox = Math.floor((4 - ns[0].length) / 2);
    const oy = Math.floor((4 - ns.length) / 2);
    ns.forEach((row, r) => row.forEach((v, c) => {
      if (v) drawBlock(nCtx, ox + c, oy + r, COLORS[next.color]);
    }));
  }

  function loop(ts) {
    if (paused || over) return;
    if (ts - lastTime > dropInterval) {
      if (valid(piece.shape, piece.x, piece.y + 1)) piece.y++;
      else place();
      lastTime = ts;
    }
    draw();
    rafId = requestAnimationFrame(loop);
  }

  document.getElementById('tetris-btn').addEventListener('click', e => {
    e.preventDefault();
    modal.classList.add('active');
    init();
  });

  document.getElementById('tetris-close').addEventListener('click', () => {
    modal.classList.remove('active');
    cancelAnimationFrame(rafId);
  });

  document.getElementById('tetris-restart').addEventListener('click', init);

  modal.addEventListener('click', e => {
    if (e.target === modal) {
      modal.classList.remove('active');
      cancelAnimationFrame(rafId);
    }
  });

  document.addEventListener('keydown', e => {
    if (!modal.classList.contains('active') || over) return;
    if (e.key === 'p' || e.key === 'P') {
      paused = !paused;
      msgEl.textContent = paused ? 'PAUSED' : '';
      if (!paused) { lastTime = performance.now(); rafId = requestAnimationFrame(loop); }
      return;
    }
    if (paused) return;
    switch (e.key) {
      case 'ArrowLeft':
        if (valid(piece.shape, piece.x - 1, piece.y)) piece.x--;
        break;
      case 'ArrowRight':
        if (valid(piece.shape, piece.x + 1, piece.y)) piece.x++;
        break;
      case 'ArrowDown':
        if (valid(piece.shape, piece.x, piece.y + 1)) piece.y++;
        else place();
        lastTime = performance.now();
        break;
      case 'ArrowUp': {
        const rot = rotate(piece.shape);
        if (valid(rot, piece.x, piece.y)) piece.shape = rot;
        break;
      }
      case ' ': {
        piece.y = ghostY();
        place();
        lastTime = performance.now();
        e.preventDefault();
        break;
      }
    }
    draw();
  });
});

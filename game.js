'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#7986cb', // J - indigo
  '#ffb74d', // L - orange
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');

let board, current, next, score, lines, level, paused, gameOver, lastTime, dropAccum, dropInterval, animId;

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  const linesBefore = lines;
  merge();
  clearLines();
  trackCombo(lines - linesBefore);
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const color = COLORS[colorIndex];
  context.globalAlpha = alpha ?? 1;
  context.fillStyle = color;
  context.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
  // highlight
  context.fillStyle = 'rgba(255,255,255,0.12)';
  context.fillRect(x * size + 1, y * size + 1, size - 2, 4);
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = '#22222e';
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  if (gameOver) return;
  gameOver = true;
  cancelAnimationFrame(animId);
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;
  overlay.classList.remove('hidden');
  showGameOverRecords();
}

function togglePause() {
  if (gameOver) return;
  paused = !paused;
  if (!paused) {
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    overlayTitle.textContent = 'PAUSA';
    overlayScore.textContent = '';
    overlay.classList.remove('hidden');
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  board = createBoard();
  score = 0;
  lines = 0;
  level = 1;
  paused = false;
  gameOver = false;
  dropInterval = 1000;
  dropAccum = 0;
  resetCombo();
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  hideGameOverRecords();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (isTypingTarget(e.target) || !gameStarted) return;
  if (e.code === 'KeyP') { togglePause(); return; }
  if (paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', init);

// ---- High scores ----
// Storage layout:
//   tetris.highscores -> top 5 entries [{ name, score, lines, maxCombo, date }], sorted desc by score
//   tetris.bests      -> { maxCombo, maxLines } across ALL finished games (not only top 5)
//   tetris.lastName   -> last name entered, used as default in the input
// Combo: consecutive piece locks that clear at least one line.

const HS_KEY = 'tetris.highscores';
const BESTS_KEY = 'tetris.bests';
const LAST_NAME_KEY = 'tetris.lastName';
const HS_MAX = 5;
const NAME_MAX = 12;

const startScreen = document.getElementById('start-screen');
const playBtn = document.getElementById('play-btn');
const startTableBody = document.getElementById('start-hs-body');
const startBests = document.getElementById('start-bests');
const startResetBtn = document.getElementById('start-reset-btn');
const goRecords = document.getElementById('go-records');
const goTableBody = document.getElementById('go-hs-body');
const goBests = document.getElementById('go-bests');
const goResetBtn = document.getElementById('go-reset-btn');
const newRecordForm = document.getElementById('new-record-form');
const nameInput = document.getElementById('name-input');

let combo = 0;
let maxCombo = 0;
let gameStarted = false;
let pendingRecord = false;

function storageGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    // Storage unavailable or full: records are simply not persisted.
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (err) {
    // Ignore.
  }
}

function toCount(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function loadHighScores() {
  const data = storageGet(HS_KEY);
  if (!Array.isArray(data)) return [];
  return data
    .filter(e => e && typeof e === 'object')
    .map(e => ({
      name: String(e.name ?? '').slice(0, NAME_MAX) || '---',
      score: toCount(e.score),
      lines: toCount(e.lines),
      maxCombo: toCount(e.maxCombo),
      date: typeof e.date === 'string' ? e.date : '',
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, HS_MAX);
}

function loadBests() {
  const data = storageGet(BESTS_KEY);
  const bests = {
    maxCombo: toCount(data && data.maxCombo),
    maxLines: toCount(data && data.maxLines),
  };
  // Saved entries also count, in case the bests key is missing.
  for (const e of loadHighScores()) {
    bests.maxCombo = Math.max(bests.maxCombo, e.maxCombo);
    bests.maxLines = Math.max(bests.maxLines, e.lines);
  }
  return bests;
}

function qualifiesForTop(value) {
  if (value <= 0) return false;
  const list = loadHighScores();
  return list.length < HS_MAX || value > list[list.length - 1].score;
}

function saveHighScore(entry) {
  const list = loadHighScores();
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  const top = list.slice(0, HS_MAX);
  storageSet(HS_KEY, top);
  return top.indexOf(entry);
}

function updateBests() {
  const bests = loadBests();
  storageSet(BESTS_KEY, {
    maxCombo: Math.max(bests.maxCombo, maxCombo),
    maxLines: Math.max(bests.maxLines, lines),
  });
}

function resetCombo() {
  combo = 0;
  maxCombo = 0;
}

function trackCombo(cleared) {
  combo = cleared > 0 ? combo + 1 : 0;
  if (combo > maxCombo) maxCombo = combo;
}

function renderRecords(tbody, bestsEl, highlightIdx) {
  const list = loadHighScores();
  tbody.replaceChildren();
  if (!list.length) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 5;
    td.className = 'hs-empty';
    td.textContent = 'Sin récords todavía';
    tr.appendChild(td);
    tbody.appendChild(tr);
  }
  list.forEach((e, i) => {
    const tr = document.createElement('tr');
    if (i === highlightIdx) tr.className = 'hs-highlight';
    const cells = [i + 1, e.name, e.score.toLocaleString(), e.lines, e.maxCombo];
    for (const value of cells) {
      const td = document.createElement('td');
      td.textContent = value; // textContent only: names are user input
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  });
  const bests = loadBests();
  bestsEl.textContent = `Mejor combo: ${bests.maxCombo} · Líneas máx.: ${bests.maxLines}`;
}

function showGameOverRecords() {
  updateBests();
  pendingRecord = qualifiesForTop(score);
  newRecordForm.classList.toggle('hidden', !pendingRecord);
  goRecords.classList.remove('hidden');
  renderRecords(goTableBody, goBests, -1);
  if (pendingRecord) {
    nameInput.value = String(storageGet(LAST_NAME_KEY) ?? '').slice(0, NAME_MAX);
    nameInput.focus();
    nameInput.select();
  }
}

function hideGameOverRecords() {
  pendingRecord = false;
  goRecords.classList.add('hidden');
  newRecordForm.classList.add('hidden');
}

function submitRecord() {
  if (!pendingRecord) return;
  pendingRecord = false;
  const name = nameInput.value.trim().slice(0, NAME_MAX) || 'Anónimo';
  storageSet(LAST_NAME_KEY, name);
  const idx = saveHighScore({
    name,
    score,
    lines,
    maxCombo,
    date: new Date().toISOString(),
  });
  newRecordForm.classList.add('hidden');
  nameInput.blur();
  renderRecords(goTableBody, goBests, idx);
}

function resetRecords() {
  if (!confirm('¿Borrar todos los récords?')) return;
  storageRemove(HS_KEY);
  storageRemove(BESTS_KEY);
  renderRecords(startTableBody, startBests, -1);
  renderRecords(goTableBody, goBests, -1);
}

function isTypingTarget(el) {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

function startGame() {
  startScreen.classList.add('hidden');
  gameStarted = true;
  init();
}

newRecordForm.addEventListener('submit', e => {
  e.preventDefault();
  submitRecord();
});
playBtn.addEventListener('click', startGame);
startResetBtn.addEventListener('click', resetRecords);
goResetBtn.addEventListener('click', resetRecords);

nameInput.maxLength = NAME_MAX;
renderRecords(startTableBody, startBests, -1);

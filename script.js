// --- Simulation Parameters ---
let POP_MAX = 120;
let SEQ_LEN = 18;
let MUT_RATE = 0.03; // per nucleotide per replication
let BASE_REP_RATE = 0.12;
let CATALYTIC_REP_RATE = 0.28;
let BASE_DEG_RATE = 0.04;
let GC_STABILITY_BONUS = 0.02;
let CATALYTIC_MOTIF = 'GGAAG'; // simple motif for catalysis
const NUCLEOTIDES = ['A', 'U', 'G', 'C'];
const INIT_POP = 32;
// --- Square Area ---
let simSquare = {x:0, y:0, size:0};

// --- RNA Model ---
class RNA {
  constructor(seq) {
    this.seq = seq;
    this.age = 0;
    this.gc = this.calcGC();
    this.isCatalytic = seq.includes(CATALYTIC_MOTIF);
    // Position in [0,1] inside the square
    this.x = Math.random();
    this.y = Math.random();
    this.angle = Math.random() * 2 * Math.PI;
    this.radius = 32 + Math.random() * 32;
    this.color = this.pickColor();
  }
  calcGC() {
    let gc = 0;
    for (let c of this.seq) if (c === 'G' || c === 'C') gc++;
    return gc / this.seq.length;
  }
  pickColor() {
    // Neon palette: catalytic = pink, GC-rich = blue, AU-rich = green
    if (this.isCatalytic) return '#ff00e6';
    if (this.gc > 0.65) return '#00e6ff';
    if (this.gc < 0.35) return '#39ff14';
    return '#f7ff00';
  }
  replicate() {
    let newSeq = '';
    for (let c of this.seq) {
      if (Math.random() < MUT_RATE) {
        // Mutate to a different nucleotide
        let options = NUCLEOTIDES.filter(n => n !== c);
        newSeq += options[Math.floor(Math.random() * 3)];
      } else {
        newSeq += c;
      }
    }
    return new RNA(newSeq);
  }
  getRepRate() {
    return this.isCatalytic ? CATALYTIC_REP_RATE : BASE_REP_RATE;
  }
  getDegRate() {
    // GC-rich = more stable
    return BASE_DEG_RATE - this.gc * GC_STABILITY_BONUS;
  }
  move() {
    // Erratic, random walk
    this.angle += (Math.random() - 0.5) * 0.3;
    this.radius += (Math.random() - 0.5) * 2;
    this.radius = Math.max(24, Math.min(64, this.radius));
    this.x += Math.cos(this.angle) * 0.003 * this.radius;
    this.y += Math.sin(this.angle) * 0.003 * this.radius;
    // Confine to [0,1] (reflect at edges)
    if (this.x < 0) { this.x = -this.x; this.angle = Math.PI - this.angle; }
    if (this.x > 1) { this.x = 2 - this.x; this.angle = Math.PI - this.angle; }
    if (this.y < 0) { this.y = -this.y; this.angle = -this.angle; }
    if (this.y > 1) { this.y = 2 - this.y; this.angle = -this.angle; }
  }
}

// --- Simulation State ---
let population = [];
let tick = 0;
let running = true;
let SIM_SPEED = 1.0; // multiplier
let SIM_BASE_INTERVAL = 33; // ms per step at 1x (about 30 steps/sec)
let simStepTimer = null;

function randomSeq(len) {
  let s = '';
  for (let i = 0; i < len; i++) {
    s += NUCLEOTIDES[Math.floor(Math.random() * 4)];
  }
  return s;
}

function initPopulation() {
  population = [];
  for (let i = 0; i < INIT_POP; i++) {
    population.push(new RNA(randomSeq(SEQ_LEN)));
  }
  tick = 0;
}

// --- Simulation Step ---
function step() {
  // 1. Replication
  let newRNAs = [];
  for (let rna of population) {
    if (Math.random() < rna.getRepRate()) {
      newRNAs.push(rna.replicate());
    }
  }
  population.push(...newRNAs);

  // 2. Degradation
  population = population.filter(rna => {
    let deg = rna.getDegRate();
    return Math.random() > deg;
  });

  // 3. Resource Limitation
  if (population.length > POP_MAX) {
    // Cull random RNAs to max size
    population = shuffle(population).slice(0, POP_MAX);
  }

  // 4. Age & Move
  for (let rna of population) {
    rna.age++;
    rna.move();
  }

  tick++;
}

function shuffle(arr) {
  // Fisher-Yates
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// --- Stats ---
function updateStats() {
  document.getElementById('stat-pop').textContent = population.length;
  let unique = new Set(population.map(rna => rna.seq));
  document.getElementById('stat-unique').textContent = unique.size;
  let catalytic = population.filter(rna => rna.isCatalytic).length;
  let frac = population.length ? (catalytic / population.length * 100).toFixed(1) : 0;
  document.getElementById('stat-catalytic').textContent = frac + '%';
  document.getElementById('stat-tick').textContent = tick;
}

// --- Drawing ---
const canvas = document.getElementById('rna-canvas');
const ctx = canvas.getContext('2d');
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  let isMobile = window.innerWidth <= 700;
  let uiTop = document.getElementById('ui-top');
  let panelsHeight = 0;
  if (isMobile && uiTop) {
    panelsHeight = uiTop.offsetHeight;
  } else if (!isMobile) {
    panelsHeight = 0;
  }
  let availW = window.innerWidth;
  let availH = window.innerHeight - panelsHeight;
  let size = Math.floor(Math.min(availW, availH) * 0.98);
  simSquare.size = size;
  simSquare.x = Math.floor((window.innerWidth - size) / 2);
  simSquare.y = panelsHeight + Math.floor((availH - size) / 2);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function drawSimSquare() {
  ctx.save();
  ctx.strokeStyle = '#00fff7';
  ctx.shadowColor = '#00fff7';
  ctx.shadowBlur = 18;
  ctx.lineWidth = 4.5;
  ctx.strokeRect(simSquare.x, simSquare.y, simSquare.size, simSquare.size);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawRNA(rna, highlight=false) {
  // Map [0,1] to simSquare
  let cx = simSquare.x + rna.x * simSquare.size;
  let cy = simSquare.y + rna.y * simSquare.size;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rna.angle);
  ctx.shadowColor = rna.color;
  ctx.shadowBlur = highlight ? 32 : 16;
  ctx.beginPath();
  let len = rna.seq.length;
  for (let i = 0; i < len; i++) {
    let t = i / (len - 1);
    let x = (t - 0.5) * rna.radius * 2;
    let y = Math.sin(t * Math.PI * 2 + rna.angle * 2) * (rna.radius * 0.3) * (0.7 + Math.random() * 0.6);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = rna.color;
  ctx.lineWidth = highlight ? 4.5 : 3.2;
  ctx.globalAlpha = highlight ? 1.0 : 0.85;
  ctx.stroke();
  ctx.globalAlpha = 1.0;
  ctx.shadowBlur = 0;
  ctx.restore();
}

let hoveredRNA = null;
let mouse = {x:0, y:0};
canvas.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
  hoveredRNA = null;
  // Only check if inside simSquare
  if (
    mouse.x >= simSquare.x && mouse.x <= simSquare.x + simSquare.size &&
    mouse.y >= simSquare.y && mouse.y <= simSquare.y + simSquare.size
  ) {
    // Find closest RNA within threshold
    let minDist = 32;
    for (let rna of population) {
      let cx = simSquare.x + rna.x * simSquare.size;
      let cy = simSquare.y + rna.y * simSquare.size;
      let d = Math.hypot(mouse.x - cx, mouse.y - cy);
      if (d < minDist) {
        minDist = d;
        hoveredRNA = rna;
      }
    }
  }
  updateTooltip();
});
canvas.addEventListener('mouseleave', () => {
  hoveredRNA = null;
  updateTooltip();
});

function updateTooltip() {
  const tooltip = document.getElementById('rna-tooltip');
  if (hoveredRNA) {
    tooltip.style.display = 'block';
    // On mobile, show tooltip at bottom of screen
    if (window.innerWidth <= 700) {
      tooltip.style.left = '4vw';
      tooltip.style.top = (window.innerHeight - tooltip.offsetHeight - 24) + 'px';
    } else {
      tooltip.style.left = (mouse.x + 18) + 'px';
      tooltip.style.top = (mouse.y + 18) + 'px';
    }
    tooltip.innerHTML = `
      <div><span class='stat-label'>Seq:</span><span style='font-family:monospace;'>${hoveredRNA.seq}</span></div>
      <div><span class='stat-label'>Age:</span>${hoveredRNA.age}</div>
      <div><span class='stat-label'>GC%:</span>${(hoveredRNA.gc*100).toFixed(1)}%</div>
      <div><span class='stat-label'>Cat:</span>${hoveredRNA.isCatalytic ? '<span style="color:#ff00e6">Yes</span>' : 'No'}</div>
    `;
  } else {
    tooltip.style.display = 'none';
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawSimSquare();
  for (let rna of population) {
    drawRNA(rna, rna === hoveredRNA);
  }
}

// --- Main Loop ---
function loop() {
  draw();
  requestAnimationFrame(loop);
}

function updateParamInputs() {
  document.getElementById('input-popmax').value = POP_MAX;
  document.getElementById('val-popmax').textContent = POP_MAX;
  document.getElementById('input-seqlen').value = SEQ_LEN;
  document.getElementById('val-seqlen').textContent = SEQ_LEN;
  document.getElementById('input-mutrate').value = MUT_RATE;
  document.getElementById('val-mutrate').textContent = MUT_RATE.toFixed(3);
  document.getElementById('input-baserep').value = BASE_REP_RATE;
  document.getElementById('val-baserep').textContent = BASE_REP_RATE.toFixed(3);
  document.getElementById('input-catrep').value = CATALYTIC_REP_RATE;
  document.getElementById('val-catrep').textContent = CATALYTIC_REP_RATE.toFixed(3);
  document.getElementById('input-degrate').value = BASE_DEG_RATE;
  document.getElementById('val-degrate').textContent = BASE_DEG_RATE.toFixed(3);
  document.getElementById('input-gcbonus').value = GC_STABILITY_BONUS;
  document.getElementById('val-gcbonus').textContent = GC_STABILITY_BONUS.toFixed(3);
  document.getElementById('input-motif').value = CATALYTIC_MOTIF;
  document.getElementById('input-speed').value = SIM_SPEED;
  document.getElementById('val-speed').textContent = SIM_SPEED.toFixed(2) + 'x';
}

function attachParamListeners() {
  document.getElementById('input-popmax').oninput = e => {
    POP_MAX = parseInt(e.target.value);
    document.getElementById('val-popmax').textContent = POP_MAX;
  };
  document.getElementById('input-seqlen').oninput = e => {
    SEQ_LEN = parseInt(e.target.value);
    document.getElementById('val-seqlen').textContent = SEQ_LEN;
    document.getElementById('reset-warning').textContent = 'Sequence length change requires reset.';
  };
  document.getElementById('input-mutrate').oninput = e => {
    MUT_RATE = parseFloat(e.target.value);
    document.getElementById('val-mutrate').textContent = MUT_RATE.toFixed(3);
  };
  document.getElementById('input-baserep').oninput = e => {
    BASE_REP_RATE = parseFloat(e.target.value);
    document.getElementById('val-baserep').textContent = BASE_REP_RATE.toFixed(3);
  };
  document.getElementById('input-catrep').oninput = e => {
    CATALYTIC_REP_RATE = parseFloat(e.target.value);
    document.getElementById('val-catrep').textContent = CATALYTIC_REP_RATE.toFixed(3);
  };
  document.getElementById('input-degrate').oninput = e => {
    BASE_DEG_RATE = parseFloat(e.target.value);
    document.getElementById('val-degrate').textContent = BASE_DEG_RATE.toFixed(3);
  };
  document.getElementById('input-gcbonus').oninput = e => {
    GC_STABILITY_BONUS = parseFloat(e.target.value);
    document.getElementById('val-gcbonus').textContent = GC_STABILITY_BONUS.toFixed(3);
  };
  document.getElementById('input-motif').oninput = e => {
    CATALYTIC_MOTIF = e.target.value.toUpperCase();
    document.getElementById('reset-warning').textContent = 'Motif change requires reset.';
  };
  document.getElementById('input-speed').oninput = e => {
    SIM_SPEED = parseFloat(e.target.value);
    document.getElementById('val-speed').textContent = SIM_SPEED.toFixed(2) + 'x';
    restartSimStepTimer();
  };
}

function updateSpeedInput() {
  document.getElementById('input-speed').value = SIM_SPEED;
  document.getElementById('val-speed').textContent = SIM_SPEED.toFixed(2) + 'x';
}

function attachSpeedListener() {
  document.getElementById('input-speed').oninput = e => {
    SIM_SPEED = parseFloat(e.target.value);
    document.getElementById('val-speed').textContent = SIM_SPEED.toFixed(2) + 'x';
    restartSimStepTimer();
  };
}

function restartSimStepTimer() {
  if (simStepTimer) clearTimeout(simStepTimer);
  if (!running) return;
  simStepTimer = setTimeout(simStep, SIM_BASE_INTERVAL / SIM_SPEED);
}

function simStep() {
  if (running) {
    step();
    updateStats();
  }
  restartSimStepTimer();
}

document.getElementById('btn-pause').onclick = function() {
  running = !running;
  this.textContent = running ? 'Pause' : 'Resume';
  if (running) {
    restartSimStepTimer();
  } else {
    if (simStepTimer) clearTimeout(simStepTimer);
  }
};
document.getElementById('btn-reset').onclick = function() {
  initPopulation();
  running = true;
  document.getElementById('btn-pause').textContent = 'Pause';
  document.getElementById('reset-warning').textContent = '';
  restartSimStepTimer();
};

updateParamInputs();
attachParamListeners();
updateSpeedInput();
attachSpeedListener();
initPopulation();
updateStats();
loop();
restartSimStepTimer();

// Description panel close logic
const descPanel = document.getElementById('description-panel');
const descClose = document.getElementById('desc-close');
if (descPanel && descClose) {
  descClose.onclick = () => {
    descPanel.classList.add('hide');
    setTimeout(() => { descPanel.style.display = 'none'; }, 400);
  };
} 
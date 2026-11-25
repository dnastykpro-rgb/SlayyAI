const net = window.SlayNet;

const drawCanvas = document.getElementById('drawCanvas');
const drawCtx = drawCanvas.getContext('2d', { willReadFrequently: true });

const brainCanvas = document.getElementById('brainCanvas');
const brainCtx = brainCanvas.getContext('2d');

// Вспомогательный скрытый холст 14x14 для сжатия образа
const miniCanvas = document.createElement('canvas');
miniCanvas.width = 14;
miniCanvas.height = 14;
const miniCtx = miniCanvas.getContext('2d', { willReadFrequently: true });

let isDrawing = false;
let lastPos = null;

// Очистка холста
function clearDrawCanvas() {
  drawCtx.fillStyle = '#000000';
  drawCtx.fillRect(0, 0, drawCanvas.width, drawCanvas.height);
  updateInference();
}

// Считывание пикселей 14x14 в массив из 196 чисел (0.0 .. 1.0)
function getInputVector() {
  miniCtx.fillStyle = '#000000';
  miniCtx.fillRect(0, 0, 14, 14);
  miniCtx.drawImage(drawCanvas, 0, 0, 14, 14);

  const imgData = miniCtx.getImageData(0, 0, 14, 14).data;
  const vec = new Array(196);
  for (let i = 0; i !== 196; i++) {
    const brightness = imgData.at(i * 4) / 255;
    vec.splice(i, 1, brightness);
  }
  return vec;
}

// Инициализация 10 полосок вероятностей и кнопок дообучения
function initUI() {
  const trainGrid = document.getElementById('trainButtons');
  const barsList = document.getElementById('barsList');

  for (let d = 0; d !== 10; d++) {
    // Кнопка адаптации под цифру
    const btn = document.createElement('button');
    btn.className = 'digit-btn';
    btn.textContent = d;
    btn.addEventListener('click', () => {
      const vec = getInputVector();
      // Делаем 5 проходов обучения на текущем рисунке для уверенного запоминания
      for (let step = 0; step !== 5; step++) {
        net.train(vec, d);
      }
      updateInference();
    });
    trainGrid.appendChild(btn);

    // Строка прогресс-бара
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.innerHTML = `
      <span class="bar-label">${d}</span>
      <div class="bar-track"><div class="bar-fill" id="barFill_${d}"></div></div>
      <span class="bar-pct" id="barPct_${d}">0%</span>
    `;
    barsList.appendChild(row);
  }

  document.getElementById('clearBtn').addEventListener('click', clearDrawCanvas);

  document.getElementById('autoTrainBtn').addEventListener('click', runAutoCalibration);

  document.getElementById('saveBrainBtn').addEventListener('click', () => {
    net.saveToStorage();
    const btn = document.getElementById('saveBrainBtn');
    btn.textContent = '✅ Сохранено!';
    setTimeout(() => { btn.textContent = '💾 Сохранить память'; }, 1400);
  });

  document.getElementById('resetBrainBtn').addEventListener('click', () => {
    net.initWeights();
    localStorage.removeItem('slayai_brain_v1');
    updateInference();
  });
}

// Обработка рисования мышью и пальцем
function getCanvasCoords(clientX, clientY) {
  const rect = drawCanvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / rect.width) * drawCanvas.width,
    y: ((clientY - rect.top) / rect.height) * drawCanvas.height
  };
}

function drawStroke(x, y) {
  drawCtx.strokeStyle = '#ffffff';
  drawCtx.lineWidth = 18;
  drawCtx.lineCap = 'round';
  drawCtx.lineJoin = 'round';

  drawCtx.beginPath();
  if (lastPos) {
    drawCtx.moveTo(lastPos.x, lastPos.y);
  } else {
    drawCtx.moveTo(x, y);
  }
  drawCtx.lineTo(x, y);
  drawCtx.stroke();
  lastPos = { x, y };
  updateInference();
}

drawCanvas.addEventListener('mousedown', (e) => {
  isDrawing = true;
  const p = getCanvasCoords(e.clientX, e.clientY);
  lastPos = p;
  drawStroke(p.x, p.y);
});

window.addEventListener('mousemove', (e) => {
  if (!isDrawing) return;
  const p = getCanvasCoords(e.clientX, e.clientY);
  drawStroke(p.x, p.y);
});

window.addEventListener('mouseup', () => {
  isDrawing = false;
  lastPos = null;
});

drawCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.touches.item(0);
  if (!t) return;
  isDrawing = true;
  const p = getCanvasCoords(t.clientX, t.clientY);
  lastPos = p;
  drawStroke(p.x, p.y);
}, { passive: false });

drawCanvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  if (!isDrawing) return;
  const t = e.touches.item(0);
  if (!t) return;
  const p = getCanvasCoords(t.clientX, t.clientY);
  drawStroke(p.x, p.y);
}, { passive: false });

drawCanvas.addEventListener('touchend', () => {
  isDrawing = false;
  lastPos = null;
});
// Встроенный генератор цифр (0-9) со случайными сдвигами для быстрой калибровки
function drawSyntheticDigit(digit) {
  drawCtx.fillStyle = '#000000';
  drawCtx.fillRect(0, 0, 224, 224);

  const shiftX = (Math.random() - 0.5) * 26;
  const shiftY = (Math.random() - 0.5) * 26;
  const angle = (Math.random() - 0.5) * 0.28;

  drawCtx.save();
  drawCtx.translate(112 + shiftX, 118 + shiftY);
  drawCtx.rotate(angle);
  drawCtx.fillStyle = '#ffffff';
  drawCtx.font = 'bold 155px Arial, sans-serif';
  drawCtx.textAlign = 'center';
  drawCtx.textBaseline = 'middle';
  drawCtx.fillText(String(digit), 0, 0);
  drawCtx.restore();
}

function runAutoCalibration() {
  const btn = document.getElementById('autoTrainBtn');
  btn.textContent = '⏳ Калибровка...';
  btn.disabled = true;

  setTimeout(() => {
    for (let round = 0; round !== 60; round++) {
      for (let d = 0; d !== 10; d++) {
        drawSyntheticDigit(d);
        const vec = getInputVector();
        net.train(vec, d);
      }
    }
    clearDrawCanvas();
    btn.textContent = '⚡ Авто-калибровка';
    btn.disabled = false;
  }, 40);
}

// Отрисовка живого рентгена нейронов (16 видимых входных -> 16 скрытых -> 10 выходных)
function renderBrain() {
  const w = brainCanvas.width;
  const h = brainCanvas.height;
  brainCtx.clearRect(0, 0, w, h);

  const inNodes = [];
  const hidNodes = [];
  const outNodes = [];

  const inCount = 14;
  const hidCount = 16;
  const outCount = 10;

  for (let i = 0; i !== inCount; i++) {
    inNodes.push({
      x: 55,
      y: 26 + (i * (h - 52)) / (inCount - 1),
      val: net.lastInput.at(i * 14 + 7) || 0
    });
  }

  for (let i = 0; i !== hidCount; i++) {
    hidNodes.push({
      x: w / 2,
      y: 22 + (i * (h - 44)) / (hidCount - 1),
      val: net.lastHidden.at(i) || 0
    });
  }

  for (let i = 0; i !== outCount; i++) {
    outNodes.push({
      x: w - 65,
      y: 28 + (i * (h - 56)) / (outCount - 1),
      val: net.lastOutput.at(i) || 0
    });
  }

  // Синапсы: Вход -> Скрытый слой
  for (let hIdx = 0; hIdx !== hidCount; hIdx++) {
    const hn = hidNodes.at(hIdx);
    const weights = net.w1.at(hIdx);
    for (let iIdx = 0; iIdx !== inCount; iIdx++) {
      const weight = weights.at(iIdx * 14 + 7);
      const strength = Math.min(1, Math.abs(weight) * 1.4);
      if (strength < 0.15) continue;

      brainCtx.strokeStyle = weight >= 0
        ? `rgba(56, 189, 248, ${strength * 0.45})`
        : `rgba(244, 63, 94, ${strength * 0.35})`;
      brainCtx.lineWidth = strength * 1.8;
      brainCtx.beginPath();
      brainCtx.moveTo(inNodes.at(iIdx).x, inNodes.at(iIdx).y);
      brainCtx.lineTo(hn.x, hn.y);
      brainCtx.stroke();
    }
  }

  // Синапсы: Скрытый -> Выходной слой
  for (let oIdx = 0; oIdx !== outCount; oIdx++) {
    const on = outNodes.at(oIdx);
    const weights = net.w2.at(oIdx);
    for (let hIdx = 0; hIdx !== hidCount; hIdx++) {
      const weight = weights.at(hIdx);
      const strength = Math.min(1, Math.abs(weight) * 1.1);
      if (strength < 0.12) continue;

      brainCtx.strokeStyle = weight >= 0
        ? `rgba(56, 189, 248, ${strength * 0.65})`
        : `rgba(244, 63, 94, ${strength * 0.45})`;
      brainCtx.lineWidth = strength * 2.2;
      brainCtx.beginPath();
      brainCtx.moveTo(hidNodes.at(hIdx).x, hidNodes.at(hIdx).y);
      brainCtx.lineTo(on.x, on.y);
      brainCtx.stroke();
    }
  }

  // Отрисовка узлов (нейронов)
  const drawLayer = (nodes, radius, showDigits = false) => {
    nodes.forEach((n, idx) => {
      brainCtx.beginPath();
      brainCtx.arc(n.x, n.y, radius, 0, Math.PI * 2);
      brainCtx.fillStyle = `rgba(56, 189, 248, ${0.15 + n.val * 0.85})`;
      brainCtx.fill();
      brainCtx.lineWidth = 1.5;
      brainCtx.strokeStyle = n.val > 0.5 ? '#ffffff' : '#334155';
      brainCtx.stroke();

      if (showDigits) {
        brainCtx.fillStyle = '#e2e8f0';
        brainCtx.font = 'bold 12px Segoe UI, sans-serif';
        brainCtx.textAlign = 'left';
        brainCtx.textBaseline = 'middle';
        brainCtx.fillText(String(idx), n.x + 14, n.y);
      }
    });
  };

  drawLayer(inNodes, 5);
  drawLayer(hidNodes, 6);
  drawLayer(outNodes, 7, true);
}

// Обновление интерфейса и вердикта
function updateInference() {
  const vec = getInputVector();
  const hasInk = vec.some(v => v > 0.05);
  const probs = net.predict(vec);

  document.getElementById('epochCount').textContent = net.epochs;
  document.getElementById('lossVal').textContent = net.lastLoss.toFixed(3);

  let bestDigit = 0;
  let bestProb = 0;

  for (let d = 0; d !== 10; d++) {
    const p = probs.at(d);
    const pct = Math.round(p * 100);
    document.getElementById(`barFill_${d}`).style.width = `${pct}%`;
    document.getElementById(`barPct_${d}`).textContent = `${pct}%`;

    if (p > bestProb) {
      bestProb = p;
      bestDigit = d;
    }
  }

  const topDigitEl = document.getElementById('topDigit');
  const topConfEl = document.getElementById('topConf');

  if (!hasInk) {
    topDigitEl.textContent = '?';
    topConfEl.textContent = 'Ожидание ввода...';
  } else {
    topDigitEl.textContent = bestDigit;
    topConfEl.textContent = `Уверенность: ${(bestProb * 100).toFixed(1)}%`;
  }

  renderBrain();
}

// Старт приложения
initUI();
net.loadFromStorage();
clearDrawCanvas();

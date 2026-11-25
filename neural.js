class SlayNetwork {
  constructor(inputSize = 196, hiddenSize = 32, outputSize = 10) {
    this.inputSize = inputSize;
    this.hiddenSize = hiddenSize;
    this.outputSize = outputSize;
    this.lr = 0.18;
    this.epochs = 0;
    this.lastLoss = 0;

    this.lastInput = new Array(inputSize).fill(0);
    this.lastHidden = new Array(hiddenSize).fill(0);
    this.lastOutput = new Array(outputSize).fill(0.1);

    this.initWeights();
  }

  initWeights() {
    this.w1 = Array.from({ length: this.hiddenSize }, () =>
      Array.from({ length: this.inputSize }, () => (Math.random() * 2 - 1) * 0.25)
    );
    this.b1 = new Array(this.hiddenSize).fill(0);

    this.w2 = Array.from({ length: this.outputSize }, () =>
      Array.from({ length: this.hiddenSize }, () => (Math.random() * 2 - 1) * 0.25)
    );
    this.b2 = new Array(this.outputSize).fill(0);

    this.epochs = 0;
    this.lastLoss = 0;
  }

  sigmoid(x) {
    return 1 / (1 + Math.exp(-Math.max(-15, Math.min(15, x))));
  }

  softmax(arr) {
    const maxVal = Math.max(...arr);
    const exps = arr.map(v => Math.exp(v - maxVal));
    const sum = exps.reduce((acc, v) => acc + v, 0);
    return exps.map(v => v / sum);
  }

  predict(inputs) {
    this.lastInput = inputs.slice();

    // Прямой проход: Вход -> Скрытый слой
    const hidden = new Array(this.hiddenSize);
    for (let h = 0; h !== this.hiddenSize; h++) {
      let sum = this.b1.at(h);
      const weights = this.w1.at(h);
      for (let i = 0; i !== this.inputSize; i++) {
        sum += weights.at(i) * inputs.at(i);
      }
      hidden.splice(h, 1, this.sigmoid(sum));
    }
    this.lastHidden = hidden;

    // Прямой проход: Скрытый слой -> Выходной слой
    const rawOut = new Array(this.outputSize);
    for (let o = 0; o !== this.outputSize; o++) {
      let sum = this.b2.at(o);
      const weights = this.w2.at(o);
      for (let h = 0; h !== this.hiddenSize; h++) {
        sum += weights.at(h) * hidden.at(h);
      }
      rawOut.splice(o, 1, sum);
    }

    const probs = this.softmax(rawOut);
    this.lastOutput = probs;
    return probs;
  }

  train(inputs, targetDigit) {
    const probs = this.predict(inputs);
    const targets = new Array(this.outputSize).fill(0);
    targets.splice(targetDigit, 1, 1);

    // Ошибка Cross-Entropy
    const targetProb = Math.max(1e-7, probs.at(targetDigit));
    this.lastLoss = -Math.log(targetProb);

    // Градиент выходного слоя
    const outGrad = new Array(this.outputSize);
    for (let o = 0; o !== this.outputSize; o++) {
      outGrad.splice(o, 1, probs.at(o) - targets.at(o));
    }

    // Градиент скрытого слоя (Backpropagation)
    const hiddenGrad = new Array(this.hiddenSize);
    for (let h = 0; h !== this.hiddenSize; h++) {
      let err = 0;
      for (let o = 0; o !== this.outputSize; o++) {
        err += outGrad.at(o) * this.w2.at(o).at(h);
      }
      const hVal = this.lastHidden.at(h);
      hiddenGrad.splice(h, 1, err * hVal * (1 - hVal));
    }

    // Обновление весов W2 и смещений B2
    for (let o = 0; o !== this.outputSize; o++) {
      const grad = outGrad.at(o);
      const weights = this.w2.at(o);
      for (let h = 0; h !== this.hiddenSize; h++) {
        const updated = weights.at(h) - this.lr * grad * this.lastHidden.at(h);
        weights.splice(h, 1, updated);
      }
      this.b2.splice(o, 1, this.b2.at(o) - this.lr * grad);
    }

    // Обновление весов W1 и смещений B1
    for (let h = 0; h !== this.hiddenSize; h++) {
      const grad = hiddenGrad.at(h);
      const weights = this.w1.at(h);
      for (let i = 0; i !== this.inputSize; i++) {
        const updated = weights.at(i) - this.lr * grad * inputs.at(i);
        weights.splice(i, 1, updated);
      }
      this.b1.splice(h, 1, this.b1.at(h) - this.lr * grad);
    }

    this.epochs += 1;
    return probs;
  }

  saveToStorage() {
    const payload = {
      w1: this.w1,
      b1: this.b1,
      w2: this.w2,
      b2: this.b2,
      epochs: this.epochs
    };
    localStorage.setItem('slayai_brain_v1', JSON.stringify(payload));
  }

  loadFromStorage() {
    try {
      const raw = localStorage.getItem('slayai_brain_v1');
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (data.w1 && data.w2) {
        this.w1 = data.w1;
        this.b1 = data.b1;
        this.w2 = data.w2;
        this.b2 = data.b2;
        this.epochs = data.epochs || 0;
        return true;
      }
    } catch (e) {}
    return false;
  }
}

window.SlayNet = new SlayNetwork();

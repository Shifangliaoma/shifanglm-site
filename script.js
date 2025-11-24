// 简单交互：生成伪序趋势数据并在 Canvas 上绘制，支持导出 CSV 与复制联系方式
document.addEventListener('DOMContentLoaded', () => {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const canvas = document.getElementById('trend-canvas');
  const ctx = canvas.getContext('2d');

  function generatePseudoTrend(n = 300, opts = {}) {
    const {
      arCoef = 0.92,
      drift = 0.0,
      noiseScale = 1.0,
      seasonalAmp = 5.0,
      seasonalPeriod = 50,
      jumpProb = 0.01,
      jumpScale = 10.0,
      seed = null
    } = opts;
    if (seed !== null) {
      // Simple LCG for reproducibility if needed
      let s = seed >>> 0;
      var rand = () => {
        s = (1664525 * s + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    } else {
      var rand = Math.random;
    }

    const values = [];
    let x = 0;
    for (let t = 0; t < n; t++) {
      const arPart = arCoef * x;
      const seasonal = seasonalAmp * Math.sin(2 * Math.PI * t / seasonalPeriod);
      const jump = rand() < jumpProb ? (rand() * 2 - 1) * jumpScale : 0;
      const noise = (rand() * 2 - 1) * noiseScale;
      x = arPart + drift + seasonal + jump + noise;
      values.push(x);
    }
    return values;
  }

  function drawTrend(values) {
    // clear
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    // background grid
    ctx.fillStyle = '#071025';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 1;
    for (let y = 0; y <= h; y += Math.round(h / 8)) {
      ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); ctx.stroke();
    }

    const n = values.length;
    if (n === 0) return;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const pad = (max - min) * 0.12 || 1;
    const vmin = min - pad, vmax = max + pad;

    // map function
    const xScale = (i) => (i / (n - 1)) * (w - 40) + 20;
    const yScale = (v) => h - 20 - ((v - vmin) / (vmax - vmin)) * (h - 40);

    // area gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(106,140,255,0.18)');
    grad.addColorStop(1, 'rgba(125,224,201,0.02)');

    // path
    ctx.beginPath();
    ctx.moveTo(xScale(0), yScale(values[0]));
    for (let i = 1; i < n; i++) {
      ctx.lineTo(xScale(i), yScale(values[i]));
    }
    ctx.strokeStyle = 'rgba(106,140,255,0.95)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // fill under curve
    ctx.lineTo(xScale(n - 1), h - 20);
    ctx.lineTo(xScale(0), h - 20);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // small markers
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 80))) {
      ctx.beginPath();
      ctx.arc(xScale(i), yScale(values[i]), 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function exportCSV(values, filename = 'pseudo_trend.csv') {
    const lines = ['# 十方料码-伪序趋势数据，主攻福彩3D综合缩水/趋势思路，仅供参考学习交流使用', 'index,value'];
    for (let i = 0; i < values.length; i++) {
      lines.push(`${i},${values[i].toFixed(6)}`);
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    a.remove(); URL.revokeObjectURL(url);
  }

  // wire up controls
  const btn = document.getElementById('generate');
  const btnExport = document.getElementById('export-csv');
  let lastValues = [];

  btn.addEventListener('click', () => {
    const n = Math.max(10, Math.min(5000, parseInt(document.getElementById('count').value || 300)));
    const period = Math.max(2, parseInt(document.getElementById('period').value || 50));
    const noise = Math.max(0, parseFloat(document.getElementById('noise').value || 1.0));
    lastValues = generatePseudoTrend(n, {
      seasonalPeriod: period,
      noiseScale: noise,
      jumpProb: 0.015,
      jumpScale: Math.max(2, noise * 6)
    });
    drawTrend(lastValues);
  });

  btnExport.addEventListener('click', () => {
    if (!lastValues || lastValues.length === 0) {
      alert('请先生成数据再导出。');
      return;
    }
    exportCSV(lastValues);
  });

  // copy contact
  function copyText(text, el) {
    if (!navigator.clipboard) {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); alert('已复制到剪贴板'); } catch (e) { alert('复制失败'); }
      ta.remove(); return;
    }
    navigator.clipboard.writeText(text).then(() => {
      const origin = el.textContent;
      el.textContent = '已复制';
      setTimeout(() => el.textContent = origin, 1200);
    }).catch(() => alert('复制失败'));
  }

  const copyQQ = document.getElementById('copy-qq');
  if (copyQQ) copyQQ.addEventListener('click', () => {
    const qq = document.getElementById('qq').textContent.trim(); copyText(qq, copyQQ);
  });
  const copyEmail = document.getElementById('copy-email');
  if (copyEmail) copyEmail.addEventListener('click', () => {
    const email = document.getElementById('email').textContent.trim(); copyText(email, copyEmail);
  });

  // initial draw
  document.getElementById('generate').click();
});

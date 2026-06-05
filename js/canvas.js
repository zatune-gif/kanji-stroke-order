var CanvasModule = (function () {
  var KANJIVG_SIZE = 109;
  var DIRS = ['right','right-down','down','left-down','left','left-up','up','right-up'];

  var mainCanvas, mainCtx, guideCanvas, guideCtx;
  var strokePoints = [];
  var isDrawing = false;
  var onStrokeEnd = null;
  var enabled = false;

  function init(mainEl, guideEl, callback) {
    mainCanvas = mainEl;
    mainCtx = mainEl.getContext('2d');
    guideCanvas = guideEl;
    guideCtx = guideEl.getContext('2d');
    onStrokeEnd = callback;
    bindEvents();
  }

  function setEnabled(val) { enabled = val; }

  function getPos(e) {
    var rect = mainCanvas.getBoundingClientRect();
    var src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * (mainCanvas.width / rect.width),
      y: (src.clientY - rect.top) * (mainCanvas.height / rect.height)
    };
  }

  function bindEvents() {
    mainCanvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      if (enabled) startStroke(getPos(e));
    }, { passive: false });
    mainCanvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      if (enabled) moveStroke(getPos(e));
    }, { passive: false });
    mainCanvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      if (enabled) endStroke();
    });
    mainCanvas.addEventListener('mousedown', function (e) {
      if (enabled) startStroke(getPos(e));
    });
    mainCanvas.addEventListener('mousemove', function (e) {
      if (enabled && isDrawing) moveStroke(getPos(e));
    });
    mainCanvas.addEventListener('mouseup', function () {
      if (enabled) endStroke();
    });
  }

  function startStroke(pos) {
    isDrawing = true;
    strokePoints = [pos];
    mainCtx.beginPath();
    mainCtx.moveTo(pos.x, pos.y);
  }

  function moveStroke(pos) {
    if (!isDrawing) return;
    strokePoints.push(pos);
    mainCtx.lineTo(pos.x, pos.y);
    mainCtx.strokeStyle = '#2C2C2C';
    mainCtx.lineWidth = 10;
    mainCtx.lineCap = 'round';
    mainCtx.lineJoin = 'round';
    mainCtx.stroke();
  }

  function endStroke() {
    if (!isDrawing) return;
    isDrawing = false;
    if (strokePoints.length < 2) { strokePoints = []; return; }
    var dir = detectDirection(strokePoints);
    strokePoints = [];
    if (onStrokeEnd) onStrokeEnd(dir);
  }

  function detectDirection(points) {
    var start = points[0];
    var end = points[points.length - 1];
    var dx = end.x - start.x;
    var dy = end.y - start.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < 12) return 'dot';
    var angle = Math.atan2(dy, dx) * 180 / Math.PI;
    var norm = (angle + 360) % 360;
    return DIRS[Math.round(norm / 45) % 8];
  }

  function isDirectionMatch(detected, expected) {
    if (expected === 'dot') return detected === 'dot';
    var di = DIRS.indexOf(detected);
    var ei = DIRS.indexOf(expected);
    if (di === -1 || ei === -1) return detected === expected;
    var diff = Math.abs(di - ei);
    return diff <= 2 || diff >= 6;
  }

  function clearMain() {
    mainCtx.clearRect(0, 0, mainCanvas.width, mainCanvas.height);
  }

  function clearGuide() {
    guideCtx.clearRect(0, 0, guideCanvas.width, guideCanvas.height);
  }

  function drawStrokePath(ctx, pathStr, size, color, lineWidth) {
    var scale = size / KANJIVG_SIZE;
    ctx.save();
    ctx.scale(scale, scale);
    var path = new Path2D(pathStr);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth / scale;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke(path);
    ctx.restore();
  }

  function drawGuide(kanjiData, currentStrokeIndex) {
    clearGuide();
    var size = guideCanvas.width;
    for (var i = 0; i < kanjiData.strokes.length; i++) {
      var color, lw;
      if (i < currentStrokeIndex) {
        color = '#BBBBBB'; lw = 2;
      } else if (i === currentStrokeIndex) {
        color = '#1E88E5'; lw = 3.5;
      } else {
        color = '#E8E8E8'; lw = 2;
      }
      drawStrokePath(guideCtx, kanjiData.strokes[i].path, size, color, lw);
    }
  }

  function drawGhostGuide(kanjiData, currentStrokeIndex) {
    clearMain();
    if (currentStrokeIndex < kanjiData.strokes.length) {
      drawStrokePath(mainCtx, kanjiData.strokes[currentStrokeIndex].path,
        mainCanvas.width, 'rgba(200,200,200,0.35)', 8);
    }
  }

  function playPreview(kanjiData) {
    return new Promise(function (resolve) {
      var size = mainCanvas.width;
      var total = kanjiData.strokes.length;
      var delay = Math.max(500, Math.min(900, 4500 / total));
      var i = 0;

      function step() {
        if (i >= total) { resolve(); return; }
        clearMain();
        for (var j = 0; j < i; j++) {
          drawStrokePath(mainCtx, kanjiData.strokes[j].path, size, '#BBBBBB', 9);
        }
        drawStrokePath(mainCtx, kanjiData.strokes[i].path, size, '#2C2C2C', 9);
        i++;
        setTimeout(step, delay);
      }
      step();
    });
  }

  function flashResult(correct) {
    var cx = mainCanvas.width / 2;
    var cy = mainCanvas.height / 2;
    mainCtx.save();
    if (correct) {
      mainCtx.fillStyle = 'rgba(67,160,71,0.10)';
      mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
      mainCtx.strokeStyle = 'rgba(67,160,71,0.92)';
      mainCtx.lineWidth = 14;
      mainCtx.beginPath();
      mainCtx.arc(cx, cy, 56, 0, Math.PI * 2);
      mainCtx.stroke();
    } else {
      mainCtx.fillStyle = 'rgba(229,57,53,0.10)';
      mainCtx.fillRect(0, 0, mainCanvas.width, mainCanvas.height);
      mainCtx.strokeStyle = 'rgba(229,57,53,0.92)';
      mainCtx.lineWidth = 14;
      var r = 40;
      mainCtx.beginPath();
      mainCtx.moveTo(cx - r, cy - r); mainCtx.lineTo(cx + r, cy + r);
      mainCtx.moveTo(cx + r, cy - r); mainCtx.lineTo(cx - r, cy + r);
      mainCtx.stroke();
    }
    mainCtx.restore();
    setTimeout(clearMain, 700);
  }

  return {
    init: init,
    setEnabled: setEnabled,
    clearMain: clearMain,
    clearGuide: clearGuide,
    drawGuide: drawGuide,
    drawGhostGuide: drawGhostGuide,
    playPreview: playPreview,
    flashResult: flashResult,
    isDirectionMatch: isDirectionMatch,
    detectDirection: detectDirection
  };
})();

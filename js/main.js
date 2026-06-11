var KANJI_PER_GAME = 5;
var selectedGrade = 1;
var practiceGrade = 1;
var resetReturnScreen = 'grade'; // リセット画面からの戻り先
var pendingResetGrade = null;   // null = 全学年

// ─── クリア管理 ───────────────────────────────────────
function getClearedSet(grade) {
  try {
    return new Set(JSON.parse(localStorage.getItem('cleared_grade_' + grade) || '[]'));
  } catch (e) { return new Set(); }
}

function markKanjiCleared(grade, kanji) {
  var cleared = getClearedSet(grade);
  cleared.add(kanji);
  localStorage.setItem('cleared_grade_' + grade, JSON.stringify(Array.from(cleared)));
}

function resetCleared(grade) {
  localStorage.removeItem('cleared_grade_' + grade);
}

function showConfirm(grade) {
  pendingResetGrade = grade;
  var label = grade === null ? '全学年' : grade + '年生';
  document.getElementById('confirm-msg').textContent = label + 'のクリア記録を\nリセットしますか？';
  document.getElementById('confirm-modal').classList.remove('hidden');
}

function hideConfirm() {
  document.getElementById('confirm-modal').classList.add('hidden');
}

function returnFromReset() {
  if (resetReturnScreen === 'practice') {
    AudioModule.startPracticeBGM();
    buildPracticeGrid(practiceGrade);
    UI.show('practice');
  } else {
    AudioModule.startMenuBGM();
    updateGradeButtons();
    UI.show('grade');
  }
}

function updateGradeButtons() {
  document.querySelectorAll('.grade-btn').forEach(function (btn) {
    var grade = parseInt(btn.getAttribute('data-grade'), 10);
    var total = getKanjiByGrade(grade).length;
    var cleared = getClearedSet(grade).size;
    var el = btn.querySelector('.grade-progress');
    if (el) el.textContent = cleared + ' / ' + total + ' クリア';
  });
}
// ─────────────────────────────────────────────────────

var state = {
  grade: 1,
  kanjiList: [],
  kanjiIndex: 0,
  strokeIndex: 0,
  missCount: 0,
  kanjiRatings: [],
  waitingForStroke: false,
  isPractice: false,
  gen: 0
};

function calcRating(missCount) {
  if (missCount === 0) return 'perfect';
  if (missCount <= 2) return 'good';
  return 'try';
}

function calcOverallRating(ratings) {
  if (ratings.every(function (r) { return r === 'perfect'; })) return 'perfect';
  if (ratings.every(function (r) { return r !== 'try'; })) return 'good';
  return 'try';
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

// ─── 自由練習 ────────────────────────────────────────
function buildPracticeGrid(grade) {
  practiceGrade = grade;
  var cleared = getClearedSet(grade);
  var list = getKanjiByGrade(grade);

  document.querySelectorAll('.practice-tab').forEach(function (t) {
    t.classList.toggle('active', parseInt(t.getAttribute('data-grade'), 10) === grade);
  });

  var grid = document.getElementById('practice-kanji-grid');
  grid.innerHTML = '';
  list.forEach(function (k) {
    var btn = document.createElement('button');
    btn.className = 'practice-kanji-btn' + (cleared.has(k.kanji) ? ' cleared' : '');
    btn.textContent = k.kanji;
    btn.addEventListener('click', function () { startPracticeGame(k); });
    grid.appendChild(btn);
  });
}

function startPracticeGame(kanjiData) {
  state.gen++;
  state.isPractice = true;
  state.kanjiList = [kanjiData];
  state.kanjiIndex = 0;
  state.kanjiRatings = [];
  AudioModule.startGameBGM();
  startKanji();
}
// ─────────────────────────────────────────────────────

// ゲーム開始
function startGame(grade) {
  state.gen++;
  state.grade = grade;
  state.isPractice = false;
  AudioModule.startGameBGM();

  var all = getKanjiByGrade(grade);
  var cleared = getClearedSet(grade);
  var available = all.filter(function (k) { return !cleared.has(k.kanji); });

  if (available.length === 0) {
    resetCleared(grade);
    available = all;
  }

  var shuffled = available.slice().sort(function () { return Math.random() - 0.5; });
  state.kanjiList = shuffled.slice(0, Math.min(KANJI_PER_GAME, shuffled.length));
  state.kanjiIndex = 0;
  state.kanjiRatings = [];
  startKanji();
}

// 漢字開始
async function startKanji() {
  var myGen = state.gen;
  try {
    var kanji = state.kanjiList[state.kanjiIndex];
    if (!kanji) throw new Error('no kanji');

    state.strokeIndex = 0;
    state.missCount = 0;
    state.waitingForStroke = false;

    UI.setKanjiDisplay(kanji.kanji);
    UI.setReadingDisplay(kanji.on, kanji.kun);
    UI.setQuestionDisplay(state.kanjiIndex + 1, state.kanjiList.length);
    document.getElementById('stroke-count-display').textContent = (kanji.strokeCount || kanji.strokes.length) + '画';
    UI.show('game');

    CanvasModule.clearCorrectStrokes();
    CanvasModule.clearMain();
    CanvasModule.setEnabled(false);
    CanvasModule.clearGuide();

    // 画数ゼロの漢字は自動クリア
    if (!kanji.strokes || kanji.strokes.length === 0) {
      await sleep(300);
      if (state.gen === myGen) onKanjiComplete();
      return;
    }

    document.getElementById('preview-label').classList.add('visible');
    await CanvasModule.playPreview(kanji);
    document.getElementById('preview-label').classList.remove('visible');
    if (state.gen !== myGen) return;
    CanvasModule.clearMain();
    await sleep(400);
    if (state.gen !== myGen) return;

    CanvasModule.drawGuide(kanji, 0);
    state.waitingForStroke = true;
    CanvasModule.setEnabled(true);
  } catch (e) {
    document.getElementById('preview-label').classList.remove('visible');
    if (state.gen === myGen) {
      state.waitingForStroke = true;
      CanvasModule.setEnabled(true);
    }
  }
}

// キャンバスからのコールバック
function onStrokeComplete(direction, initDirection) {
  if (!state.waitingForStroke) return;
  state.waitingForStroke = false;
  CanvasModule.setEnabled(false);
  try {
    var kanji = state.kanjiList[state.kanjiIndex];
    var expected = kanji.strokes[state.strokeIndex].direction;
    var correct = CanvasModule.isDirectionMatch(direction, expected) ||
      (initDirection != null && CanvasModule.isDirectionMatch(initDirection, expected));
    handleStrokeResult(correct);
  } catch (e) {
    state.waitingForStroke = true;
    CanvasModule.setEnabled(true);
  }
}

function handleStrokeResult(correct) {
  var kanji = state.kanjiList[state.kanjiIndex];
  var _gen = state.gen;

  try {
    CanvasModule.addCorrectStroke(kanji.strokes[state.strokeIndex].path);
    CanvasModule.clearMain();
  } catch (e) {}
  if (correct) {
    CanvasModule.flashResult(true);
    AudioModule.playCorrect();
  } else {
    CanvasModule.flashResult(false);
    AudioModule.playMiss();
    state.missCount++;
  }

  state.strokeIndex++;
  try { CanvasModule.drawGuide(kanji, state.strokeIndex); } catch (e) {}

  if (state.strokeIndex >= kanji.strokes.length) {
    setTimeout(function () { if (state.gen === _gen) onKanjiComplete(); }, 900);
  } else {
    setTimeout(function () {
      if (state.gen !== _gen) return;
      state.waitingForStroke = true;
      CanvasModule.setEnabled(true);
    }, 800);
  }
}

async function onKanjiComplete() {
  var myGen = state.gen;
  try {
    var kanji = state.kanjiList[state.kanjiIndex];
    var rating = calcRating(state.missCount);
    state.kanjiRatings.push(rating);
    try { markKanjiCleared(state.isPractice ? kanji.grade : state.grade, kanji.kanji); } catch (e) {}

    if (state.isPractice) {
      try { buildPracticeGrid(practiceGrade); } catch (e) {}
      AudioModule.startPracticeBGM();
      UI.show('practice');
      return;
    }

    // ゲームモード：結果画面は出さず即次の漢字へ
    state.kanjiIndex++;
    if (state.kanjiIndex < state.kanjiList.length) {
      startKanji();
    } else {
      await onGameComplete(myGen);
    }
  } catch (e) {
    if (state.gen !== myGen) return;
    if (!state.isPractice) {
      state.kanjiIndex++;
      if (state.kanjiIndex < state.kanjiList.length) {
        startKanji();
      } else {
        try { await onGameComplete(myGen); } catch (e2) {
          state.gen++;
          AudioModule.startTitleBGM();
          UI.show('title');
        }
      }
    }
  }
}

async function onGameComplete(myGen) {
  if (myGen !== undefined && state.gen !== myGen) return;
  var overallRating = calcOverallRating(state.kanjiRatings);
  try { AudioModule.stopBGM(); } catch (e) {}
  var jingleDone = Promise.resolve();
  try { jingleDone = AudioModule.playResultJingle(overallRating); } catch (e) {}
  UI.showGameClear(state.kanjiRatings);
  // ジングルが鳴り終わるまで待つ（最大 5 秒）
  await Promise.race([jingleDone, sleep(5000)]);

}

// 初期化
document.addEventListener('DOMContentLoaded', function () {
  UI.init();

  var mainCanvas = document.getElementById('main-canvas');
  var guideCanvas = document.getElementById('guide-canvas');
  CanvasModule.init(mainCanvas, guideCanvas, onStrokeComplete);

  // ミュートボタン
  var muteBtn = document.getElementById('btn-mute');
  function updateMuteBtn() {
    var muted = AudioModule.getMuted();
    muteBtn.textContent = muted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', muted);
  }
  updateMuteBtn();
  muteBtn.addEventListener('click', function () {
    AudioModule.toggleMute();
    updateMuteBtn();
  });

  // 初回タップ：オーバーレイを消して BGM 開始
  var tapOverlay = document.getElementById('tap-overlay');
  tapOverlay.addEventListener('click', function () {
    AudioModule.resume();
    AudioModule.startTitleBGM();
    tapOverlay.classList.add('hidden');
  });

  document.getElementById('btn-start').addEventListener('click', function () {
    AudioModule.resume();
    AudioModule.startMenuBGM();
    updateGradeButtons();
    UI.show('grade');
  });

  document.getElementById('btn-practice').addEventListener('click', function () {
    AudioModule.resume();
    AudioModule.startPracticeBGM();
    buildPracticeGrid(practiceGrade);
    UI.show('practice');
  });

  document.getElementById('btn-practice-back').addEventListener('click', function () {
    state.gen++;
    AudioModule.startTitleBGM();
    UI.show('title');
  });

  document.getElementById('btn-practice-reset').addEventListener('click', function () {
    resetReturnScreen = 'practice';
    AudioModule.startTitleBGM();
    UI.show('reset');
  });

  document.getElementById('btn-grade-top').addEventListener('click', function () {
    AudioModule.startTitleBGM();
    UI.show('title');
  });

  document.getElementById('btn-clear-reset').addEventListener('click', function () {
    resetReturnScreen = 'grade';
    AudioModule.startTitleBGM();
    UI.show('reset');
  });

  document.getElementById('btn-reset-back').addEventListener('click', function () {
    returnFromReset();
  });

  document.querySelectorAll('.reset-grade-btn:not(#btn-reset-all)').forEach(function (btn) {
    btn.addEventListener('click', function () {
      showConfirm(parseInt(btn.getAttribute('data-grade'), 10));
    });
  });

  document.getElementById('btn-reset-all').addEventListener('click', function () {
    showConfirm(null);
  });

  document.getElementById('btn-confirm-yes').addEventListener('click', function () {
    hideConfirm();
    if (pendingResetGrade === null) {
      for (var g = 1; g <= 6; g++) resetCleared(g);
    } else {
      resetCleared(pendingResetGrade);
    }
    returnFromReset();
  });

  document.getElementById('btn-confirm-no').addEventListener('click', function () {
    hideConfirm();
  });

  document.getElementById('btn-howto').addEventListener('click', function () {
    AudioModule.resume();
    AudioModule.startTitleBGM();
    UI.show('howto');
  });

  document.getElementById('btn-howto-back').addEventListener('click', function () {
    AudioModule.startTitleBGM();
    UI.show('title');
  });

  // 練習グレードタブ（動的生成）
  var tabsEl = document.getElementById('practice-tabs');
  for (var g = 1; g <= 6; g++) {
    (function (grade) {
      var tab = document.createElement('button');
      tab.className = 'practice-tab' + (grade === 1 ? ' active' : '');
      tab.setAttribute('data-grade', grade);
      tab.textContent = grade + '年';
      tab.addEventListener('click', function () { buildPracticeGrid(grade); });
      tabsEl.appendChild(tab);
    })(g);
  }

  document.getElementById('btn-count-back').addEventListener('click', function () {
    AudioModule.startMenuBGM();
    updateGradeButtons();
    UI.show('grade');
  });

  document.querySelectorAll('.grade-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      selectedGrade = parseInt(btn.getAttribute('data-grade'), 10);
      AudioModule.startMenuBGM();
      UI.show('count');
    });
  });

  document.querySelectorAll('.count-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      KANJI_PER_GAME = parseInt(btn.getAttribute('data-count'), 10);
      startGame(selectedGrade);
    });
  });

  document.getElementById('btn-grade-select').addEventListener('click', function () {
    state.gen++;
    AudioModule.startMenuBGM();
    updateGradeButtons();
    UI.show('grade');
  });

  document.getElementById('btn-restart').addEventListener('click', function () {
    AudioModule.resume();
    startGame(state.grade);
  });

  document.getElementById('btn-top').addEventListener('click', function () {
    state.gen++;
    AudioModule.startTitleBGM();
    UI.show('title');
  });

  document.getElementById('btn-game-top').addEventListener('click', function () {
    CanvasModule.setEnabled(false);
    state.gen++;
    AudioModule.startTitleBGM();
    updateGradeButtons();
    UI.show('title');
  });

  document.getElementById('btn-game-restart').addEventListener('click', function () {
    CanvasModule.setEnabled(false);
    state.gen++;
    state.kanjiIndex = 0;
    state.kanjiRatings = [];
    startKanji();
  });
});

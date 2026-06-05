var ROUND_MULTIPLIERS = [1.0, 1.5, 2.0];
var KANJI_PER_GAME = 10;

var state = {
  grade: 1,
  kanjiList: [],
  kanjiIndex: 0,
  round: 1,
  strokeIndex: 0,
  missCount: 0,
  totalMiss: 0,
  score: 0,
  kanjiScore: 0,
  kanjiStars: [],
  stopBeat: null,
  waitingForStroke: false,
  beatCount: 0,
  lastBeatTime: 0,
  strokeDeadline: 0
};

function getBPM(kanjiData, round) {
  var multipliers = [1.0, 1.4, 1.8];
  return Math.round(kanjiData.bpmBase * multipliers[round - 1]);
}

function calcStrokeScore(onTime, round) {
  var base = onTime ? 100 : 60;
  return Math.round(base * ROUND_MULTIPLIERS[round - 1]);
}

function calcBonus(totalMiss) {
  if (totalMiss === 0) return 500;
  if (totalMiss <= 2) return 200;
  return 0;
}

function calcStars(totalMiss) {
  if (totalMiss === 0) return 3;
  if (totalMiss <= 3) return 2;
  return 1;
}

function sleep(ms) {
  return new Promise(function (r) { setTimeout(r, ms); });
}

// ゲーム開始
function startGame(grade) {
  state.grade = grade;
  state.kanjiList = getRandomKanji(grade, KANJI_PER_GAME);
  state.kanjiIndex = 0;
  state.score = 0;
  state.kanjiStars = [];
  Audio.startBGM();
  UI.setScore(0);
  startKanji();
}

// 漢字開始
async function startKanji() {
  var kanji = state.kanjiList[state.kanjiIndex];
  state.round = 1;
  state.totalMiss = 0;
  state.kanjiScore = 0;

  UI.setKanjiDisplay(kanji.kanji);
  UI.setRoundDisplay(1);
  UI.setMissCount(0);
  UI.resetBeat();
  UI.show('game');
  CanvasModule.setEnabled(false);

  // 漢字プレビューアニメ
  await CanvasModule.playPreview(kanji);
  await sleep(300);

  startRound();
}

// Round開始
function startRound() {
  var kanji = state.kanjiList[state.kanjiIndex];
  state.strokeIndex = 0;
  state.missCount = 0;
  state.waitingForStroke = false;
  state.beatCount = 0;

  UI.show('game');
  UI.setRoundDisplay(state.round);
  UI.setMissCount(0);
  UI.resetBeat();
  CanvasModule.clearMain();
  CanvasModule.setEnabled(false);

  if (state.round === 1) {
    CanvasModule.drawGuide(kanji, 0);
  } else {
    CanvasModule.clearGuide();
  }

  if (state.stopBeat) { state.stopBeat(); state.stopBeat = null; }

  var bpm = getBPM(kanji, state.round);
  state.stopBeat = Audio.startBeatScheduler(bpm, function (beatTime) {
    onBeat(beatTime);
  });
}

function onBeat(beatTime) {
  var kanji = state.kanjiList[state.kanjiIndex];
  if (!kanji) return;

  UI.pulseBeat();

  // 前のビートで画が完了していなかった場合はミス
  if (state.waitingForStroke && state.beatCount > 0) {
    handleStrokeResult(false, false);
  }

  // 全画完了済みなら何もしない
  if (state.strokeIndex >= kanji.strokes.length) return;

  // 次の画の入力を待つ
  state.waitingForStroke = true;
  state.beatCount++;

  var bpm = getBPM(kanji, state.round);
  state.strokeDeadline = beatTime + (60 / bpm) * 0.95;

  CanvasModule.setEnabled(true);
  CanvasModule.clearMain();

  if (state.round === 2) {
    CanvasModule.drawGhostGuide(kanji, state.strokeIndex);
  } else if (state.round === 1) {
    CanvasModule.drawGuide(kanji, state.strokeIndex);
  }
}

// キャンバスモジュールからのコールバック
function onStrokeComplete(direction) {
  if (!state.waitingForStroke) return;
  state.waitingForStroke = false;
  CanvasModule.setEnabled(false);

  var kanji = state.kanjiList[state.kanjiIndex];
  var expected = kanji.strokes[state.strokeIndex].direction;
  var correct = CanvasModule.isDirectionMatch(direction, expected);

  var ac = new (window.AudioContext || window.webkitAudioContext)();
  var onTime = ac.currentTime <= state.strokeDeadline;

  handleStrokeResult(correct, onTime);
}

function handleStrokeResult(correct, onTime) {
  var kanji = state.kanjiList[state.kanjiIndex];

  if (correct) {
    CanvasModule.flashResult(true);
    var pts = calcStrokeScore(onTime, state.round);
    state.score += pts;
    state.kanjiScore += pts;
    UI.setScore(state.score);
  } else {
    CanvasModule.flashResult(false);
    Audio.playMiss();
    state.missCount++;
    state.totalMiss++;
    UI.setMissCount(state.missCount);
  }

  state.strokeIndex++;

  if (state.round === 1) {
    CanvasModule.drawGuide(kanji, state.strokeIndex);
  }

  if (state.strokeIndex >= kanji.strokes.length) {
    CanvasModule.setEnabled(false);
    if (state.stopBeat) { state.stopBeat(); state.stopBeat = null; }
    setTimeout(onRoundComplete, 400);
  }
}

async function onRoundComplete() {
  UI.showRoundResult(state.missCount);
  await sleep(1100);

  if (state.round < 3) {
    state.round++;
    startRound();
  } else {
    await onKanjiComplete();
  }
}

async function onKanjiComplete() {
  var kanji = state.kanjiList[state.kanjiIndex];
  var bonus = calcBonus(state.totalMiss);
  var stars = calcStars(state.totalMiss);
  state.score += bonus;
  state.kanjiScore += bonus;
  state.kanjiStars.push(stars);

  Audio.playClear();
  UI.setScore(state.score);
  UI.showKanjiClear(kanji.kanji, stars, state.kanjiScore);
  await sleep(2200);

  state.kanjiIndex++;
  if (state.kanjiIndex < state.kanjiList.length) {
    startKanji();
  } else {
    onGameComplete();
  }
}

function onGameComplete() {
  if (state.stopBeat) { state.stopBeat(); state.stopBeat = null; }
  Audio.stopBGM();
  Audio.playGameClear();

  var totalStars = state.kanjiStars.reduce(function (a, b) { return a + b; }, 0);
  var bestKey = 'best_grade_' + state.grade;
  var prevBest = parseInt(localStorage.getItem(bestKey) || '0', 10);
  var isNewBest = state.score > prevBest;
  if (isNewBest) localStorage.setItem(bestKey, state.score);
  var best = isNewBest ? state.score : prevBest;

  UI.showGameClear(state.score, totalStars, state.grade, best, isNewBest);

  document.getElementById('btn-share').onclick = function () {
    var text = '「漢字リズム」' + state.grade + '年生をプレイ！スコア: ' +
      state.score.toLocaleString() + '点 ★×' + totalStars + '個 #漢字リズム';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { alert('コピーしました！'); });
    } else {
      prompt('このテキストをコピーしてください', text);
    }
  };
}

// 初期化
document.addEventListener('DOMContentLoaded', function () {
  UI.init();

  var mainCanvas = document.getElementById('main-canvas');
  var guideCanvas = document.getElementById('guide-canvas');
  CanvasModule.init(mainCanvas, guideCanvas, onStrokeComplete);

  document.getElementById('btn-start').addEventListener('click', function () {
    Audio.resume();
    UI.show('grade');
  });

  document.querySelectorAll('.grade-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var grade = parseInt(btn.getAttribute('data-grade'), 10);
      startGame(grade);
    });
  });

  document.getElementById('btn-retry').addEventListener('click', function () {
    Audio.resume();
    startGame(state.grade);
  });

  document.getElementById('btn-grade-select').addEventListener('click', function () {
    Audio.stopBGM();
    if (state.stopBeat) { state.stopBeat(); state.stopBeat = null; }
    UI.show('grade');
  });
});

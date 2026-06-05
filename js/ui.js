var UI = (function () {
  var screens = {};
  var beatDots = [];
  var beatPhase = 0;

  function init() {
    document.querySelectorAll('.screen').forEach(function (el) {
      screens[el.id.replace('screen-', '')] = el;
    });
    beatDots = Array.from(document.querySelectorAll('.beat-dot'));
  }

  function show(name) {
    Object.values(screens).forEach(function (s) { s.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
  }

  function setKanjiDisplay(kanji) {
    document.getElementById('kanji-display').textContent = kanji;
  }

  function setRoundDisplay(round) {
    document.getElementById('round-display').textContent = 'Round ' + round + ' / 3';
  }

  function setMissCount(n) {
    document.getElementById('miss-count').textContent = n;
  }

  function setScore(n) {
    document.getElementById('score-display').textContent = n.toLocaleString();
  }

  function pulseBeat() {
    beatDots.forEach(function (d) { d.classList.remove('active'); });
    beatDots[beatPhase % beatDots.length].classList.add('active');
    beatPhase++;
  }

  function resetBeat() {
    beatPhase = 0;
    beatDots.forEach(function (d) { d.classList.remove('active'); });
  }

  function showRoundResult(missCount) {
    show('round-result');
    var el = document.getElementById('round-result-text');
    var label = document.getElementById('round-result-label');
    if (missCount === 0) {
      el.textContent = '◎';
      el.style.color = '#43A047';
      label.textContent = 'パーフェクト！';
    } else if (missCount <= 2) {
      el.textContent = '○';
      el.style.color = '#1E88E5';
      label.textContent = 'クリア！';
    } else {
      el.textContent = '△';
      el.style.color = '#FB8C00';
      label.textContent = 'がんばろう！';
    }
  }

  function showKanjiClear(kanji, stars, addedScore) {
    show('kanji-clear');
    document.getElementById('kanji-clear-kanji').textContent = kanji;
    var starsEl = document.getElementById('kanji-clear-stars');
    starsEl.innerHTML = '';
    for (var i = 0; i < 3; i++) {
      var span = document.createElement('span');
      span.textContent = i < stars ? '★' : '☆';
      span.className = i < stars ? 'star filled' : 'star empty';
      starsEl.appendChild(span);
    }
    document.getElementById('kanji-clear-score').textContent = '+' + addedScore.toLocaleString() + '点';
  }

  function showGameClear(totalScore, totalStars, grade, bestScore, isNewBest) {
    show('game-clear');
    document.getElementById('total-score').textContent = 'スコア: ' + totalScore.toLocaleString() + '点';
    document.getElementById('total-stars').innerHTML = '★ ' + totalStars + ' <span class="stars-denom">/ 30</span>';
    var bestEl = document.getElementById('best-score');
    if (isNewBest) {
      bestEl.innerHTML = '🎉 NEW BEST! ' + bestScore.toLocaleString() + '点';
      bestEl.className = 'new-best';
    } else {
      bestEl.textContent = 'ベスト: ' + bestScore.toLocaleString() + '点';
      bestEl.className = '';
    }
  }

  return {
    init: init,
    show: show,
    setKanjiDisplay: setKanjiDisplay,
    setRoundDisplay: setRoundDisplay,
    setMissCount: setMissCount,
    setScore: setScore,
    pulseBeat: pulseBeat,
    resetBeat: resetBeat,
    showRoundResult: showRoundResult,
    showKanjiClear: showKanjiClear,
    showGameClear: showGameClear
  };
})();

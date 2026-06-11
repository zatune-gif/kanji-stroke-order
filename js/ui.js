var UI = (function () {
  var screens = {};

  var RATING = {
    perfect: { label: 'パーフェクト！', cls: 'rating-perfect' },
    good:    { label: 'もうちょっと！', cls: 'rating-good' },
    try:     { label: 'がんばろう！',   cls: 'rating-try' }
  };

  function init() {
    document.querySelectorAll('.screen').forEach(function (el) {
      screens[el.id.replace('screen-', '')] = el;
    });
  }

  function show(name) {
    Object.values(screens).forEach(function (s) { s.classList.remove('active'); });
    if (screens[name]) screens[name].classList.add('active');
  }

  function setKanjiDisplay(kanji) {
    document.getElementById('kanji-display').textContent = kanji;
  }

  function setReadingDisplay(on, kun) {
    var parts = [];
    if (on && on.length)  parts.push('音：' + on.join('・'));
    if (kun && kun.length) parts.push('訓：' + kun.join('・'));
    document.getElementById('reading-display').textContent = parts.join('　');
  }

  function setQuestionDisplay(current, total) {
    document.getElementById('question-display').textContent = current + ' / ' + total + '問';
  }

  function showGameClear(ratings) {
    show('game-clear');
    var counts = { perfect: 0, good: 0, try: 0 };
    ratings.forEach(function (r) { if (counts[r] !== undefined) counts[r]++; });

    var lines = [];
    if (counts.perfect) lines.push('<span class="rating-perfect">' + RATING.perfect.label + '</span> ' + counts.perfect + '問');
    if (counts.good)    lines.push('<span class="rating-good">'    + RATING.good.label    + '</span> ' + counts.good    + '問');
    if (counts.try)     lines.push('<span class="rating-try">'     + RATING.try.label     + '</span> ' + counts.try     + '問');

    document.getElementById('game-clear-ratings').innerHTML = lines.join('<br>');
  }

  return {
    init: init,
    show: show,
    setKanjiDisplay: setKanjiDisplay,
    setReadingDisplay: setReadingDisplay,
    setQuestionDisplay: setQuestionDisplay,
    showGameClear: showGameClear,
    RATING: RATING
  };
})();

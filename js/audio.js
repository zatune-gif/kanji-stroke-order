var Audio = (function () {
  var NativeAudio = window.Audio; // window.Audio が上書きされる前に退避
  var ctx = null;
  var currentBGMKey = null;
  var audioUnlocked = false;
  var isMuted = localStorage.getItem('muted') === '1';
  var BGM_VOL = 0.5;

  var BGM_FILES = {
    title:    'bgm/title/こんとどぅふぇ素材No.0057-やすみじっかーん！.mp3',
    menu:     'bgm/menu/こんとどぅふぇ素材No.0088-もりのふしぎ.mp3',
    game:     'bgm/game/こんとどぅふぇ素材No.0175-ここなっつかふぇ.mp3',
    practice: 'bgm/practice/こんとどぅふぇ素材No.0098-目が覚めた.mp3'
  };

  var RESULT_FILES = {
    perfect: 'bgm/perfect/jingle_12.mp3',
    good:    'bgm/good/maou_se_jingle05.mp3',
    try:     'bgm/try/maou_se_jingle06.mp3'
  };

  // ─── BGM プレイヤーを初期化（HTML Audio） ────────────
  var bgmPlayers = {};
  Object.keys(BGM_FILES).forEach(function (key) {
    var a = new NativeAudio(BGM_FILES[key]);
    a.loop = true;
    a.volume = 0;
    a._fadeTimer = null;
    bgmPlayers[key] = a;
  });

  // ─── ジングルは Web Audio API で管理 ─────────────────
  // iOS は HTMLAudioElement の volume/muted を JS から変更できないため
  // AudioContext (タップで解放済み) 経由で再生する
  var jingleBuffers = {};   // AudioBuffer をキャッシュ
  var jingleSourceNode = null;
  var resultJingleResolve = null;

  // ─── Web Audio API ────────────────────────────────────
  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  // ─── タップ時のアンロック ─────────────────────────────
  function resume() {
    var ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
    if (audioUnlocked) return;
    audioUnlocked = true;

    // ジングルを Web Audio 用にデコード開始（バックグラウンドで）
    Object.keys(RESULT_FILES).forEach(function (key) {
      fetch(RESULT_FILES[key])
        .then(function (r) { return r.arrayBuffer(); })
        .then(function (buf) { return ac.decodeAudioData(buf); })
        .then(function (decoded) { jingleBuffers[key] = decoded; })
        .catch(function () {});
    });

    // BGM プレイヤーをアンロック
    Object.keys(bgmPlayers).forEach(function (key) {
      var a = bgmPlayers[key];
      a.volume = 0;
      a.play().then(function () {
        if (currentBGMKey !== key) {
          a.pause();
          a.currentTime = 0;
        }
      }).catch(function () {});
    });
  }

  // ─── フェードイン ──────────────────────────────────────
  function fadeIn(audio, durationMs) {
    clearInterval(audio._fadeTimer);
    var steps = Math.max(1, Math.round(durationMs / 16));
    var step = 0;
    audio._fadeTimer = setInterval(function () {
      step++;
      audio.volume = Math.min(BGM_VOL, BGM_VOL * (step / steps));
      if (step >= steps) {
        clearInterval(audio._fadeTimer);
        audio._fadeTimer = null;
        audio.volume = BGM_VOL;
      }
    }, durationMs / steps);
  }

  // ─── 全 BGM プレイヤーを即時停止 ──────────────────────
  function stopAll() {
    Object.keys(bgmPlayers).forEach(function (key) {
      var a = bgmPlayers[key];
      clearInterval(a._fadeTimer);
      a._fadeTimer = null;
      a.volume = 0;
      a.pause();
      a.currentTime = 0;
    });
  }

  // ─── BGM 切替 ─────────────────────────────────────────
  function switchBGM(key) {
    if (currentBGMKey === key) return;
    currentBGMKey = key;

    Object.keys(bgmPlayers).forEach(function (k) {
      if (k === key) return;
      var a = bgmPlayers[k];
      clearInterval(a._fadeTimer);
      a._fadeTimer = null;
      a.volume = 0;
      a.pause();
      a.currentTime = 0;
    });

    if (isMuted) return;

    var next = bgmPlayers[key];
    next.currentTime = 0;
    next.volume = 0;
    next.play().catch(function () {});
    fadeIn(next, 600);
  }

  // ─── 結果ジングル（Web Audio API） ────────────────────
  function stopResultJingle() {
    if (resultJingleResolve) { resultJingleResolve(); resultJingleResolve = null; }
    if (jingleSourceNode) {
      try { jingleSourceNode.stop(); } catch (e) {}
      jingleSourceNode = null;
    }
  }

  function playResultJingle(rating) {
    stopResultJingle();
    if (isMuted) return Promise.resolve();

    var deadline = Date.now() + 3000; // 最大 3 秒待機
    var p = new Promise(function (resolve) {
      resultJingleResolve = resolve;

      function tryPlay() {
        if (!resultJingleResolve) return; // stopResultJingle で中断済み
        if (Date.now() > deadline) { resolve(); return; } // タイムアウト
        var buf = jingleBuffers[rating];
        if (!buf) { setTimeout(tryPlay, 100); return; } // 100ms 後に再試行

        var ac = getCtx();
        var src = ac.createBufferSource();
        src.buffer = buf;
        var gain = ac.createGain();
        gain.gain.value = 0.7;
        src.connect(gain);
        gain.connect(ac.destination);
        src.onended = function () {
          if (resultJingleResolve === resolve) resultJingleResolve = null;
          jingleSourceNode = null;
          resolve();
        };
        src.start();
        jingleSourceNode = src;
      }

      tryPlay();
    });
    return p;
  }

  // ─── BGM 停止（クリア画面などで使用） ──────────────────
  function stopBGM() {
    currentBGMKey = null;
    stopAll();
    stopResultJingle();
  }

  function startTitleBGM()    { switchBGM('title'); }
  function startMenuBGM()     { switchBGM('menu'); }
  function startGameBGM()     { switchBGM('game'); }
  function startPracticeBGM() { switchBGM('practice'); }

  // ─── ミュート ──────────────────────────────────────────
  function toggleMute() {
    isMuted = !isMuted;
    localStorage.setItem('muted', isMuted ? '1' : '0');

    if (isMuted) {
      stopAll();
      stopResultJingle();
    } else {
      if (currentBGMKey) {
        var a = bgmPlayers[currentBGMKey];
        a.currentTime = 0;
        a.volume = 0;
        a.play().catch(function () {});
        fadeIn(a, 400);
      }
    }
    return isMuted;
  }

  function getMuted() { return isMuted; }

  // ─── 効果音（Web Audio API）────────────────────────────
  function playTone(freq, type, vol, startTime, dur) {
    if (isMuted) return;
    var ac = getCtx();
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + dur);
    osc.start(startTime);
    osc.stop(startTime + dur + 0.01);
  }

  function playCorrect() {
    var ac = getCtx();
    playTone(660, 'sine', 0.22, ac.currentTime, 0.12);
  }

  function playMiss() {
    var ac = getCtx();
    playTone(160, 'sawtooth', 0.18, ac.currentTime, 0.25);
  }

  return {
    resume: resume,
    startTitleBGM: startTitleBGM,
    startMenuBGM: startMenuBGM,
    startGameBGM: startGameBGM,
    startPracticeBGM: startPracticeBGM,
    stopBGM: stopBGM,
    toggleMute: toggleMute,
    getMuted: getMuted,
    playResultJingle: playResultJingle,
    playCorrect: playCorrect,
    playMiss: playMiss
  };
})();

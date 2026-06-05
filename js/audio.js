var Audio = (function () {
  var ctx = null;
  var bgmHandle = null;
  var beatTimerId = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  function resume() {
    var ac = getCtx();
    if (ac.state === 'suspended') ac.resume();
  }

  function playTone(freq, type, vol, startTime, dur) {
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

  function playBeat(time) {
    var ac = getCtx();
    playTone(900, 'sine', 0.35, time, 0.07);
  }

  function playClear() {
    var ac = getCtx();
    var freqs = [523, 659, 784];
    for (var i = 0; i < freqs.length; i++) {
      playTone(freqs[i], 'sine', 0.28, ac.currentTime + i * 0.13, 0.28);
    }
  }

  function playMiss() {
    var ac = getCtx();
    playTone(160, 'sawtooth', 0.18, ac.currentTime, 0.25);
  }

  function playGameClear() {
    var ac = getCtx();
    var freqs = [523, 659, 784, 1047];
    for (var i = 0; i < freqs.length; i++) {
      playTone(freqs[i], 'sine', 0.28, ac.currentTime + i * 0.15, 0.45);
    }
  }

  // 正確なビートスケジューラ（Web Audio APIタイマー使用）
  function startBeatScheduler(bpm, onBeat) {
    var ac = getCtx();
    var intervalSec = 60 / bpm;
    var LOOKAHEAD = 0.12;
    var TICK_MS = 25;
    var nextBeatTime = ac.currentTime + 0.05;
    var stopped = false;

    function tick() {
      if (stopped) return;
      while (nextBeatTime < ac.currentTime + LOOKAHEAD) {
        playBeat(nextBeatTime);
        onBeat(nextBeatTime);
        nextBeatTime += intervalSec;
      }
      beatTimerId = setTimeout(tick, TICK_MS);
    }
    tick();

    return function stop() {
      stopped = true;
      clearTimeout(beatTimerId);
    };
  }

  function startBGM() {
    stopBGM();
    var ac = getCtx();
    // ペンタトニックスケールのシンプルなループ
    var notes = [261, 294, 329, 392, 440, 392, 329, 294];
    var noteDur = 0.28;
    var loopDur = notes.length * noteDur;
    var startTime = ac.currentTime + 0.1;
    var timerId = null;
    var running = true;

    function scheduleLoop(t) {
      if (!running) return;
      for (var i = 0; i < notes.length; i++) {
        playTone(notes[i], 'triangle', 0.055, t + i * noteDur, noteDur * 0.85);
      }
      timerId = setTimeout(function () { scheduleLoop(t + loopDur); }, (loopDur - 0.15) * 1000);
    }

    scheduleLoop(startTime);
    bgmHandle = function () { running = false; clearTimeout(timerId); };
  }

  function stopBGM() {
    if (bgmHandle) { bgmHandle(); bgmHandle = null; }
  }

  return {
    resume: resume,
    playClear: playClear,
    playMiss: playMiss,
    playGameClear: playGameClear,
    startBeatScheduler: startBeatScheduler,
    startBGM: startBGM,
    stopBGM: stopBGM
  };
})();

'use strict';
/**
 * Drift Legends -- Audio Module
 * All sounds procedurally generated via Web Audio API oscillators.
 */
(function () {
  let ctx = null;
  let masterGain = null;
  let engineOsc = null;
  let engineGain = null;
  let muted = localStorage.getItem('dl-muted') === 'true';
  let volume = 0.4;
  let engineRunning = false;

  function ensureContext() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : volume;
      masterGain.connect(ctx.destination);
    }
    // iOS Safari requires resume() inside a user gesture — call defensively every time
    if (ctx.state === 'suspended') {
      ctx.resume().catch(function() {});
    }
    return ctx;
  }

  // Prime audio context on first user interaction (required for iOS)
  document.addEventListener('pointerdown', function() { ensureContext(); }, { once: true });

  function playTone(freq, duration, type, vol, detune) {
    try {
      const c = ensureContext();
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = type || 'sine';
      osc.frequency.value = freq;
      if (detune) osc.detune.value = detune;
      g.gain.value = (vol || 0.3) * volume;
      g.gain.setTargetAtTime(0, c.currentTime + duration * 0.7, duration * 0.15);
      osc.connect(g);
      g.connect(masterGain);
      osc.start(c.currentTime);
      osc.stop(c.currentTime + duration);
    } catch (_) { /* ignore audio errors */ }
  }

  function playNoise(duration, filterFreq, vol) {
    try {
      const c = ensureContext();
      const bufferSize = c.sampleRate * duration;
      const buffer = c.createBuffer(1, bufferSize, c.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const src = c.createBufferSource();
      src.buffer = buffer;
      const filter = c.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = filterFreq || 2000;
      filter.Q.value = 1.5;
      const g = c.createGain();
      g.gain.value = (vol || 0.2) * volume;
      g.gain.setTargetAtTime(0, c.currentTime + duration * 0.5, duration * 0.25);
      src.connect(filter);
      filter.connect(g);
      g.connect(masterGain);
      src.start(c.currentTime);
      src.stop(c.currentTime + duration);
    } catch (_) { /* ignore */ }
  }

  // Engine — two oscillators for richer sound (fundamental + harmonic)
  var engineOsc2 = null;
  var engineGain2 = null;

  function startEngine() {
    if (engineRunning) return;
    try {
      var c = ensureContext();
      // Fundamental — low sawtooth
      engineOsc = c.createOscillator();
      engineGain = c.createGain();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 75;
      engineGain.gain.value = 0.06 * volume;
      engineOsc.connect(engineGain);
      engineGain.connect(masterGain);
      engineOsc.start();

      // Harmonic — higher, quieter square for grit
      engineOsc2 = c.createOscillator();
      engineGain2 = c.createGain();
      engineOsc2.type = 'square';
      engineOsc2.frequency.value = 150;
      engineGain2.gain.value = 0.02 * volume;
      engineOsc2.connect(engineGain2);
      engineGain2.connect(masterGain);
      engineOsc2.start();

      engineRunning = true;
    } catch (_) { /* ignore */ }
  }

  function stopEngine() {
    if (!engineRunning) return;
    try { if (engineOsc) engineOsc.stop(); } catch (_) {}
    try { if (engineOsc2) engineOsc2.stop(); } catch (_) {}
    engineOsc = null; engineGain = null;
    engineOsc2 = null; engineGain2 = null;
    engineRunning = false;
  }

  function updateEngineSound(speed, maxSpeed) {
    if (!engineRunning || !engineOsc) return;
    var ratio = Math.min(speed / maxSpeed, 1);
    // Fundamental pitch: 75-280Hz based on speed
    engineOsc.frequency.value = 75 + ratio * 205;
    if (engineGain) engineGain.gain.value = (0.04 + ratio * 0.06) * volume;
    // Harmonic follows at 2x frequency
    if (engineOsc2) engineOsc2.frequency.value = 150 + ratio * 350;
    if (engineGain2) engineGain2.gain.value = (0.01 + ratio * 0.03) * volume;
  }

  const Audio = {
    isMuted() { return muted; },

    toggle() {
      muted = !muted;
      localStorage.setItem('dl-muted', String(muted));
      if (masterGain) masterGain.gain.value = muted ? 0 : volume;
      return muted;
    },

    setVolume(v) {
      volume = Math.max(0, Math.min(1, v));
      if (masterGain && !muted) masterGain.gain.value = volume;
    },

    play(soundId) {
      if (muted) return;
      switch (soundId) {
        case 'click':
          playTone(880, 0.03, 'square', 0.15);
          break;
        case 'countdown':
          playTone(440, 0.08, 'sine', 0.3);
          break;
        case 'go':
          playTone(880, 0.2, 'sine', 0.4);
          break;
        case 'drift':
          // Tire screech — high-pitched noise burst
          playNoise(0.3, 4000, 0.12);
          playNoise(0.5, 2500, 0.08);
          break;
        case 'boost':
          // Whoosh — rising pitch sweep
          playTone(150, 0.1, 'sine', 0.25);
          playTone(300, 0.15, 'sine', 0.3);
          playTone(600, 0.2, 'sine', 0.25);
          playTone(1000, 0.15, 'sine', 0.15);
          playNoise(0.3, 5000, 0.1);
          break;
        case 'collision':
          // Impact — low thud + metallic clang
          playTone(60, 0.1, 'sine', 0.4);
          playNoise(0.2, 800, 0.25);
          playTone(2000, 0.05, 'square', 0.15);
          break;
        case 'lap':
          // Checkpoint chime — ascending arpeggio
          playTone(523, 0.08, 'sine', 0.25);
          setTimeout(function() { playTone(659, 0.08, 'sine', 0.25); }, 60);
          setTimeout(function() { playTone(784, 0.12, 'sine', 0.3); }, 120);
          break;
        case 'checkpoint':
          // Quick ping
          playTone(1200, 0.05, 'sine', 0.2);
          playTone(1500, 0.05, 'sine', 0.15);
          break;
        case 'handbrake':
          // Tire squeal — sharp noise
          playNoise(0.15, 5000, 0.15);
          playTone(800, 0.1, 'sawtooth', 0.08);
          break;
        case 'offroad':
          // Rumble — low noise
          playNoise(0.2, 300, 0.1);
          break;
        case 'win':
          [523, 659, 784, 1047].forEach((f, i) =>
            setTimeout(() => playTone(f, 0.15, 'sine', 0.3), i * 120));
          break;
        case 'lose':
          [392, 349, 330, 262].forEach((f, i) =>
            setTimeout(() => playTone(f, 0.15, 'sine', 0.25), i * 120));
          break;
        case 'star':
          for (let i = 0; i < 5; i++)
            setTimeout(() => playTone(1200 + Math.random() * 800, 0.06, 'sine', 0.15), i * 40);
          break;
        case 'unlock':
          for (let i = 0; i < 8; i++)
            setTimeout(() => playTone(400 + i * 80, 0.08, 'sine', 0.2), i * 50);
          break;
        case 'nitro':
          playTone(300, 0.05, 'sine', 0.2);
          playTone(600, 0.08, 'sine', 0.15);
          break;
        default:
          break;
      }
    },

    startEngine,
    stopEngine,
    updateEngineSound,
    ensureContext,

    // BGM — procedural looping bass line per environment
    startBGM(envType) {
      this.stopBGM();
      if (muted) return;
      try {
        var c = ensureContext();
        // Bass patterns per environment (note frequencies)
        var patterns = {
          city:   [65, 82, 98, 82, 65, 98, 110, 82],       // E2-based, dark
          desert: [73, 87, 110, 87, 73, 110, 130, 87],      // D2-based, rhythmic
          ice:    [55, 65, 82, 65, 55, 82, 98, 65],         // A1-based, ambient
          jungle: [82, 98, 110, 130, 110, 98, 82, 65],      // E2-based, driving
          sky:    [98, 110, 130, 165, 130, 110, 98, 82],    // G2-based, epic
        };
        var notes = patterns[envType] || patterns.city;
        var beatDuration = 0.25; // 240 BPM feel
        var loopDuration = notes.length * beatDuration;

        // Create a looping bass oscillator
        this._bgmOsc = c.createOscillator();
        this._bgmGain = c.createGain();
        this._bgmOsc.type = 'triangle';
        this._bgmGain.gain.value = 0.04 * volume;

        // Low-pass filter for warmth
        this._bgmFilter = c.createBiquadFilter();
        this._bgmFilter.type = 'lowpass';
        this._bgmFilter.frequency.value = 200;
        this._bgmFilter.Q.value = 2;

        this._bgmOsc.connect(this._bgmFilter);
        this._bgmFilter.connect(this._bgmGain);
        this._bgmGain.connect(masterGain);

        // Schedule note changes
        var now = c.currentTime;
        this._bgmOsc.frequency.setValueAtTime(notes[0], now);
        // Schedule 20 loops worth of notes (~40 seconds)
        for (var loop = 0; loop < 20; loop++) {
          for (var n = 0; n < notes.length; n++) {
            var t = now + (loop * loopDuration) + (n * beatDuration);
            this._bgmOsc.frequency.setValueAtTime(notes[n], t);
          }
        }
        this._bgmOsc.start();

        // Hi-hat rhythm — quiet noise ticks
        this._bgmHat = c.createBufferSource();
        var hatDuration = loopDuration * 20;
        var hatBuffer = c.createBuffer(1, c.sampleRate * hatDuration, c.sampleRate);
        var hatData = hatBuffer.getChannelData(0);
        var samplesPerBeat = Math.floor(c.sampleRate * beatDuration / 2);
        for (var s = 0; s < hatData.length; s++) {
          // Click on every half-beat
          if (s % samplesPerBeat < 200) {
            hatData[s] = (Math.random() * 2 - 1) * 0.3;
          }
        }
        this._bgmHat.buffer = hatBuffer;
        var hatGain = c.createGain();
        hatGain.gain.value = 0.015 * volume;
        var hatFilter = c.createBiquadFilter();
        hatFilter.type = 'highpass';
        hatFilter.frequency.value = 6000;
        this._bgmHat.connect(hatFilter);
        hatFilter.connect(hatGain);
        hatGain.connect(masterGain);
        this._bgmHat.start();
        this._bgmHatGain = hatGain;
      } catch (_) { /* ignore */ }
    },

    stopBGM() {
      try { if (this._bgmOsc) this._bgmOsc.stop(); } catch (_) {}
      try { if (this._bgmHat) this._bgmHat.stop(); } catch (_) {}
      this._bgmOsc = null; this._bgmGain = null; this._bgmFilter = null;
      this._bgmHat = null; this._bgmHatGain = null;
    },
  };

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.Audio = Audio;
})();

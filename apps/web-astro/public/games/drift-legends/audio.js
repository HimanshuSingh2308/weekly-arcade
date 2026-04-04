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
        var now = c.currentTime;
        var bpm = { city: 130, desert: 120, ice: 110, jungle: 140, sky: 150 }[envType] || 130;
        var beat = 60 / bpm;
        var totalBeats = 256; // ~2 min at 130bpm
        this._bgmNodes = [];

        // Bass notes per environment (root notes for power chords)
        var bassNotes = {
          city:   [82, 82, 110, 98, 82, 82, 110, 130],
          desert: [73, 73, 98, 87, 73, 73, 98, 110],
          ice:    [65, 65, 82, 73, 65, 65, 82, 98],
          jungle: [98, 98, 130, 110, 98, 98, 130, 165],
          sky:    [110, 110, 147, 130, 110, 110, 147, 165],
        };
        var notes = bassNotes[envType] || bassNotes.city;
        var barLength = notes.length * beat;

        // ── BASS (triangle, low-passed) ──
        var bassOsc = c.createOscillator();
        var bassGain = c.createGain();
        var bassFilter = c.createBiquadFilter();
        bassOsc.type = 'triangle';
        bassGain.gain.value = 0.05 * volume;
        bassFilter.type = 'lowpass'; bassFilter.frequency.value = 250;
        bassOsc.connect(bassFilter); bassFilter.connect(bassGain); bassGain.connect(masterGain);
        for (var loop = 0; loop < 32; loop++) {
          for (var n = 0; n < notes.length; n++) {
            bassOsc.frequency.setValueAtTime(notes[n], now + loop * barLength + n * beat);
          }
        }
        bassOsc.start(now); bassOsc.stop(now + totalBeats * beat);
        this._bgmNodes.push(bassOsc);
        this._bgmGain = bassGain;

        // ── DISTORTED GUITAR (sawtooth → waveshaper → bandpass) ──
        var guitarOsc = c.createOscillator();
        var guitarGain = c.createGain();
        var distortion = c.createWaveShaper();
        var guitarFilter = c.createBiquadFilter();
        guitarOsc.type = 'sawtooth';
        guitarGain.gain.value = 0.025 * volume;
        // Distortion curve
        var curve = new Float32Array(256);
        for (var i = 0; i < 256; i++) { var x = (i / 128) - 1; curve[i] = (Math.PI + 200) * x / (Math.PI + 200 * Math.abs(x)); }
        distortion.curve = curve;
        distortion.oversample = '2x';
        guitarFilter.type = 'bandpass'; guitarFilter.frequency.value = 800; guitarFilter.Q.value = 1;
        guitarOsc.connect(distortion); distortion.connect(guitarFilter); guitarFilter.connect(guitarGain); guitarGain.connect(masterGain);
        // Power chords: root + fifth (1.5x freq)
        for (var loop = 0; loop < 32; loop++) {
          for (var n = 0; n < notes.length; n++) {
            var t = now + loop * barLength + n * beat;
            guitarOsc.frequency.setValueAtTime(notes[n] * 2, t); // one octave up
            // Staccato: brief volume punch on each note
            guitarGain.gain.setValueAtTime(0.03 * volume, t);
            guitarGain.gain.setTargetAtTime(0.015 * volume, t + beat * 0.3, beat * 0.2);
          }
        }
        guitarOsc.start(now); guitarOsc.stop(now + totalBeats * beat);
        this._bgmNodes.push(guitarOsc);

        // ── DRUMS (noise-based kick + snare + hi-hat) ──
        var drumDuration = totalBeats * beat;
        var drumBuffer = c.createBuffer(1, Math.floor(c.sampleRate * drumDuration), c.sampleRate);
        var d = drumBuffer.getChannelData(0);
        var sr = c.sampleRate;
        for (var b = 0; b < totalBeats; b++) {
          var sampleStart = Math.floor(b * beat * sr);
          var beatInBar = b % 4;
          // Kick on 1 and 3
          if (beatInBar === 0 || beatInBar === 2) {
            for (var k = 0; k < Math.min(sr * 0.08, d.length - sampleStart); k++) {
              d[sampleStart + k] += Math.sin(k / sr * 2 * Math.PI * (80 - k / sr * 300)) * Math.exp(-k / sr * 30) * 0.4;
            }
          }
          // Snare on 2 and 4
          if (beatInBar === 1 || beatInBar === 3) {
            for (var s = 0; s < Math.min(sr * 0.06, d.length - sampleStart); s++) {
              d[sampleStart + s] += (Math.random() * 2 - 1) * Math.exp(-s / sr * 40) * 0.3;
            }
          }
          // Hi-hat on every 8th note
          var eighthOffset = Math.floor(beat * 0.5 * sr);
          for (var h = 0; h < 2; h++) {
            var hStart = sampleStart + h * eighthOffset;
            if (hStart >= d.length) break;
            for (var hi = 0; hi < Math.min(sr * 0.02, d.length - hStart); hi++) {
              d[hStart + hi] += (Math.random() * 2 - 1) * Math.exp(-hi / sr * 80) * 0.12;
            }
          }
        }
        var drumSrc = c.createBufferSource();
        drumSrc.buffer = drumBuffer;
        var drumGain = c.createGain();
        drumGain.gain.value = 0.06 * volume;
        drumSrc.connect(drumGain); drumGain.connect(masterGain);
        drumSrc.start(now);
        this._bgmNodes.push(drumSrc);
        this._bgmHatGain = drumGain;
      } catch (_) { /* ignore */ }
    },

    pauseBGM() {
      try { if (this._bgmGain) this._bgmGain.gain.value = 0; } catch (_) {}
      try { if (this._bgmHatGain) this._bgmHatGain.gain.value = 0; } catch (_) {}
    },

    resumeBGM() {
      try { if (this._bgmGain && !muted) this._bgmGain.gain.value = 0.04 * volume; } catch (_) {}
      try { if (this._bgmHatGain && !muted) this._bgmHatGain.gain.value = 0.015 * volume; } catch (_) {}
    },

    stopBGM() {
      if (this._bgmNodes) {
        this._bgmNodes.forEach(function(node) { try { node.stop(); } catch(_) {} });
      }
      this._bgmNodes = null; this._bgmGain = null; this._bgmHatGain = null;
    },
  };

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.Audio = Audio;
})();

'use strict';
/**
 * Drift Legends -- Input Module
 * Keyboard, touch (Babylon.js GUI virtual controls), and gamepad.
 */
(function () {
  const keys = {};
  const state = {
    accelerate: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    drift: false,
    pause: false,
    mute: false,
    steer: 0,           // -1 (left) to 1 (right), ramped for analog feel
  };

  let steerRampLeft = 0;
  let steerRampRight = 0;
  const STEER_RAMP_SPEED = 5.0;  // ramp to full in ~200ms at 60fps
  const STEER_DECAY_SPEED = 8.0;

  // Touch state (set from GUI controls via setTouch)
  const touch = {
    accelerate: false,
    brake: false,
    steerLeft: false,
    steerRight: false,
    drift: false,
  };

  let isMobile = false;

  function detectMobile() {
    isMobile = ('ontouchstart' in window) ||
      (navigator.maxTouchPoints > 0) ||
      (window.innerWidth < 768);
    return isMobile;
  }
  detectMobile();

  // Keyboard listeners
  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'KeyP' || e.code === 'Escape') state.pause = true;
    if (e.code === 'KeyM') state.mute = true;
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  // Gamepad support
  function pollGamepad() {
    const gp = navigator.getGamepads ? navigator.getGamepads()[0] : null;
    if (!gp) return;
    // Left stick horizontal for steering
    const lx = gp.axes[0] || 0;
    if (Math.abs(lx) > 0.15) {
      if (lx < 0) { touch.steerLeft = true; touch.steerRight = false; }
      else { touch.steerRight = true; touch.steerLeft = false; }
    } else {
      touch.steerLeft = false;
      touch.steerRight = false;
    }
    // Right trigger = accelerate, Left trigger = brake
    touch.accelerate = (gp.buttons[7] && gp.buttons[7].value > 0.1);
    touch.brake = (gp.buttons[6] && gp.buttons[6].value > 0.1);
    // A/X = drift
    touch.drift = !!(gp.buttons[0] && gp.buttons[0].pressed);
  }

  function update(dt) {
    pollGamepad();

    // Combine keyboard + touch
    state.accelerate = keys['ArrowUp'] || keys['KeyW'] || touch.accelerate;
    state.brake = keys['ArrowDown'] || keys['KeyS'] || touch.brake;
    state.steerLeft = keys['ArrowLeft'] || keys['KeyA'] || touch.steerLeft;
    state.steerRight = keys['ArrowRight'] || keys['KeyD'] || touch.steerRight;
    state.drift = keys['Space'] || keys['ShiftLeft'] || keys['ShiftRight'] || touch.drift;

    // Analog steering ramp
    if (state.steerLeft) {
      steerRampLeft = Math.min(1, steerRampLeft + STEER_RAMP_SPEED * dt);
    } else {
      steerRampLeft = Math.max(0, steerRampLeft - STEER_DECAY_SPEED * dt);
    }
    if (state.steerRight) {
      steerRampRight = Math.min(1, steerRampRight + STEER_RAMP_SPEED * dt);
    } else {
      steerRampRight = Math.max(0, steerRampRight - STEER_DECAY_SPEED * dt);
    }
    state.steer = steerRampRight - steerRampLeft;
  }

  function consumePause() {
    if (state.pause) { state.pause = false; return true; }
    return false;
  }

  function consumeMute() {
    if (state.mute) { state.mute = false; return true; }
    return false;
  }

  function setTouch(key, val) {
    touch[key] = !!val;
  }

  const Input = {
    state,
    keys,
    update,
    consumePause,
    consumeMute,
    setTouch,
    isMobile() { return isMobile; },
    detectMobile,
  };

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.Input = Input;
})();

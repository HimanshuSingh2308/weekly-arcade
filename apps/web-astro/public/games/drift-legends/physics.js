'use strict';
/**
 * Drift Legends -- Arcade Vehicle Physics
 * No Havok -- custom arcade model for fun, responsive handling.
 */
(function () {
  const V3 = BABYLON.Vector3;

  // Car type configurations: [speed(1-10), handling(1-10), driftPower(1-10)]
  const CAR_CONFIGS = {
    'street-kart': { speed: 6, handling: 7, drift: 6, color: '#1a5fb4' },
    'drift-racer': { speed: 5, handling: 8, drift: 7, color: '#cc0000' },
    'sand-runner': { speed: 9, handling: 5, drift: 5, color: '#c8a000' },
  };

  function getPhysicsConfig(carId) {
    const stats = CAR_CONFIGS[carId] || CAR_CONFIGS['street-kart'];
    return {
      topSpeed: (1.0 + stats.speed * 0.04) * 50,           // faster top speed
      acceleration: 30 + stats.speed * 2.5,                 // snappier acceleration
      brakeForce: 35,
      reverseSpeed: 10,
      reverseAccel: 15,
      turnRate: 1.8 + stats.handling * 0.18,
      driftTurnRate: 2.2 + stats.handling * 0.22,
      driftFillRate: 0.7 + stats.drift * 0.07,
      normalFriction: 0.975,                                // slightly less drag = faster feel
      driftFriction: 0.988,
      boostMultiplier: 1.6,
      boostDuration: 2.5,
    };
  }

  class ArcadeVehicle {
    constructor(mesh, carId) {
      this.mesh = mesh;
      this.carId = carId;
      this.config = getPhysicsConfig(carId);
      this.velocity = V3.Zero();
      this.speed = 0;
      this.angularVelocity = 0;

      // Drift state
      this.isDrifting = false;
      this.driftMeter = 0;         // 0-1
      this.driftAngle = 0;
      this.driftScore = 0;
      this.totalDriftScore = 0;

      // Boost state
      this.isBoosting = false;
      this.boostTimer = 0;
      this.boostLevel = 0;         // 0=none, 1=mini, 2=super

      // Collision
      this.collisionCooldown = 0;
      this.wallHitThisLap = false;

      // Nitro pad
      this.nitroPadTimer = 0;
    }

    update(dt, inputs, trackBounds) {
      const cfg = this.config;

      // Boost timer
      if (this.isBoosting) {
        this.boostTimer -= dt;
        if (this.boostTimer <= 0) {
          this.isBoosting = false;
          this.boostTimer = 0;
        }
      }

      // Nitro pad timer
      if (this.nitroPadTimer > 0) {
        this.nitroPadTimer -= dt;
      }

      // Effective top speed
      let effectiveTopSpeed = cfg.topSpeed;
      if (this.isBoosting) effectiveTopSpeed *= cfg.boostMultiplier;
      if (this.nitroPadTimer > 0) effectiveTopSpeed *= 1.25;

      // Acceleration
      if (inputs.accelerate) {
        const forwardDir = this.getForward();
        const accelFactor = this.speed < effectiveTopSpeed * 0.6
          ? cfg.acceleration
          : cfg.acceleration * Math.sqrt(Math.max(0, 1 - this.speed / effectiveTopSpeed));
        this.velocity.addInPlace(forwardDir.scale(accelFactor * dt));
      }

      // Braking / Reverse
      if (inputs.brake) {
        const forwardDot = V3.Dot(this.velocity, this.getForward());
        if (forwardDot > 0.5) {
          // Moving forward — apply brakes
          const brakeDir = this.velocity.normalizeToNew().scale(-1);
          this.velocity.addInPlace(brakeDir.scale(cfg.brakeForce * dt));
        } else {
          // Stopped or nearly stopped — reverse
          const reverseDir = this.getForward().scale(-1);
          this.velocity.addInPlace(reverseDir.scale(cfg.reverseAccel * dt));
          // Cap reverse speed
          if (this.velocity.length() > cfg.reverseSpeed) {
            this.velocity.normalize().scaleInPlace(cfg.reverseSpeed);
          }
        }
      }

      // Speed cap
      this.speed = this.velocity.length();
      if (this.speed > effectiveTopSpeed) {
        this.velocity.scaleInPlace(effectiveTopSpeed / this.speed);
        this.speed = effectiveTopSpeed;
      }

      // Steering: D/Right → positive steer → positive angularVelocity → rotation.y increases
      // In our test: rotation.y DECREASE = visual left, rotation.y INCREASE = visual right
      // D → steer = +1 → we need rotation.y to increase → steerInput must be positive
      const steerInput = inputs.steer || 0;
      const speedFactor = Math.min(this.speed / (cfg.topSpeed * 0.3), 1);

      if (inputs.drift && this.speed > cfg.topSpeed * 0.2 && Math.abs(steerInput) > 0.1) {
        // Drift mode
        if (!this.isDrifting) {
          this.isDrifting = true;
          this.driftAngle = 0;
        }
        this.angularVelocity = steerInput * cfg.driftTurnRate * speedFactor;
        this._applyDriftPhysics(dt, steerInput);

        // Fill drift meter
        this.driftAngle = Math.min(45, Math.abs(this._getLateralAngle()));
        const fillRate = this.driftAngle / 45 * cfg.driftFillRate;
        this.driftMeter = Math.min(1, this.driftMeter + fillRate * dt);
        this.driftScore += this.driftAngle * dt * 0.5;
      } else {
        // Normal steering
        this.angularVelocity = steerInput * cfg.turnRate * speedFactor;

        // Release drift -- check for boost
        if (this.isDrifting) {
          this._releaseDrift();
          this.isDrifting = false;
        }
      }

      // Apply rotation (works in forward and reverse)
      if (this.speed > 0.3) {
        // Reverse steering direction when going backward
        const forwardDot = V3.Dot(this.velocity, this.getForward());
        const reverseSign = forwardDot < -0.5 ? -1 : 1;
        this.mesh.rotation.y += this.angularVelocity * reverseSign * dt;
      }

      // Friction
      const friction = this.isDrifting ? cfg.driftFriction : cfg.normalFriction;
      this.velocity.scaleInPlace(Math.pow(friction, dt * 60));

      // Apply velocity
      this.mesh.position.addInPlace(this.velocity.scale(dt));

      // Keep on ground
      this.mesh.position.y = 0;

      // Collision cooldown
      if (this.collisionCooldown > 0) this.collisionCooldown -= dt;

      // Update speed reading
      this.speed = this.velocity.length();
    }

    _applyDriftPhysics(dt, steerDir) {
      const right = this.getRight();
      const lateralSpeed = V3.Dot(this.velocity, right);
      // Reduce lateral grip during drift (creates slide sensation)
      this.velocity.subtractInPlace(right.scale(lateralSpeed * 0.25 * dt * 60));
    }

    _getLateralAngle() {
      if (this.speed < 0.5) return 0;
      const forward = this.getForward();
      const velDir = this.velocity.normalizeToNew();
      const dot = V3.Dot(forward, velDir);
      return Math.acos(Math.max(-1, Math.min(1, dot))) * (180 / Math.PI);
    }

    _releaseDrift() {
      this.totalDriftScore += this.driftScore;
      this.driftScore = 0;

      if (this.driftMeter < 0.33) {
        this.boostLevel = 0;
      } else if (this.driftMeter < 0.66) {
        this.boostLevel = 1;
        this.isBoosting = true;
        this.boostTimer = 0.8;
      } else {
        this.boostLevel = 2;
        this.isBoosting = true;
        this.boostTimer = 2.0;
      }
      this.driftMeter = 0;
      this.driftAngle = 0;
    }

    applyWallBounce(normal) {
      if (this.collisionCooldown > 0) return;
      this.velocity = BABYLON.Vector3.Reflect(this.velocity, normal).scale(0.6);
      this.speed = this.velocity.length();
      this.collisionCooldown = 0.3;
      this.wallHitThisLap = true;
    }

    applyNitroPad() {
      this.nitroPadTimer = 1.5;
    }

    resetLapCollision() {
      this.wallHitThisLap = false;
    }

    getForward() {
      const m = this.mesh.getWorldMatrix();
      return new V3(m.m[8], m.m[9], m.m[10]).normalize();
    }

    getRight() {
      const m = this.mesh.getWorldMatrix();
      return new V3(m.m[0], m.m[1], m.m[2]).normalize();
    }

    getDisplaySpeed() {
      return Math.round((this.speed / this.config.topSpeed) * 120);
    }

    reset(pos, rotY) {
      this.mesh.position = pos.clone();
      this.mesh.rotation.y = rotY || 0;
      this.velocity = V3.Zero();
      this.speed = 0;
      this.isDrifting = false;
      this.driftMeter = 0;
      this.driftAngle = 0;
      this.driftScore = 0;
      this.isBoosting = false;
      this.boostTimer = 0;
      this.boostLevel = 0;
      this.wallHitThisLap = false;
      this.nitroPadTimer = 0;
    }
  }

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.Physics = { ArcadeVehicle, getPhysicsConfig, CAR_CONFIGS };
})();

'use strict';
/**
 * Drift Legends -- Chase Camera
 * Smooth follow camera with boost FOV widening and collision shake.
 */
(function () {
  const V3 = BABYLON.Vector3;

  class ChaseCamera {
    constructor(scene) {
      this.camera = new BABYLON.FreeCamera('chaseCamera', new V3(0, 10, -15), scene);
      this.camera.minZ = 0.5;
      this.camera.maxZ = 500;
      this.camera.fov = 0.9;
      this.scene = scene;
      this.target = null;

      // Follow params
      this.offsetDistance = 8;
      this.offsetHeight = 3.5;
      this.lookAheadHeight = 1.0;
      this.smoothing = 0.1;

      // Boost FOV
      this.baseFov = 0.9;
      this.boostFov = 1.05;

      // Shake
      this.shakeAmount = 0;
      this.shakeDecay = 5;
    }

    setTarget(mesh) {
      this.target = mesh;
    }

    update(dt, isBoosting) {
      if (!this.target) return;

      const targetPos = this.target.position;
      // Get car's backward direction for camera placement
      const m = this.target.getWorldMatrix();
      const carBack = new V3(-m.m[8], -m.m[9], -m.m[10]).normalize();

      const idealPos = targetPos.add(
        carBack.scale(this.offsetDistance)
      ).add(new V3(0, this.offsetHeight, 0));

      // Smooth follow
      V3.LerpToRef(this.camera.position, idealPos, this.smoothing, this.camera.position);

      // Look at car
      const lookTarget = targetPos.add(new V3(0, this.lookAheadHeight, 0));
      const currentTarget = this.camera.getTarget();
      const smoothedTarget = V3.Lerp(currentTarget, lookTarget, 0.15);
      this.camera.setTarget(smoothedTarget);

      // FOV boost effect
      const targetFov = isBoosting ? this.boostFov : this.baseFov;
      this.camera.fov = BABYLON.Scalar.Lerp(this.camera.fov, targetFov, 0.05);

      // Camera shake
      if (this.shakeAmount > 0.001) {
        this.camera.position.x += (Math.random() - 0.5) * this.shakeAmount;
        this.camera.position.y += (Math.random() - 0.5) * this.shakeAmount * 0.5;
        this.shakeAmount *= Math.exp(-this.shakeDecay * dt);
      }
    }

    shake(intensity) {
      this.shakeAmount = intensity || 0.3;
    }

    /** Set camera for menu view (orbiting overview) */
    setMenuView(center) {
      this.camera.position = new V3(center.x + 10, center.y + 8, center.z + 10);
      this.camera.setTarget(center);
    }

    /** Set camera for result screen (pulled back, looking down) */
    setResultView(carPos) {
      const pos = carPos.add(new V3(5, 6, 5));
      this.camera.position = pos;
      this.camera.setTarget(carPos.add(new V3(0, 1, 0)));
    }

    /**
     * Cinematic intro camera sweep.
     * Flies over the track showing all cars, then swoops behind the player car.
     * @param {Array} cars - Array of car meshes [{mesh, name}]
     * @param {object} trackData - track data with splinePoints, startPosition
     * @param {number} duration - total intro duration in seconds
     * @param {function} onComplete - called when intro finishes
     */
    startCinematicIntro(cars, trackData, duration, onComplete) {
      this._cinematic = {
        cars: cars,
        trackData: trackData,
        duration: duration || 5,
        elapsed: 0,
        onComplete: onComplete,
        active: true,
        phase: 0,  // 0 = wide overhead, 1 = pan across cars, 2 = swoop behind player
      };

      // Start with a wide overhead shot
      const startPos = trackData.startPosition;
      this.camera.position = new V3(startPos.x, 25, startPos.z - 30);
      this.camera.setTarget(new V3(startPos.x, 0, startPos.z));
    }

    updateCinematic(dt) {
      if (!this._cinematic || !this._cinematic.active) return false;
      const c = this._cinematic;
      c.elapsed += dt;
      const progress = Math.min(c.elapsed / c.duration, 1);

      try {

      const startPos = c.trackData.startPosition;
      const playerCar = c.cars[0] ? c.cars[0].position : startPos;

      if (progress < 0.35) {
        // Phase 1: Wide overhead sweep — camera orbits above the starting grid
        const angle = progress / 0.35 * Math.PI * 0.6;
        const radius = 25;
        const height = 18 - progress / 0.35 * 5;
        this.camera.position = new V3(
          startPos.x + Math.sin(angle) * radius,
          height,
          startPos.z + Math.cos(angle) * radius
        );
        // Look at center of all cars
        var centerX = 0, centerZ = 0, count = 0;
        c.cars.forEach(function(car) {
          centerX += car.position.x;
          centerZ += car.position.z;
          count++;
        });
        if (count > 0) {
          centerX /= count;
          centerZ /= count;
        } else {
          centerX = startPos.x;
          centerZ = startPos.z;
        }
        this.camera.setTarget(new V3(centerX, 0.5, centerZ));

      } else if (progress < 0.7) {
        // Phase 2: Low fly-by past the AI cars toward player
        const t = (progress - 0.35) / 0.35;
        const eased = t * t * (3 - 2 * t);

        // Use track-relative offset (perpendicular to start direction)
        var ry = c.trackData ? c.trackData.startRotation : (this.target ? this.target.rotation.y : 0);
        var sideX = Math.cos(ry) * 6; // perpendicular to track
        var sideZ = -Math.sin(ry) * 6;

        var lastAI = c.cars.length > 1 ? c.cars[c.cars.length - 1].position : startPos;
        const fromPos = new V3(lastAI.x + sideX, 3, lastAI.z + sideZ);
        const toPos = new V3(playerCar.x + sideX * 0.5, 2.5, playerCar.z + sideZ * 0.5);

        V3.LerpToRef(fromPos, toPos, eased, this.camera.position);
        const lookTarget = V3.Lerp(lastAI, playerCar, Math.min(1, eased + 0.3));
        lookTarget.y = 1;
        this.camera.setTarget(lookTarget);

      } else {
        // Phase 3: Swoop behind player car into chase cam position
        const t = (progress - 0.7) / 0.3;
        const eased = t * t * (3 - 2 * t);

        // Target: directly behind the player car using trackData.startRotation
        var ry = c.trackData ? c.trackData.startRotation : (this.target ? this.target.rotation.y : 0);
        var finalPos = new V3(
          playerCar.x - Math.sin(ry) * this.offsetDistance,
          playerCar.y + this.offsetHeight,
          playerCar.z - Math.cos(ry) * this.offsetDistance
        );
        var finalLook = playerCar.add(new V3(0, this.lookAheadHeight, 0));

        // Lerp with strong easing — fully arrive by end of phase
        V3.LerpToRef(this.camera.position, finalPos, eased, this.camera.position);
        var lookAt = V3.Lerp(this.camera.getTarget(), finalLook, eased);
        this.camera.setTarget(lookAt);
      }

      } catch (e) {
        console.error('[Cinematic] Error in phase:', e);
      }

      if (progress >= 1) {
        c.active = false;
        try { if (c.onComplete) c.onComplete(); } catch (e2) { console.error('[Cinematic] onComplete error:', e2); }
        return false;
      }
      return true; // still active
    }

    detach() {
      this.camera.detachControl();
    }

    attach(canvas) {
      // We don't actually attach pointer controls -- camera is fully scripted
      // But this restores the active camera
      this.scene.activeCamera = this.camera;
    }
  }

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.ChaseCamera = ChaseCamera;
})();

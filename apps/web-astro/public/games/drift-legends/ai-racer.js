'use strict';
/**
 * Drift Legends -- AI Racer System
 * Follows track spline waypoints with personality-driven behavior.
 */
(function () {
  const V3 = BABYLON.Vector3;
  const TB = () => window.DriftLegends.TrackBuilder;

  // AI States
  const AI_STATE = {
    RACING: 'RACING',
    ATTACKING: 'ATTACKING',
    RECOVERING: 'RECOVERING',
    RUBBER_BANDING: 'RUBBER_BANDING',
  };

  // Personality traits
  const PERSONALITIES = {
    aggressive: { speedVariance: 0.05, lineVariance: 0.3, ramChance: 0.3, blockChance: 0 },
    technical:  { speedVariance: 0.02, lineVariance: 0.1, ramChance: 0, blockChance: 0.1 },
    defensive:  { speedVariance: 0.03, lineVariance: 0.1, ramChance: 0, blockChance: 0.5 },
    dirty:      { speedVariance: 0.06, lineVariance: 0.4, ramChance: 0.2, blockChance: 0.2 },
    champion:   { speedVariance: 0.01, lineVariance: 0.05, ramChance: 0.15, blockChance: 0.3 },
    filler:     { speedVariance: 0.08, lineVariance: 0.3, ramChance: 0, blockChance: 0 },
  };

  class AIRacer {
    constructor(carMesh, personality, chapterConfig) {
      this.mesh = carMesh;
      this.personality = PERSONALITIES[personality] || PERSONALITIES.filler;
      this.personalityName = personality;

      // Chapter difficulty
      this.speedMultiplier = chapterConfig?.aiSpeedMultiplier || 0.9;
      this.driftFrequency = chapterConfig?.aiDriftFrequency || 0.3;
      this.rubberBandCap = chapterConfig?.rubberBandCap || 1.2;

      // State
      this.state = AI_STATE.RACING;
      this.splineT = 0;           // position on track (0-1)
      this.speed = 0;
      this.targetSpeed = 5;
      this.lap = 0;
      this.lastCheckpoint = 0;
      this.checkpointSeq = [];
      this.lapTimes = [];
      this.lapStartTime = 0;
      this.finished = false;
      this.finishTime = 0;

      // Drift simulation
      this.isDrifting = false;
      this.driftScore = 0;

      // Rubber banding
      this.rubberBandFactor = 1.0;
    }

    update(dt, trackData, playerPosition, playerLap, raceTime) {
      if (this.finished) return;
      if (!trackData || !trackData.splinePoints) return;

      const splinePoints = trackData.splinePoints;
      const baseSpeed = this.targetSpeed * this.speedMultiplier;

      // Calculate distance to player for rubber banding
      this._updateRubberBand(playerPosition, playerLap);

      // Determine AI state
      this._updateState(playerPosition);

      // Speed based on state
      let currentSpeed = baseSpeed;
      switch (this.state) {
        case AI_STATE.ATTACKING:
          currentSpeed *= 1.05;
          break;
        case AI_STATE.RUBBER_BANDING:
          currentSpeed *= this.rubberBandFactor;
          break;
        case AI_STATE.RECOVERING:
          currentSpeed *= 0.7;
          break;
      }

      // Apply personality speed variance
      const variance = (Math.sin(raceTime * 2 + this.splineT * 10) * 0.5 + 0.5) * this.personality.speedVariance;
      currentSpeed *= (1 + variance);

      this.speed = currentSpeed;

      // Move along spline
      const splineLength = splinePoints.length;
      const advance = (currentSpeed * dt) / (splineLength * 0.3);
      this.splineT += advance;

      // Lap completion
      if (this.splineT >= 1.0) {
        this.splineT -= 1.0;
        this.lap++;
        const lapTime = raceTime - this.lapStartTime;
        this.lapTimes.push(lapTime);
        this.lapStartTime = raceTime;
        this.lastCheckpoint = 0;
        this.checkpointSeq = [];
      }

      // Update mesh position
      const targetPos = TB().getSplinePoint(splinePoints, this.splineT % 1);
      const tangent = TB().getSplineTangent(splinePoints, this.splineT % 1);

      // Offset from center for personality
      const right = V3.Cross(tangent, V3.Up()).normalize();
      const lineOffset = (Math.sin(this.splineT * Math.PI * 4) * this.personality.lineVariance) * trackData.trackDef.trackWidth * 0.3;
      const offsetPos = targetPos.add(right.scale(lineOffset));

      // Smooth movement
      V3.LerpToRef(this.mesh.position, new V3(offsetPos.x, 0, offsetPos.z), 0.15, this.mesh.position);

      // Face direction of travel
      const angle = Math.atan2(tangent.x, tangent.z);
      let angleDiff = angle - this.mesh.rotation.y;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      this.mesh.rotation.y += angleDiff * 0.1;

      // Drift simulation (visual only)
      this.isDrifting = Math.abs(angleDiff) > 0.15 && Math.random() < this.driftFrequency;
      if (this.isDrifting) {
        this.driftScore += Math.abs(angleDiff) * dt * 15;
      }

      // Update checkpoint progress
      this._updateCheckpoints(trackData);
    }

    _updateRubberBand(playerPosition, playerLap) {
      if (!playerPosition) { this.rubberBandFactor = 1.0; return; }

      const dist = V3.Distance(this.mesh.position, playerPosition);
      const lapDiff = playerLap - this.lap;

      // Behind the player
      if (lapDiff > 0 || (lapDiff === 0 && dist > 30)) {
        this.rubberBandFactor = Math.min(this.rubberBandCap, 1.0 + dist * 0.003);
        this.state = AI_STATE.RUBBER_BANDING;
      }
      // Ahead of player
      else if (lapDiff < 0 || (lapDiff === 0 && dist > 30)) {
        this.rubberBandFactor = Math.max(0.9, 1.0 - dist * 0.002);
      } else {
        this.rubberBandFactor = 1.0;
      }
    }

    _updateState(playerPosition) {
      if (!playerPosition) return;
      if (this.state === AI_STATE.RUBBER_BANDING) return; // already set

      const dist = V3.Distance(this.mesh.position, playerPosition);
      if (dist < 5) {
        this.state = AI_STATE.ATTACKING;
      } else {
        this.state = AI_STATE.RACING;
      }
    }

    _updateCheckpoints(trackData) {
      const checkpoints = trackData.checkpointPositions;
      for (let i = this.lastCheckpoint; i < checkpoints.length; i++) {
        const cp = checkpoints[i];
        const dist = V3.Distance(this.mesh.position, cp.position);
        if (dist < trackData.trackDef.trackWidth) {
          this.lastCheckpoint = i + 1;
          this.checkpointSeq.push(i);
        }
      }
    }

    getPosition() {
      return this.mesh.position;
    }

    getSplineT() {
      return this.splineT + this.lap;
    }

    reset(startPos, rotY) {
      this.mesh.position = startPos.clone();
      this.mesh.rotation.y = rotY || 0;
      this.splineT = 0;
      this.speed = 0;
      this.lap = 0;
      this.lastCheckpoint = 0;
      this.checkpointSeq = [];
      this.lapTimes = [];
      this.lapStartTime = 0;
      this.finished = false;
      this.finishTime = 0;
      this.isDrifting = false;
      this.driftScore = 0;
      this.rubberBandFactor = 1.0;
      this.state = AI_STATE.RACING;
    }
  }

  function createRivalRacer(scene, chapter, trackData) {
    const rival = chapter.rival;
    const carMesh = window.DriftLegends.CarBuilder.buildRivalCar(scene, rival.name.toLowerCase(), rival.carId);
    const ai = new AIRacer(carMesh, rival.personality, chapter);
    ai.targetSpeed = 14;
    return ai;
  }

  function createFillerRacers(scene, chapter, trackData, count) {
    const racers = [];
    for (let i = 0; i < count; i++) {
      const carMesh = window.DriftLegends.CarBuilder.buildAICar(scene, i);
      const ai = new AIRacer(carMesh, 'filler', chapter);
      ai.targetSpeed = 10 + Math.random() * 3;
      racers.push(ai);
    }
    return racers;
  }

  /** Position racers at staggered start positions */
  function positionAtStart(racers, startPos, startRot, trackWidth) {
    const offsets = [
      new V3(-trackWidth * 0.15, 0, -4),
      new V3(trackWidth * 0.15, 0, -8),
      new V3(-trackWidth * 0.15, 0, -12),
    ];
    const forward = new V3(Math.sin(startRot), 0, Math.cos(startRot));
    const right = V3.Cross(forward, V3.Up()).normalize();

    racers.forEach((racer, i) => {
      if (i >= offsets.length) return;
      const offset = offsets[i];
      const pos = startPos.add(forward.scale(offset.z)).add(right.scale(offset.x));
      racer.reset(pos, startRot);
    });
  }

  /** Get sorted race positions (all racers including player) */
  function getRacePositions(playerT, racers) {
    // playerT = player's splineT + lap
    const entries = [{ id: 'player', t: playerT }];
    racers.forEach((r, i) => {
      entries.push({ id: 'ai_' + i, t: r.getSplineT(), racer: r });
    });
    entries.sort((a, b) => b.t - a.t);
    return entries;
  }

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.AIRacer = {
    AIRacer,
    createRivalRacer,
    createFillerRacers,
    positionAtStart,
    getRacePositions,
    AI_STATE,
  };
})();

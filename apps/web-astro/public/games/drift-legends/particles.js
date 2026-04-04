'use strict';
/**
 * Drift Legends -- Particle Effects
 * Drift smoke, boost flames, confetti, collision sparks.
 */
(function () {
  const V3 = BABYLON.Vector3;
  const Color4 = BABYLON.Color4;

  function createDriftSmoke(scene) {
    const ps = new BABYLON.ParticleSystem('driftSmoke', 60, scene);
    ps.particleTexture = null; // use default white
    ps.createPointEmitter(new V3(-0.2, 0, -0.2), new V3(0.2, 0.3, 0.2));
    ps.color1 = new Color4(0.6, 0.6, 0.6, 0.6);
    ps.color2 = new Color4(0.4, 0.4, 0.4, 0.4);
    ps.colorDead = new Color4(0.3, 0.3, 0.3, 0);
    ps.minSize = 0.3;
    ps.maxSize = 0.8;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.8;
    ps.emitRate = 0;
    ps.gravity = new V3(0, 0.5, 0);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1.0;
    ps.updateSpeed = 0.02;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    return ps;
  }

  function createBoostFlame(scene) {
    const ps = new BABYLON.ParticleSystem('boostFlame', 80, scene);
    ps.particleTexture = null;
    ps.createPointEmitter(new V3(-0.1, 0, -0.5), new V3(0.1, 0.1, -1));
    ps.color1 = new Color4(1, 0.5, 0, 1);
    ps.color2 = new Color4(0, 0.6, 1, 1);
    ps.colorDead = new Color4(1, 0.2, 0, 0);
    ps.minSize = 0.15;
    ps.maxSize = 0.4;
    ps.minLifeTime = 0.1;
    ps.maxLifeTime = 0.3;
    ps.emitRate = 0;
    ps.gravity = new V3(0, 0.2, 0);
    ps.minEmitPower = 2;
    ps.maxEmitPower = 4;
    ps.updateSpeed = 0.02;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.start();
    return ps;
  }

  function createConfetti(scene, position) {
    const ps = new BABYLON.ParticleSystem('confetti', 200, scene);
    ps.particleTexture = null;
    ps.emitter = position.clone();
    ps.createSphereEmitter(3);
    const colors = [
      new Color4(1, 0.3, 0, 1),
      new Color4(0, 0.7, 1, 1),
      new Color4(1, 0.85, 0, 1),
      new Color4(0, 1, 0.5, 1),
      new Color4(1, 0, 0.5, 1),
    ];
    ps.color1 = colors[Math.floor(Math.random() * colors.length)];
    ps.color2 = colors[Math.floor(Math.random() * colors.length)];
    ps.colorDead = new Color4(1, 1, 1, 0);
    ps.minSize = 0.08;
    ps.maxSize = 0.2;
    ps.minLifeTime = 1.5;
    ps.maxLifeTime = 3.0;
    ps.emitRate = 150;
    ps.gravity = new V3(0, -3, 0);
    ps.minEmitPower = 3;
    ps.maxEmitPower = 6;
    ps.updateSpeed = 0.02;
    ps.targetStopDuration = 2;
    ps.disposeOnStop = true;
    ps.start();
    return ps;
  }

  function createSparks(scene) {
    const ps = new BABYLON.ParticleSystem('sparks', 30, scene);
    ps.particleTexture = null;
    ps.createPointEmitter(new V3(-0.5, 0, -0.5), new V3(0.5, 0.5, 0.5));
    ps.color1 = new Color4(1, 0.8, 0.2, 1);
    ps.color2 = new Color4(1, 0.5, 0, 1);
    ps.colorDead = new Color4(1, 0.2, 0, 0);
    ps.minSize = 0.03;
    ps.maxSize = 0.08;
    ps.minLifeTime = 0.1;
    ps.maxLifeTime = 0.3;
    ps.emitRate = 0;
    ps.gravity = new V3(0, -5, 0);
    ps.minEmitPower = 3;
    ps.maxEmitPower = 6;
    ps.updateSpeed = 0.01;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.start();
    return ps;
  }

  function burstSparks(sparksPS, position, count) {
    if (!sparksPS) return;
    sparksPS.emitter = position.clone();
    sparksPS.manualEmitCount = count || 20;
  }

  // Tire marks — ground-level dark trail during drifting
  var _tireMarkPool = [];
  var _tireMarkIdx = 0;
  var TIRE_MARK_MAX = 80;

  function createTireMarkPool(scene) {
    var mat = new BABYLON.StandardMaterial('tireMarkMat', scene);
    mat.diffuseColor = new BABYLON.Color3(0.08, 0.08, 0.1);
    mat.alpha = 0.6;
    mat.freeze();
    for (var i = 0; i < TIRE_MARK_MAX; i++) {
      var mark = BABYLON.MeshBuilder.CreateBox('tireMark_' + i, { width: 0.5, height: 0.01, depth: 1.2 }, scene);
      mark.material = mat;
      mark.isVisible = false;
      mark.position.y = -10;
      _tireMarkPool.push(mark);
    }
  }

  function placeTireMark(position, rotationY) {
    if (_tireMarkPool.length === 0) return;
    var mark = _tireMarkPool[_tireMarkIdx % TIRE_MARK_MAX];
    _tireMarkIdx++;
    mark.position.x = position.x;
    mark.position.y = 0.02;
    mark.position.z = position.z;
    mark.rotation.y = rotationY;
    mark.isVisible = true;
    // Freeze after positioning
    mark.freezeWorldMatrix();
  }

  // Exhaust smoke — small puffs from rear
  function createExhaustSmoke(scene) {
    var ps = new BABYLON.ParticleSystem('exhaust', 20, scene);
    ps.particleTexture = null;
    ps.createPointEmitter(new V3(-0.1, 0, -0.3), new V3(0.1, 0.1, -0.5));
    ps.color1 = new Color4(0.3, 0.3, 0.35, 0.3);
    ps.color2 = new Color4(0.25, 0.25, 0.3, 0.2);
    ps.colorDead = new Color4(0.2, 0.2, 0.2, 0);
    ps.minSize = 0.1;
    ps.maxSize = 0.25;
    ps.minLifeTime = 0.3;
    ps.maxLifeTime = 0.6;
    ps.emitRate = 0;
    ps.gravity = new V3(0, 0.3, 0);
    ps.minEmitPower = 0.3;
    ps.maxEmitPower = 0.8;
    ps.updateSpeed = 0.02;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    return ps;
  }

  // City ambient particles — floating light motes for atmosphere
  function createCityAmbient(scene, centerPos) {
    var ps = new BABYLON.ParticleSystem('cityDust', 40, scene);
    ps.particleTexture = null;
    ps.emitter = centerPos.add(new V3(0, 5, 0));
    ps.createBoxEmitter(new V3(-1, 0, -1), new V3(1, 0.5, 1), new V3(-30, 0, -30), new V3(30, 10, 30));
    ps.color1 = new Color4(0.3, 0.4, 0.8, 0.15);
    ps.color2 = new Color4(0.5, 0.6, 1.0, 0.1);
    ps.colorDead = new Color4(0, 0, 0, 0);
    ps.minSize = 0.05;
    ps.maxSize = 0.15;
    ps.minLifeTime = 3;
    ps.maxLifeTime = 6;
    ps.emitRate = 8;
    ps.gravity = new V3(0, 0.1, 0);
    ps.minEmitPower = 0.1;
    ps.maxEmitPower = 0.3;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_ADD;
    ps.start();
    return ps;
  }

  const Particles = {
    createDriftSmoke,
    createBoostFlame,
    createConfetti,
    createSparks,
    burstSparks,
    createTireMarkPool,
    placeTireMark,
    createExhaustSmoke,
    createCityAmbient,
  };

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.Particles = Particles;
})();

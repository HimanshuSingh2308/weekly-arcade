'use strict';
/**
 * Drift Legends -- Particle Effects
 * Drift smoke, boost flames, confetti, collision sparks.
 */
(function () {
  const V3 = BABYLON.Vector3;
  const Color4 = BABYLON.Color4;

  // Generate a simple white circle texture for particles (Babylon 9 needs a texture)
  var _defaultParticleTex = null;
  function getParticleTexture(scene) {
    if (_defaultParticleTex && !_defaultParticleTex.isDisposed) return _defaultParticleTex;
    var size = 32;
    var dt = new BABYLON.DynamicTexture('particleTex', size, scene, false);
    var ctx = dt.getContext();
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size / 2 - 1, 0, Math.PI * 2);
    ctx.fill();
    dt.update();
    _defaultParticleTex = dt;
    return dt;
  }

  function createDriftSmoke(scene) {
    const ps = new BABYLON.ParticleSystem('driftSmoke', 80, scene);
    ps.particleTexture = getParticleTexture(scene);
    ps.createPointEmitter(new V3(-0.3, 0, -0.3), new V3(0.3, 0.5, 0.3));
    ps.color1 = new Color4(0.7, 0.7, 0.7, 0.7);
    ps.color2 = new Color4(0.5, 0.5, 0.5, 0.5);
    ps.colorDead = new Color4(0.3, 0.3, 0.3, 0);
    ps.minSize = 0.4;
    ps.maxSize = 1.2;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 1.0;
    ps.emitRate = 0;
    ps.gravity = new V3(0, 0.8, 0);
    ps.minEmitPower = 0.5;
    ps.maxEmitPower = 1.5;
    ps.updateSpeed = 0.02;
    ps.blendMode = BABYLON.ParticleSystem.BLENDMODE_STANDARD;
    ps.start();
    return ps;
  }

  function createBoostFlame(scene) {
    const ps = new BABYLON.ParticleSystem('boostFlame', 80, scene);
    ps.particleTexture = getParticleTexture(scene);
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
    ps.particleTexture = getParticleTexture(scene);
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
    ps.particleTexture = getParticleTexture(scene);
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
    mat.diffuseColor = new BABYLON.Color3(0.15, 0.15, 0.18);
    mat.emissiveColor = new BABYLON.Color3(0.05, 0.05, 0.05);
    mat.alpha = 0.7;
    for (var i = 0; i < TIRE_MARK_MAX; i++) {
      var mark = BABYLON.MeshBuilder.CreateBox('tireMark_' + i, { width: 0.6, height: 0.02, depth: 1.5 }, scene);
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
    // Unfreeze before repositioning (may have been frozen)
    mark.unfreezeWorldMatrix();
    mark.position.x = position.x;
    mark.position.y = 0.03;
    mark.position.z = position.z;
    mark.rotation.y = rotationY;
    mark.isVisible = true;
  }

  // Exhaust smoke — visible puffs from rear
  function createExhaustSmoke(scene) {
    var ps = new BABYLON.ParticleSystem('exhaust', 30, scene);
    ps.particleTexture = getParticleTexture(scene);
    ps.createPointEmitter(new V3(-0.15, 0, -0.5), new V3(0.15, 0.2, -0.8));
    ps.color1 = new Color4(0.5, 0.5, 0.55, 0.5);
    ps.color2 = new Color4(0.4, 0.4, 0.45, 0.4);
    ps.colorDead = new Color4(0.3, 0.3, 0.3, 0);
    ps.minSize = 0.15;
    ps.maxSize = 0.4;
    ps.minLifeTime = 0.4;
    ps.maxLifeTime = 0.8;
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
    ps.particleTexture = getParticleTexture(scene);
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
    disposeTireMarks() {
      _tireMarkPool.forEach(function(m) { if (m && !m.isDisposed()) m.dispose(); });
      _tireMarkPool = [];
      _tireMarkIdx = 0;
    },
  };

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.Particles = Particles;
})();

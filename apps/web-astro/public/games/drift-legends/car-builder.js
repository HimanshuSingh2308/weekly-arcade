'use strict';
/**
 * Drift Legends -- Car Builder
 * Procedural car construction from Babylon.js primitives with PBR materials.
 * 3 car types: street-kart, drift-racer, sand-runner.
 */
(function () {
  const V3 = BABYLON.Vector3;
  const Color3 = BABYLON.Color3;
  const MB = BABYLON.MeshBuilder;

  const CAR_COLORS = {
    'street-kart': Color3.FromHexString('#1a5fb4'),
    'drift-racer': Color3.FromHexString('#cc0000'),
    'sand-runner': Color3.FromHexString('#c8a000'),
    'ai-gray': Color3.FromHexString('#555555'),
    'ai-teal': Color3.FromHexString('#2a8a8a'),
    'ai-purple': Color3.FromHexString('#6a3d9a'),
  };

  // Rival colors per chapter
  const RIVAL_COLORS = {
    'blaze': Color3.FromHexString('#ff4500'),
    'sandstorm': Color3.FromHexString('#c8a000'),
    'glacier': Color3.FromHexString('#4488cc'),
    'viper': Color3.FromHexString('#228b22'),
    'apex': Color3.FromHexString('#ffffff'),
  };

  function createPBR(scene, color, metallic, roughness) {
    const mat = new BABYLON.PBRMaterial('carMat_' + Math.random().toString(36).slice(2), scene);
    mat.albedoColor = color;
    mat.metallic = metallic !== undefined ? metallic : 0.6;
    mat.roughness = roughness !== undefined ? roughness : 0.35;
    mat.backFaceCulling = true;
    return mat;
  }

  // Shared materials (cached — one instance used by all cars)
  var _wheelMat = null, _chromeMat = null;

  function createWheelMat(scene) {
    if (_wheelMat) return _wheelMat;
    _wheelMat = new BABYLON.PBRMaterial('wheelMat', scene);
    _wheelMat.albedoColor = new Color3(0.1, 0.1, 0.1);
    _wheelMat.metallic = 0.2;
    _wheelMat.roughness = 0.9;
    _wheelMat.freeze();
    return _wheelMat;
  }

  function createChromeMat(scene) {
    if (_chromeMat) return _chromeMat;
    _chromeMat = new BABYLON.PBRMaterial('chromeMat', scene);
    _chromeMat.albedoColor = new Color3(0.8, 0.8, 0.85);
    _chromeMat.metallic = 0.95;
    _chromeMat.roughness = 0.1;
    _chromeMat.freeze();
    return _chromeMat;
  }

  function createGlassMat(scene) {
    const mat = new BABYLON.PBRMaterial('glassMat', scene);
    mat.albedoColor = new Color3(0.4, 0.6, 0.8);
    mat.alpha = 0.4;
    mat.metallic = 0.1;
    mat.roughness = 0.05;
    return mat;
  }

  function createEmissiveMat(scene, color) {
    const mat = new BABYLON.PBRMaterial('emMat', scene);
    mat.albedoColor = color;
    mat.emissiveColor = color;
    mat.metallic = 0;
    mat.roughness = 1;
    return mat;
  }

  function buildWheel(scene, wheelMat, chromeMat, radius, width) {
    const tire = MB.CreateCylinder('tire', { height: width, diameter: radius * 2, tessellation: 12 }, scene);
    tire.rotation.z = Math.PI / 2;
    tire.material = wheelMat;

    const rim = MB.CreateCylinder('rim', { height: width * 0.3, diameter: radius * 1.2, tessellation: 8 }, scene);
    rim.rotation.z = Math.PI / 2;
    rim.material = chromeMat;
    rim.parent = tire;

    return tire;
  }

  function buildStreetKart(scene, color) {
    const root = new BABYLON.TransformNode('car_streetKart', scene);
    const bodyMat = createPBR(scene, color || CAR_COLORS['street-kart']);
    const wheelMat = createWheelMat(scene);
    const chromeMat = createChromeMat(scene);
    const glassMat = createGlassMat(scene);

    // Main body
    const body = MB.CreateBox('body', { width: 1.6, height: 0.5, depth: 3.2 }, scene);
    body.position.y = 0.4;
    body.material = bodyMat;
    body.parent = root;

    // Hood (tapered front)
    const hood = MB.CreateBox('hood', { width: 1.4, height: 0.3, depth: 1.0 }, scene);
    hood.position = new V3(0, 0.55, 1.2);
    hood.material = bodyMat;
    hood.parent = root;

    // Cabin top
    const cabin = MB.CreateBox('cabin', { width: 1.3, height: 0.45, depth: 1.2 }, scene);
    cabin.position = new V3(0, 0.85, -0.2);
    cabin.material = createPBR(scene, color ? color.scale(1.2) : CAR_COLORS['street-kart'].scale(1.2));
    cabin.parent = root;

    // Windshield
    const windshield = MB.CreateBox('windshield', { width: 1.2, height: 0.4, depth: 0.05 }, scene);
    windshield.position = new V3(0, 0.85, 0.45);
    windshield.rotation.x = -0.3;
    windshield.material = glassMat;
    windshield.parent = root;

    // Rear windshield
    const rearWind = MB.CreateBox('rearWind', { width: 1.1, height: 0.35, depth: 0.05 }, scene);
    rearWind.position = new V3(0, 0.85, -0.85);
    rearWind.rotation.x = 0.3;
    rearWind.material = glassMat;
    rearWind.parent = root;

    // Spoiler
    const spoilerBase = MB.CreateBox('spoilerBase', { width: 0.1, height: 0.3, depth: 0.1 }, scene);
    spoilerBase.position = new V3(0, 0.75, -1.5);
    spoilerBase.material = bodyMat;
    spoilerBase.parent = root;
    const spoilerWing = MB.CreateBox('spoilerWing', { width: 1.5, height: 0.06, depth: 0.35 }, scene);
    spoilerWing.position = new V3(0, 0.95, -1.5);
    spoilerWing.material = bodyMat;
    spoilerWing.parent = root;

    // Headlights
    [-0.55, 0.55].forEach(x => {
      const hl = MB.CreateSphere('headlight', { diameter: 0.18, segments: 8 }, scene);
      hl.position = new V3(x, 0.45, 1.65);
      hl.material = createEmissiveMat(scene, new Color3(1, 1, 0.9));
      hl.parent = root;
    });

    // Tail lights (brake lights — stored for dynamic brightness)
    var brakeLights = [];
    [-0.55, 0.55].forEach(x => {
      const tl = MB.CreateSphere('taillight', { diameter: 0.15, segments: 8 }, scene);
      tl.position = new V3(x, 0.45, -1.65);
      tl.material = createEmissiveMat(scene, new Color3(0.4, 0, 0));
      tl.parent = root;
      brakeLights.push(tl);
    });

    // Exhaust pipes
    [-0.35, 0.35].forEach(x => {
      const exh = MB.CreateCylinder('exhaust', { height: 0.2, diameter: 0.1, tessellation: 8 }, scene);
      exh.rotation.x = Math.PI / 2;
      exh.position = new V3(x, 0.2, -1.7);
      exh.material = chromeMat;
      exh.parent = root;
    });

    // Undercarriage
    const under = MB.CreateBox('under', { width: 1.5, height: 0.08, depth: 3.0 }, scene);
    under.position.y = 0.12;
    const underMat = createPBR(scene, new Color3(0.15, 0.15, 0.15), 0.2, 0.8);
    under.material = underMat;
    under.parent = root;

    // Wheels
    const wheelPositions = [
      new V3(-0.85, 0.2, 1.0),   // FL
      new V3(0.85, 0.2, 1.0),    // FR
      new V3(-0.85, 0.2, -1.0),  // RL
      new V3(0.85, 0.2, -1.0),   // RR
    ];
    const wheels = [];
    wheelPositions.forEach((pos, i) => {
      const w = buildWheel(scene, wheelMat, chromeMat, 0.2, 0.15);
      w.position = pos;
      w.parent = root;
      wheels.push(w);
    });

    root._wheels = wheels;
    root._brakeLights = brakeLights;
    root._carType = 'street-kart';
    return root;
  }

  function buildDriftRacer(scene, color) {
    const root = new BABYLON.TransformNode('car_driftRacer', scene);
    const bodyColor = color || CAR_COLORS['drift-racer'];
    const bodyMat = createPBR(scene, bodyColor);
    const wheelMat = createWheelMat(scene);
    const chromeMat = createChromeMat(scene);
    const glassMat = createGlassMat(scene);

    // Body -- lower and wider than street kart
    const body = MB.CreateBox('body', { width: 1.8, height: 0.4, depth: 3.4 }, scene);
    body.position.y = 0.35;
    body.material = bodyMat;
    body.parent = root;

    // Hood
    const hood = MB.CreateBox('hood', { width: 1.6, height: 0.25, depth: 1.1 }, scene);
    hood.position = new V3(0, 0.48, 1.3);
    hood.material = bodyMat;
    hood.parent = root;

    // Cabin (lower)
    const cabin = MB.CreateBox('cabin', { width: 1.5, height: 0.35, depth: 1.1 }, scene);
    cabin.position = new V3(0, 0.7, -0.2);
    cabin.material = createPBR(scene, bodyColor.scale(1.15));
    cabin.parent = root;

    // Windshield
    const ws = MB.CreateBox('ws', { width: 1.4, height: 0.32, depth: 0.05 }, scene);
    ws.position = new V3(0, 0.72, 0.4);
    ws.rotation.x = -0.25;
    ws.material = glassMat;
    ws.parent = root;

    // Large rear spoiler
    const sp1 = MB.CreateBox('sp1', { width: 0.08, height: 0.35, depth: 0.08 }, scene);
    sp1.position = new V3(-0.5, 0.7, -1.65);
    sp1.material = bodyMat;
    sp1.parent = root;
    const sp2 = sp1.clone('sp2');
    sp2.position.x = 0.5;
    sp2.parent = root;
    const wing = MB.CreateBox('wing', { width: 1.8, height: 0.05, depth: 0.45 }, scene);
    wing.position = new V3(0, 0.9, -1.65);
    wing.material = bodyMat;
    wing.parent = root;

    // Side skirts
    [-0.95, 0.95].forEach(x => {
      const sk = MB.CreateBox('skirt', { width: 0.08, height: 0.12, depth: 2.8 }, scene);
      sk.position = new V3(x, 0.2, 0);
      sk.material = createPBR(scene, new Color3(0.12, 0.12, 0.12), 0.3, 0.7);
      sk.parent = root;
    });

    // Rear diffuser
    const diff = MB.CreateBox('diff', { width: 1.4, height: 0.08, depth: 0.3 }, scene);
    diff.position = new V3(0, 0.15, -1.75);
    diff.rotation.x = 0.15;
    diff.material = createPBR(scene, new Color3(0.1, 0.1, 0.1));
    diff.parent = root;

    // Headlights + taillights
    [-0.6, 0.6].forEach(x => {
      const hl = MB.CreateSphere('hl', { diameter: 0.18, segments: 8 }, scene);
      hl.position = new V3(x, 0.4, 1.75);
      hl.material = createEmissiveMat(scene, new Color3(1, 1, 0.9));
      hl.parent = root;
      const tl = MB.CreateSphere('tl', { diameter: 0.15, segments: 8 }, scene);
      tl.position = new V3(x, 0.4, -1.75);
      tl.material = createEmissiveMat(scene, new Color3(1, 0, 0));
      tl.parent = root;
    });

    // Exhaust
    [-0.3, 0.3].forEach(x => {
      const exh = MB.CreateCylinder('exh', { height: 0.2, diameter: 0.12, tessellation: 8 }, scene);
      exh.rotation.x = Math.PI / 2;
      exh.position = new V3(x, 0.18, -1.8);
      exh.material = chromeMat;
      exh.parent = root;
    });

    // Wheels -- wider stance
    const wheelPositions = [
      new V3(-1.0, 0.18, 1.1),
      new V3(1.0, 0.18, 1.1),
      new V3(-1.0, 0.18, -1.1),
      new V3(1.0, 0.18, -1.1),
    ];
    const wheels = [];
    wheelPositions.forEach(pos => {
      const w = buildWheel(scene, wheelMat, chromeMat, 0.18, 0.18);
      w.position = pos;
      w.parent = root;
      wheels.push(w);
    });

    root._wheels = wheels;
    root._carType = 'drift-racer';
    return root;
  }

  function buildSandRunner(scene, color) {
    const root = new BABYLON.TransformNode('car_sandRunner', scene);
    const bodyColor = color || CAR_COLORS['sand-runner'];
    const bodyMat = createPBR(scene, bodyColor);
    const wheelMat = createWheelMat(scene);
    const chromeMat = createChromeMat(scene);
    const glassMat = createGlassMat(scene);

    // Body -- wider, higher ride height
    const body = MB.CreateBox('body', { width: 1.9, height: 0.55, depth: 3.3 }, scene);
    body.position.y = 0.55;
    body.material = bodyMat;
    body.parent = root;

    // Hood
    const hood = MB.CreateBox('hood', { width: 1.7, height: 0.3, depth: 1.0 }, scene);
    hood.position = new V3(0, 0.7, 1.25);
    hood.material = bodyMat;
    hood.parent = root;

    // Bull bar
    [-0.5, 0.5].forEach(x => {
      const bar = MB.CreateBox('bar', { width: 0.06, height: 0.06, depth: 0.4 }, scene);
      bar.position = new V3(x, 0.5, 1.8);
      bar.material = chromeMat;
      bar.parent = root;
    });
    const barTop = MB.CreateBox('barTop', { width: 1.1, height: 0.06, depth: 0.06 }, scene);
    barTop.position = new V3(0, 0.55, 1.85);
    barTop.material = chromeMat;
    barTop.parent = root;

    // Cabin
    const cabin = MB.CreateBox('cabin', { width: 1.6, height: 0.5, depth: 1.2 }, scene);
    cabin.position = new V3(0, 1.0, -0.2);
    cabin.material = createPBR(scene, bodyColor.scale(1.1));
    cabin.parent = root;

    // Roof rack (instead of spoiler)
    const rack = MB.CreateBox('rack', { width: 1.3, height: 0.04, depth: 1.0 }, scene);
    rack.position = new V3(0, 1.3, -0.2);
    rack.material = chromeMat;
    rack.parent = root;

    // Windshield
    const ws = MB.CreateBox('ws', { width: 1.4, height: 0.45, depth: 0.05 }, scene);
    ws.position = new V3(0, 1.0, 0.5);
    ws.rotation.x = -0.3;
    ws.material = glassMat;
    ws.parent = root;

    // Headlights + taillights
    [-0.65, 0.65].forEach(x => {
      const hl = MB.CreateSphere('hl', { diameter: 0.2, segments: 8 }, scene);
      hl.position = new V3(x, 0.6, 1.7);
      hl.material = createEmissiveMat(scene, new Color3(1, 1, 0.9));
      hl.parent = root;
      const tl = MB.CreateSphere('tl', { diameter: 0.16, segments: 8 }, scene);
      tl.position = new V3(x, 0.6, -1.7);
      tl.material = createEmissiveMat(scene, new Color3(1, 0, 0));
      tl.parent = root;
    });

    // Exhaust
    const exh = MB.CreateCylinder('exh', { height: 0.25, diameter: 0.14, tessellation: 8 }, scene);
    exh.rotation.x = Math.PI / 2;
    exh.position = new V3(0.5, 0.35, -1.75);
    exh.material = chromeMat;
    exh.parent = root;

    // Wheels -- chunky off-road
    const wheelPositions = [
      new V3(-1.0, 0.28, 1.1),
      new V3(1.0, 0.28, 1.1),
      new V3(-1.0, 0.28, -1.1),
      new V3(1.0, 0.28, -1.1),
    ];
    const wheels = [];
    wheelPositions.forEach(pos => {
      const w = buildWheel(scene, wheelMat, chromeMat, 0.28, 0.2);
      w.position = pos;
      w.parent = root;
      wheels.push(w);
    });

    root._wheels = wheels;
    root._carType = 'sand-runner';
    return root;
  }

  function buildCar(scene, carId, colorOverride) {
    const color = colorOverride ? (typeof colorOverride === 'string' ? Color3.FromHexString(colorOverride) : colorOverride) : null;
    switch (carId) {
      case 'drift-racer': return buildDriftRacer(scene, color);
      case 'sand-runner': return buildSandRunner(scene, color);
      default: return buildStreetKart(scene, color);
    }
  }

  function buildRivalCar(scene, rivalName, carId) {
    const color = RIVAL_COLORS[rivalName] || CAR_COLORS['ai-gray'];
    return buildCar(scene, carId || 'street-kart', color);
  }

  function buildAICar(scene, index) {
    const colors = [CAR_COLORS['ai-gray'], CAR_COLORS['ai-teal'], CAR_COLORS['ai-purple']];
    return buildCar(scene, 'street-kart', colors[index % colors.length]);
  }

  /** Animate wheels spinning based on speed */
  function updateWheels(carRoot, speed, dt) {
    if (!carRoot._wheels) return;
    const spinRate = speed * 3;
    carRoot._wheels.forEach(w => {
      // Wheels are cylinders rotated on Z, so spin around local X
      w.rotation.x += spinRate * dt;
    });
  }

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.CarBuilder = {
    buildCar,
    buildRivalCar,
    buildAICar,
    updateWheels,
    CAR_COLORS,
    RIVAL_COLORS,
  };
})();

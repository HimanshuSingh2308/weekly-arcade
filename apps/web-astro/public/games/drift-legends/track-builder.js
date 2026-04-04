'use strict';
/**
 * Drift Legends -- Track Builder
 * Procedural track generation using spline paths with environment theming.
 * 5 environments x 3 races = 15 tracks total.
 */
(function () {
  const V3 = BABYLON.Vector3;
  const Color3 = BABYLON.Color3;
  const MB = BABYLON.MeshBuilder;

  // ─── Track Definitions ──────────────────────────────────────────
  // Each track: id, name, chapter, race, controlPoints (spline), trackWidth, environment
  const TRACKS = {
    // ═══════════════════════════════════════════════════════════════
    // Chapter 1: City — wide roads, gentle curves, beginner-friendly
    // ═══════════════════════════════════════════════════════════════
    'city-circuit': {
      id: 'city-circuit', name: 'City Circuit', chapter: 1, race: 1, laps: 3,
      minimumLapTimeMs: 45000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 15,
      // Simple oval — wide and forgiving
      controlPoints: [
        { x: 0, z: 0 }, { x: 40, z: 5 }, { x: 70, z: 30 }, { x: 65, z: 65 },
        { x: 35, z: 80 }, { x: 5, z: 70 }, { x: -10, z: 40 },
      ],
      nitroZones: [0.35, 0.7],
      checkpoints: [0.1, 0.25, 0.5, 0.75, 0.9],
      environment: 'city',
    },
    'neon-alley': {
      id: 'neon-alley', name: 'Neon Alley', chapter: 1, race: 2, laps: 3,
      minimumLapTimeMs: 50000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 13,
      // Figure-8 crossover — teaches awareness
      controlPoints: [
        { x: 0, z: 0 }, { x: 40, z: 20 }, { x: 10, z: 50 }, { x: 50, z: 70 },
        { x: 80, z: 50 }, { x: 50, z: 30 }, { x: 70, z: 0 }, { x: 30, z: -10 },
      ],
      nitroZones: [0.2, 0.5, 0.8],
      checkpoints: [0.1, 0.25, 0.5, 0.75, 0.9],
      environment: 'city',
    },
    'blaze-showdown': {
      id: 'blaze-showdown', name: 'Blaze Showdown', chapter: 1, race: 3, laps: 3,
      minimumLapTimeMs: 50000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 12,
      // Long straight + tight hairpin — tests braking
      controlPoints: [
        { x: 0, z: 0 }, { x: 60, z: 5 }, { x: 90, z: 10 }, { x: 95, z: 35 },
        { x: 80, z: 45 }, { x: 30, z: 50 }, { x: 10, z: 65 }, { x: 5, z: 85 },
        { x: -15, z: 70 }, { x: -20, z: 35 },
      ],
      nitroZones: [0.15, 0.6],
      checkpoints: [0.1, 0.25, 0.4, 0.6, 0.8, 0.9],
      environment: 'city',
    },
    // ═══════════════════════════════════════════════════════════════
    // Chapter 2: Desert — wider tracks, sweeping curves, high speed
    // ═══════════════════════════════════════════════════════════════
    'mesa-loop': {
      id: 'mesa-loop', name: 'Mesa Loop', chapter: 2, race: 1, laps: 3,
      minimumLapTimeMs: 50000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 14,
      // Big sweeping loop — fast, wide turns
      controlPoints: [
        { x: 0, z: 0 }, { x: 50, z: 0 }, { x: 90, z: 20 }, { x: 100, z: 60 },
        { x: 80, z: 90 }, { x: 40, z: 95 }, { x: 0, z: 80 }, { x: -15, z: 45 },
      ],
      nitroZones: [0.15, 0.55],
      checkpoints: [0.1, 0.3, 0.5, 0.7, 0.9],
      environment: 'desert',
    },
    'canyon-rush': {
      id: 'canyon-rush', name: 'Canyon Rush', chapter: 2, race: 2, laps: 3,
      minimumLapTimeMs: 53000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 11,
      // Zigzag canyon — tight alternating turns
      controlPoints: [
        { x: 0, z: 0 }, { x: 30, z: 25 }, { x: 10, z: 45 }, { x: 40, z: 65 },
        { x: 15, z: 85 }, { x: 45, z: 100 }, { x: 70, z: 80 }, { x: 55, z: 55 },
        { x: 75, z: 30 }, { x: 50, z: 10 },
      ],
      nitroZones: [0.3, 0.65],
      checkpoints: [0.1, 0.25, 0.5, 0.75, 0.9],
      environment: 'desert',
    },
    'sandstorm-duel': {
      id: 'sandstorm-duel', name: 'Sandstorm Duel', chapter: 2, race: 3, laps: 3,
      minimumLapTimeMs: 53000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 12,
      // Diamond shape — 4 long straights, 4 sharp corners
      controlPoints: [
        { x: 0, z: 0 }, { x: 50, z: -10 }, { x: 90, z: 40 }, { x: 50, z: 90 },
        { x: 0, z: 80 }, { x: -30, z: 40 },
      ],
      nitroZones: [0.1, 0.4, 0.7],
      checkpoints: [0.1, 0.25, 0.5, 0.75, 0.9],
      environment: 'desert',
    },
    // ═══════════════════════════════════════════════════════════════
    // Chapter 3: Ice — narrow, technical, slippery feel
    // ═══════════════════════════════════════════════════════════════
    'frozen-peaks': {
      id: 'frozen-peaks', name: 'Frozen Peaks', chapter: 3, race: 1, laps: 3,
      minimumLapTimeMs: 55000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 13,
      // Winding mountain road — gentle S-curves
      controlPoints: [
        { x: 0, z: 0 }, { x: 25, z: 30 }, { x: 50, z: 15 }, { x: 75, z: 40 },
        { x: 60, z: 70 }, { x: 30, z: 60 }, { x: 10, z: 80 }, { x: -10, z: 50 },
      ],
      nitroZones: [0.4],
      checkpoints: [0.1, 0.3, 0.5, 0.7, 0.9],
      environment: 'ice',
    },
    'glacier-gorge': {
      id: 'glacier-gorge', name: 'Glacier Gorge', chapter: 3, race: 2, laps: 3,
      minimumLapTimeMs: 60000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 10,
      // Narrow chicane sequence — precision required
      controlPoints: [
        { x: 0, z: 0 }, { x: 15, z: 20 }, { x: 35, z: 10 }, { x: 45, z: 30 },
        { x: 30, z: 45 }, { x: 50, z: 60 }, { x: 35, z: 80 }, { x: 15, z: 65 },
        { x: -5, z: 45 }, { x: 10, z: 25 },
      ],
      nitroZones: [0.35, 0.7],
      checkpoints: [0.1, 0.25, 0.5, 0.75, 0.9],
      environment: 'ice',
    },
    'ice-crown': {
      id: 'ice-crown', name: 'Ice Crown', chapter: 3, race: 3, laps: 3,
      minimumLapTimeMs: 60000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 10,
      // Spiral inward then back out — disorienting
      controlPoints: [
        { x: 0, z: 0 }, { x: 40, z: 0 }, { x: 60, z: 30 }, { x: 40, z: 55 },
        { x: 15, z: 45 }, { x: 25, z: 25 }, { x: 10, z: 10 },
        { x: -15, z: 30 }, { x: -10, z: 60 }, { x: 20, z: 75 },
        { x: 50, z: 70 }, { x: 55, z: 50 }, { x: 30, z: -10 },
      ],
      nitroZones: [0.2, 0.5, 0.8],
      checkpoints: [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9],
      environment: 'ice',
    },
    // ═══════════════════════════════════════════════════════════════
    // Chapter 4: Jungle — twisty, organic, tight
    // ═══════════════════════════════════════════════════════════════
    'jungle-run': {
      id: 'jungle-run', name: 'Jungle Run', chapter: 4, race: 1, laps: 3,
      minimumLapTimeMs: 53000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 12,
      // Organic winding path — no straight sections
      controlPoints: [
        { x: 0, z: 0 }, { x: 20, z: 20 }, { x: 40, z: 5 }, { x: 55, z: 25 },
        { x: 45, z: 50 }, { x: 60, z: 70 }, { x: 35, z: 85 },
        { x: 10, z: 70 }, { x: -5, z: 45 }, { x: 15, z: 25 },
      ],
      nitroZones: [0.4, 0.75],
      checkpoints: [0.1, 0.3, 0.5, 0.7, 0.9],
      environment: 'jungle',
    },
    'ruin-dash': {
      id: 'ruin-dash', name: 'Ruin Dash', chapter: 4, race: 2, laps: 3,
      minimumLapTimeMs: 60000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 11,
      // Hairpin switchbacks — mountain descent feel
      controlPoints: [
        { x: 0, z: 0 }, { x: 35, z: 10 }, { x: 15, z: 30 }, { x: 45, z: 40 },
        { x: 20, z: 60 }, { x: 50, z: 70 }, { x: 30, z: 90 },
        { x: 5, z: 80 }, { x: -15, z: 55 }, { x: -5, z: 25 },
      ],
      nitroZones: [0.3, 0.65],
      checkpoints: [0.1, 0.25, 0.5, 0.75, 0.9],
      environment: 'jungle',
    },
    'vipers-lair': {
      id: 'vipers-lair', name: "Viper's Lair", chapter: 4, race: 3, laps: 3,
      minimumLapTimeMs: 63000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 9,
      // Very tight, narrow, snake-like — hardest jungle track
      controlPoints: [
        { x: 0, z: 0 }, { x: 10, z: 15 }, { x: 25, z: 5 }, { x: 35, z: 20 },
        { x: 25, z: 35 }, { x: 40, z: 50 }, { x: 30, z: 65 },
        { x: 15, z: 55 }, { x: 5, z: 70 }, { x: -10, z: 55 },
        { x: -5, z: 35 }, { x: -15, z: 20 },
      ],
      nitroZones: [0.2, 0.5, 0.8],
      checkpoints: [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9],
      environment: 'jungle',
    },
    // ═══════════════════════════════════════════════════════════════
    // Chapter 5: Sky — fast, dramatic, wide open then tight
    // ═══════════════════════════════════════════════════════════════
    'cloud-circuit': {
      id: 'cloud-circuit', name: 'Cloud Circuit', chapter: 5, race: 1, laps: 3,
      minimumLapTimeMs: 53000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 14,
      // Fast flowing — long curves connected by straights
      controlPoints: [
        { x: 0, z: 0 }, { x: 50, z: -5 }, { x: 85, z: 15 }, { x: 95, z: 50 },
        { x: 70, z: 75 }, { x: 30, z: 85 }, { x: -5, z: 65 },
        { x: -15, z: 30 },
      ],
      nitroZones: [0.15, 0.55],
      checkpoints: [0.1, 0.3, 0.5, 0.7, 0.9],
      environment: 'sky',
    },
    'grand-prix-qualify': {
      id: 'grand-prix-qualify', name: 'Grand Prix Qualify', chapter: 5, race: 2, laps: 3,
      minimumLapTimeMs: 50000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 12,
      // Technical F1-style — chicanes + long straight + hairpin
      controlPoints: [
        { x: 0, z: 0 }, { x: 60, z: 0 }, { x: 80, z: 15 }, { x: 70, z: 30 },
        { x: 85, z: 45 }, { x: 75, z: 65 }, { x: 50, z: 55 },
        { x: 30, z: 70 }, { x: 10, z: 60 }, { x: -10, z: 35 },
      ],
      nitroZones: [0.1, 0.5],
      checkpoints: [0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95],
      environment: 'sky',
    },
    'apex-final': {
      id: 'apex-final', name: 'Apex Final', chapter: 5, race: 3, laps: 3,
      minimumLapTimeMs: 55000,
      starThresholds: { one: 30, two: 100, three: 180 },
      trackWidth: 11,
      // The ultimate test — everything combined: straights, hairpins, chicanes, sweepers
      controlPoints: [
        { x: 0, z: 0 }, { x: 50, z: -5 }, { x: 80, z: 10 }, { x: 85, z: 35 },
        { x: 65, z: 40 }, { x: 75, z: 60 }, { x: 55, z: 80 },
        { x: 25, z: 90 }, { x: 5, z: 75 }, { x: 15, z: 55 },
        { x: -5, z: 40 }, { x: 10, z: 20 }, { x: -10, z: 10 },
      ],
      nitroZones: [0.1, 0.35, 0.65, 0.85],
      checkpoints: [0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 0.9],
      environment: 'sky',
    },
  };

  // ─── Environment Presets ──────────────────────────────────────────
  const ENVIRONMENTS = {
    city: {
      skyColor: Color3.FromHexString('#0f1028'),
      groundColor: Color3.FromHexString('#0a0a18'),
      roadColor: Color3.FromHexString('#2a2a3a'),
      wallColor: Color3.FromHexString('#ff4d00'),
      ambientColor: Color3.FromHexString('#1a1a44'),
      lightDir: new V3(-0.5, -1, 0.5),
      lightIntensity: 0.9,
      fog: { color: new Color3(0.05, 0.04, 0.15), density: 0.003 },
    },
    desert: {
      skyColor: Color3.FromHexString('#87ceeb'),
      groundColor: Color3.FromHexString('#c8a060'),
      roadColor: Color3.FromHexString('#8b7355'),
      wallColor: Color3.FromHexString('#a07040'),
      ambientColor: Color3.FromHexString('#e8b86d'),
      lightDir: new V3(-0.3, -1, 0.3),
      lightIntensity: 1.2,
      fog: { color: new Color3(0.78, 0.72, 0.43), density: 0.003 },
    },
    ice: {
      skyColor: Color3.FromHexString('#c8e6ff'),
      groundColor: Color3.FromHexString('#e8f0f8'),
      roadColor: Color3.FromHexString('#b0c8e0'),
      wallColor: Color3.FromHexString('#88aacc'),
      ambientColor: Color3.FromHexString('#b0e0ff'),
      lightDir: new V3(-0.4, -1, 0.4),
      lightIntensity: 1.0,
      fog: { color: new Color3(0.78, 0.9, 1.0), density: 0.004 },
    },
    jungle: {
      skyColor: Color3.FromHexString('#4a9eff'),
      groundColor: Color3.FromHexString('#1a3a1a'),
      roadColor: Color3.FromHexString('#4a3a2a'),
      wallColor: Color3.FromHexString('#2d5a1b'),
      ambientColor: Color3.FromHexString('#2d5a1b'),
      lightDir: new V3(-0.6, -1, 0.3),
      lightIntensity: 0.8,
      fog: { color: new Color3(0.12, 0.25, 0.1), density: 0.006 },
    },
    sky: {
      skyColor: Color3.FromHexString('#ff7043'),
      groundColor: Color3.FromHexString('#ffffff'),
      roadColor: Color3.FromHexString('#ddddee'),
      wallColor: Color3.FromHexString('#aaaacc'),
      ambientColor: Color3.FromHexString('#ffd700'),
      lightDir: new V3(-0.3, -1, 0.2),
      lightIntensity: 1.3,
      fog: null,
    },
  };

  // ─── Spline Helpers ───────────────────────────────────────────────
  function createClosedSpline(controlPoints) {
    const pts = controlPoints.map(p => new V3(p.x, 0, p.z));
    // Close the loop
    pts.push(pts[0].clone());
    return BABYLON.Curve3.CreateCatmullRomSpline(pts, 20, true);
  }

  function getSplinePoint(splinePoints, t) {
    const count = splinePoints.length;
    const idx = t * (count - 1);
    const i = Math.floor(idx);
    const frac = idx - i;
    const p0 = splinePoints[Math.min(i, count - 1)];
    const p1 = splinePoints[Math.min(i + 1, count - 1)];
    return V3.Lerp(p0, p1, frac);
  }

  function getSplineTangent(splinePoints, t) {
    const epsilon = 0.001;
    const p0 = getSplinePoint(splinePoints, Math.max(0, t - epsilon));
    const p1 = getSplinePoint(splinePoints, Math.min(1, t + epsilon));
    return p1.subtract(p0).normalize();
  }

  // ─── Track Building ───────────────────────────────────────────────
  function buildTrack(scene, trackId) {
    const trackDef = TRACKS[trackId];
    if (!trackDef) {
      console.error('Unknown track:', trackId);
      return null;
    }

    const env = ENVIRONMENTS[trackDef.environment];
    const result = {
      trackDef,
      splinePoints: null,
      checkpointPositions: [],
      nitroPositions: [],
      startPosition: null,
      startRotation: 0,
      meshes: [],
    };

    // Setup scene environment
    scene.clearColor = new BABYLON.Color4(env.skyColor.r, env.skyColor.g, env.skyColor.b, 1);

    // Fog
    if (env.fog) {
      scene.fogMode = BABYLON.Scene.FOGMODE_EXP;
      scene.fogColor = env.fog.color;
      scene.fogDensity = env.fog.density;
    } else {
      scene.fogMode = BABYLON.Scene.FOGMODE_NONE;
    }

    // Lighting
    const existing = scene.lights.slice();
    existing.forEach(l => l.dispose());

    const hemi = new BABYLON.HemisphericLight('hemi', new V3(0, 1, 0), scene);
    hemi.diffuse = env.ambientColor;
    hemi.groundColor = env.groundColor.scale(0.3);
    hemi.intensity = 0.6;

    const dir = new BABYLON.DirectionalLight('dir', env.lightDir, scene);
    dir.diffuse = new Color3(1, 0.95, 0.9);
    dir.intensity = env.lightIntensity;

    // Build spline
    const curve = createClosedSpline(trackDef.controlPoints);
    result.splinePoints = curve.getPoints();

    // Build road mesh (ribbon along spline)
    const roadPaths = [[], []];
    const numSegments = result.splinePoints.length;
    const halfWidth = trackDef.trackWidth / 2;

    for (let i = 0; i < numSegments; i++) {
      const t = i / (numSegments - 1);
      const pos = result.splinePoints[i];
      const tangent = getSplineTangent(result.splinePoints, t);
      const right = V3.Cross(tangent, V3.Up()).normalize();

      roadPaths[0].push(pos.add(right.scale(-halfWidth)));
      roadPaths[1].push(pos.add(right.scale(halfWidth)));
    }

    const road = MB.CreateRibbon('road', { pathArray: roadPaths, sideOrientation: BABYLON.Mesh.DOUBLESIDE }, scene);
    const roadMat = new BABYLON.PBRMaterial('roadMat', scene);
    roadMat.albedoColor = env.roadColor;
    roadMat.metallic = 0.1;
    roadMat.roughness = 0.85;
    road.material = roadMat;
    road.position.y = 0.01;
    result.meshes.push(road);

    // Road markings — dashed yellow center line (inspired by #DRIVE)
    var centerLineMat = getCachedMat(scene, 'road_centerline', function() {
      var m = new BABYLON.StandardMaterial('centerLineMat', scene);
      m.emissiveColor = new Color3(1, 0.6, 0);
      m.diffuseColor = new Color3(1, 0.6, 0);
      m.freeze();
      return m;
    });
    var dashCount = Math.floor(numSegments / 3);
    for (var di = 0; di < dashCount; di++) {
      if (di % 2 === 0) continue; // dashed pattern
      var dt = di / dashCount;
      var dPos = getSplinePoint(result.splinePoints, dt);
      var dTan = getSplineTangent(result.splinePoints, dt);
      var dAngle = Math.atan2(dTan.x, dTan.z);
      var dash = MB.CreateBox('cLine', { width: 0.25, height: 0.02, depth: 1.5 }, scene);
      dash.position = dPos.add(new V3(0, 0.03, 0));
      dash.rotation.y = dAngle;
      dash.material = centerLineMat;
      dash.freezeWorldMatrix();
      result.meshes.push(dash);
    }

    // Edge lines — solid white strips along road edges
    var edgeLineMat = getCachedMat(scene, 'road_edgeline', function() {
      var m = new BABYLON.StandardMaterial('edgeLineMat', scene);
      m.emissiveColor = new Color3(0.8, 0.8, 0.85);
      m.diffuseColor = new Color3(0.8, 0.8, 0.85);
      m.freeze();
      return m;
    });
    for (var ei = 0; ei < numSegments; ei += 4) {
      var et = ei / (numSegments - 1);
      var eTan = getSplineTangent(result.splinePoints, et);
      var eAngle = Math.atan2(eTan.x, eTan.z);
      for (var side = 0; side < 2; side++) {
        var ePos = roadPaths[side][ei];
        if (!ePos) continue;
        var eLine = MB.CreateBox('eLine', { width: 0.2, height: 0.02, depth: 2.0 }, scene);
        eLine.position = ePos.add(new V3(0, 0.03, 0));
        eLine.rotation.y = eAngle;
        eLine.material = edgeLineMat;
        eLine.freezeWorldMatrix();
        result.meshes.push(eLine);
      }
    }

    // Low curbs instead of tall walls — car can go off-road
    var curbHeight = 0.15;
    var curbMat = getCachedMat(scene, 'curb_' + trackDef.environment, function() {
      var m = new BABYLON.StandardMaterial('curbMat', scene);
      m.emissiveColor = env.wallColor;
      m.diffuseColor = env.wallColor.scale(0.6);
      m.freeze();
      return m;
    });
    [0, 1].forEach(function(side) {
      var wallPath = roadPaths[side];
      var curbTop = wallPath.map(function(p) { return p.add(new V3(0, curbHeight, 0)); });
      var curb = MB.CreateRibbon('curb_' + side, {
        pathArray: [wallPath, curbTop],
        sideOrientation: BABYLON.Mesh.DOUBLESIDE,
      }, scene);
      curb.material = curbMat;
      curb.freezeWorldMatrix();
      result.meshes.push(curb);
    });

    // Ground plane — larger for open environments
    const ground = MB.CreateGround('ground', { width: 400, height: 400 }, scene);
    const groundMat = new BABYLON.PBRMaterial('groundMat', scene);
    groundMat.albedoColor = env.groundColor;
    groundMat.metallic = 0.05;
    groundMat.roughness = 0.95;
    ground.material = groundMat;
    ground.position.y = -0.05;
    result.meshes.push(ground);

    // Calculate checkpoint positions + add vertical arch visuals
    var cpMat = getCachedMat(scene, 'checkpoint_ring', function() {
      var m = new BABYLON.StandardMaterial('cpMat', scene);
      m.emissiveColor = new Color3(0, 0.8, 1);
      m.diffuseColor = new Color3(0, 0.8, 1);
      m.alpha = 0.35;
      m.freeze();
      return m;
    });
    result._cpMeshes = [];
    trackDef.checkpoints.forEach(t => {
      const pos = getSplinePoint(result.splinePoints, t);
      const tangent = getSplineTangent(result.splinePoints, t);
      result.checkpointPositions.push({ t, position: pos });

      // Vertical arch across the road — torus rotated 90° on X axis
      var arch = MB.CreateTorus('cp', { diameter: trackDef.trackWidth * 0.9, thickness: 0.25, tessellation: 20 }, scene);
      arch.position = pos.add(new V3(0, trackDef.trackWidth * 0.45, 0)); // center of arch at road width/2 height
      // Rotate to face along the road direction
      var roadAngle = Math.atan2(tangent.x, tangent.z);
      arch.rotation.y = roadAngle;
      arch.rotation.x = Math.PI / 2; // stand upright
      arch.material = cpMat;
      arch.freezeWorldMatrix();
      result.meshes.push(arch);
      result._cpMeshes.push(arch);
    });

    // Nitro zones
    trackDef.nitroZones.forEach(t => {
      const pos = getSplinePoint(result.splinePoints, t);
      const tangent = getSplineTangent(result.splinePoints, t);
      // Visual: yellow arrow on track
      const nitroPad = MB.CreateBox('nitro', { width: trackDef.trackWidth * 0.6, height: 0.05, depth: 3 }, scene);
      nitroPad.position = pos.add(new V3(0, 0.05, 0));
      const nitroMat = new BABYLON.PBRMaterial('nitroMat', scene);
      nitroMat.albedoColor = new Color3(1, 0.85, 0);
      nitroMat.emissiveColor = new Color3(0.6, 0.5, 0);
      nitroMat.metallic = 0;
      nitroMat.roughness = 0.8;
      nitroPad.material = nitroMat;
      // Align with road direction
      const angle = Math.atan2(tangent.x, tangent.z);
      nitroPad.rotation.y = angle;
      result.meshes.push(nitroPad);
      result.nitroPositions.push({ t, position: pos, mesh: nitroPad });
    });

    // Sky dome — procedural gradient (no texture needed)
    var skyDome = MB.CreateSphere('sky', { diameter: 350, segments: 8, sideOrientation: BABYLON.Mesh.BACKSIDE }, scene);
    var skyMat = new BABYLON.StandardMaterial('skyMat', scene);
    skyMat.diffuseColor = env.skyColor;
    skyMat.emissiveColor = env.skyColor.scale(trackDef.environment === 'city' ? 0.8 : 0.4);
    skyMat.disableLighting = true;
    skyMat.backFaceCulling = false;
    skyMat.freeze();
    skyDome.material = skyMat;
    skyDome.position.y = -20;
    skyDome.isPickable = false;
    skyDome.freezeWorldMatrix();
    result.meshes.push(skyDome);

    // Environment dressing
    buildEnvironmentProps(scene, trackDef, result.splinePoints, roadPaths, env);

    // Start position and rotation
    result.startPosition = result.splinePoints[0].clone();
    result.startPosition.y = 0;
    const startTangent = getSplineTangent(result.splinePoints, 0);
    result.startRotation = Math.atan2(startTangent.x, startTangent.z);

    // Chequered start/finish line — thick, alternating black/white
    var chequeredWhite = getCachedMat(scene, 'cheq_white', function() {
      var m = new BABYLON.StandardMaterial('cheqW', scene);
      m.diffuseColor = new Color3(1, 1, 1);
      m.emissiveColor = new Color3(0.3, 0.3, 0.3);
      m.freeze();
      return m;
    });
    var chequeredBlack = getCachedMat(scene, 'cheq_black', function() {
      var m = new BABYLON.StandardMaterial('cheqB', scene);
      m.diffuseColor = new Color3(0.1, 0.1, 0.1);
      m.freeze();
      return m;
    });
    var startRight = V3.Cross(startTangent, V3.Up()).normalize();
    var cheqSize = 1.0;
    var cheqCols = Math.floor(trackDef.trackWidth / cheqSize);
    for (var cr = 0; cr < 3; cr++) { // 3 rows deep
      for (var cc = 0; cc < cheqCols; cc++) {
        var isWhite = (cr + cc) % 2 === 0;
        var cheq = MB.CreateBox('cheq', { width: cheqSize, height: 0.03, depth: cheqSize }, scene);
        // Position using vectors — no individual rotation needed
        cheq.position = result.startPosition
          .add(startRight.scale(-trackDef.trackWidth / 2 + cc * cheqSize + cheqSize / 2))
          .add(startTangent.scale((cr - 1) * cheqSize));
        cheq.position.y = 0.04;
        cheq.material = isWhite ? chequeredWhite : chequeredBlack;
        cheq.freezeWorldMatrix();
        result.meshes.push(cheq);
      }
    }

    // Store road boundaries for collision detection
    result.leftWall = roadPaths[0];
    result.rightWall = roadPaths[1];

    return result;
  }

  // ─── Material Cache (shared across all props to minimize draw calls) ───
  var _matCache = {};
  function getCachedMat(scene, key, createFn) {
    if (_matCache[key]) return _matCache[key];
    var mat = createFn();
    _matCache[key] = mat;
    return mat;
  }

  function buildEnvironmentProps(scene, trackDef, splinePoints, roadPaths, env) {
    const envType = trackDef.environment;
    const count = 40;

    for (let i = 0; i < count; i++) {
      const t = i / count;
      const pos = getSplinePoint(splinePoints, t);
      const tangent = getSplineTangent(splinePoints, t);
      const right = V3.Cross(tangent, V3.Up()).normalize();

      // Place props to the sides of the road
      const side = (i % 2 === 0) ? 1 : -1;
      const offset = trackDef.trackWidth * 1.5 + 5 + Math.random() * 12;
      const propPos = pos.add(right.scale(side * offset));

      // Also add a closer prop on opposite side every 3rd position
      var nearOffset = trackDef.trackWidth * 1.3 + 4 + Math.random() * 8;
      var nearPropPos = pos.add(right.scale(-side * nearOffset));

      // Skip if prop would be on the track
      if (isOnTrack(splinePoints, trackDef.trackWidth + 6, propPos)) continue;
      if (isOnTrack(splinePoints, trackDef.trackWidth + 6, nearPropPos)) nearPropPos = null;

      switch (envType) {
        case 'city':
          buildCityProp(scene, propPos, env, i);
          if (i % 3 === 0 && nearPropPos) buildStreetLamp(scene, nearPropPos);
          break;
        case 'desert':
          buildDesertProp(scene, propPos, env);
          if (i % 4 === 0 && nearPropPos) buildDesertProp(scene, nearPropPos, env);
          break;
        case 'ice':
          buildIceProp(scene, propPos, env);
          if (i % 3 === 0 && nearPropPos) buildIceProp(scene, nearPropPos, env);
          break;
        case 'jungle':
          buildJungleProp(scene, propPos, env);
          if (i % 3 === 0 && nearPropPos) buildJungleProp(scene, nearPropPos, env);
          break;
        case 'sky':
          buildSkyProp(scene, propPos, env);
          if (i % 4 === 0 && nearPropPos) buildSkyProp(scene, nearPropPos, env);
          break;
      }
    }
  }

  function buildCityProp(scene, pos, env, index) {
    // Neon buildings with window glow and multiple neon strips
    var h = 4 + Math.random() * 14;
    var w = 2 + Math.random() * 4;
    var d = 2 + Math.random() * 4;
    var building = MB.CreateBox('bldg', { width: w, height: h, depth: d }, scene);
    building.position = pos.add(new V3(0, h / 2, 0));
    building.material = getCachedMat(scene, 'city_bldg', function() {
      var m = new BABYLON.StandardMaterial('bldgMat_shared', scene);
      m.diffuseColor = new Color3(0.15, 0.12, 0.25);
      m.specularColor = new Color3(0.05, 0.05, 0.1);
      m.freeze();
      return m;
    });
    building.freezeWorldMatrix();

    // Window rows — emissive strips give buildings life
    var windowMat = getCachedMat(scene, 'city_window', function() {
      var m = new BABYLON.StandardMaterial('winMat', scene);
      m.emissiveColor = new Color3(0.35, 0.3, 0.55);
      m.diffuseColor = new Color3(0.2, 0.15, 0.3);
      m.freeze();
      return m;
    });
    var windowRows = Math.floor(h / 3);
    for (var row = 0; row < windowRows; row++) {
      var wy = (row + 1) * 2.5;
      if (wy > h - 1) break;
      var win = MB.CreateBox('win', { width: w * 0.7, height: 0.12, depth: d + 0.1 }, scene);
      win.position = pos.add(new V3(0, wy, 0));
      win.material = windowMat;
      win.freezeWorldMatrix();
    }

    // Neon accent strips — always at least one, sometimes two
    var neonColors = [new Color3(0, 0.5, 1), new Color3(1, 0.3, 0), new Color3(0, 1, 0.5), new Color3(1, 0, 0.6), new Color3(0.3, 0, 1)];
    var neonIdx = (index || 0) % neonColors.length;
    var stripMat = getCachedMat(scene, 'city_neon_' + neonIdx, function() {
      var m = new BABYLON.StandardMaterial('neonMat_' + neonIdx, scene);
      m.emissiveColor = neonColors[neonIdx];
      m.diffuseColor = neonColors[neonIdx];
      m.freeze();
      return m;
    });

    // Primary neon strip — taller and more visible
    var strip1 = MB.CreateBox('neon', { width: w + 0.1, height: 0.4, depth: d + 0.1 }, scene);
    strip1.position = pos.add(new V3(0, h * 0.4, 0));
    strip1.material = stripMat;
    strip1.freezeWorldMatrix();

    // Second neon strip on taller buildings
    if (h > 10 && Math.random() > 0.3) {
      var neonIdx2 = (neonIdx + 2) % neonColors.length;
      var strip2 = MB.CreateBox('neon2', { width: w + 0.1, height: 0.3, depth: d + 0.1 }, scene);
      strip2.position = pos.add(new V3(0, h * 0.75, 0));
      strip2.material = getCachedMat(scene, 'city_neon_' + neonIdx2, function() {
        var m = new BABYLON.StandardMaterial('neonMat_' + neonIdx2, scene);
        m.emissiveColor = neonColors[neonIdx2];
        m.diffuseColor = neonColors[neonIdx2];
        m.freeze();
        return m;
      });
      strip2.freezeWorldMatrix();
    }

    // Rooftop accent — small emissive box on top of building
    if (Math.random() > 0.5) {
      var roofLight = MB.CreateBox('roof', { width: 0.4, height: 0.4, depth: 0.4 }, scene);
      roofLight.position = pos.add(new V3(0, h + 0.2, 0));
      roofLight.material = getCachedMat(scene, 'city_roofred', function() {
        var m = new BABYLON.StandardMaterial('roofRedMat', scene);
        m.emissiveColor = new Color3(1, 0, 0);
        m.diffuseColor = new Color3(1, 0, 0);
        m.freeze();
        return m;
      });
      roofLight.freezeWorldMatrix();
    }
  }

  function buildStreetLamp(scene, pos) {
    var poleMat = getCachedMat(scene, 'city_pole', function() {
      var m = new BABYLON.StandardMaterial('poleMat', scene);
      m.diffuseColor = new Color3(0.3, 0.3, 0.35);
      m.freeze();
      return m;
    });
    var pole = MB.CreateCylinder('pole', { height: 5, diameter: 0.15, tessellation: 6 }, scene);
    pole.position = pos.add(new V3(0, 2.5, 0));
    pole.material = poleMat;
    pole.freezeWorldMatrix();

    // Arm extending over road
    var arm = MB.CreateBox('arm', { width: 2, height: 0.08, depth: 0.08 }, scene);
    arm.position = pos.add(new V3(1, 4.9, 0));
    arm.material = poleMat;
    arm.freezeWorldMatrix();

    // Lamp globe — warm yellow glow
    var lamp = MB.CreateSphere('lamp', { diameter: 0.5, segments: 6 }, scene);
    lamp.position = pos.add(new V3(2, 4.7, 0));
    lamp.material = getCachedMat(scene, 'city_lampglow', function() {
      var m = new BABYLON.StandardMaterial('lampMat', scene);
      m.emissiveColor = new Color3(1, 0.85, 0.5);
      m.diffuseColor = new Color3(1, 0.85, 0.5);
      m.freeze();
      return m;
    });
    lamp.freezeWorldMatrix();
  }

  function buildDesertProp(scene, pos) {
    var rockMat = getCachedMat(scene, 'desert_rock', function() { var m = new BABYLON.StandardMaterial('rockMat_s', scene); m.diffuseColor = new Color3(0.65, 0.5, 0.3); m.freeze(); return m; });
    var cactusMat = getCachedMat(scene, 'desert_cactus', function() { var m = new BABYLON.StandardMaterial('cactusMat_s', scene); m.diffuseColor = new Color3(0.2, 0.5, 0.15); m.freeze(); return m; });
    var deadTreeMat = getCachedMat(scene, 'desert_deadtree', function() { var m = new BABYLON.StandardMaterial('deadTreeMat_s', scene); m.diffuseColor = new Color3(0.4, 0.3, 0.2); m.freeze(); return m; });
    var r = Math.random();
    if (r > 0.6) {
      // Rock cluster — varied sizes
      var rock = MB.CreateBox('rock', { width: 1.5 + Math.random(), height: 1.2 + Math.random() * 2, depth: 1.5 + Math.random() }, scene);
      rock.position = pos.add(new V3(0, 0.6, 0));
      rock.rotation.y = Math.random() * Math.PI;
      rock.material = rockMat;
      rock.freezeWorldMatrix();
      // Small companion rock
      var rock2 = MB.CreateBox('rock2', { width: 0.8, height: 0.6, depth: 0.8 }, scene);
      rock2.position = pos.add(new V3(1.5, 0.3, 0.5));
      rock2.rotation.y = Math.random() * Math.PI;
      rock2.material = rockMat;
      rock2.freezeWorldMatrix();
    } else if (r > 0.3) {
      // Cactus with arm
      var trunk = MB.CreateCylinder('cactus', { height: 3, diameter: 0.4, tessellation: 6 }, scene);
      trunk.position = pos.add(new V3(0, 1.5, 0));
      trunk.material = cactusMat;
      trunk.freezeWorldMatrix();
      var cArm = MB.CreateCylinder('cArm', { height: 1.2, diameter: 0.25, tessellation: 6 }, scene);
      cArm.position = pos.add(new V3(0.4, 2.2, 0));
      cArm.rotation.z = Math.PI / 3;
      cArm.material = cactusMat;
      cArm.freezeWorldMatrix();
    } else {
      // Dead tree
      var deadTrunk = MB.CreateCylinder('deadTree', { height: 3.5, diameterTop: 0.08, diameterBottom: 0.3, tessellation: 5 }, scene);
      deadTrunk.position = pos.add(new V3(0, 1.75, 0));
      deadTrunk.material = deadTreeMat;
      deadTrunk.freezeWorldMatrix();
      // Branch
      var branch = MB.CreateCylinder('branch', { height: 1.5, diameterTop: 0.04, diameterBottom: 0.1, tessellation: 4 }, scene);
      branch.position = pos.add(new V3(0.5, 2.8, 0));
      branch.rotation.z = -Math.PI / 4;
      branch.material = deadTreeMat;
      branch.freezeWorldMatrix();
    }
  }

  function buildIceProp(scene, pos) {
    var trunkMat = getCachedMat(scene, 'ice_trunk', function() { var m = new BABYLON.StandardMaterial('iceTrunk_s', scene); m.diffuseColor = new Color3(0.35, 0.2, 0.1); m.freeze(); return m; });
    var foliageMat = getCachedMat(scene, 'ice_foliage', function() { var m = new BABYLON.StandardMaterial('iceFoliage_s', scene); m.diffuseColor = new Color3(0.15, 0.45, 0.2); m.freeze(); return m; });
    var shardMat = getCachedMat(scene, 'ice_shard', function() { var m = new BABYLON.StandardMaterial('iceShard_s', scene); m.diffuseColor = new Color3(0.7, 0.85, 1); m.alpha = 0.7; m.freeze(); return m; });
    var snowMat = getCachedMat(scene, 'ice_snow', function() { var m = new BABYLON.StandardMaterial('snowMat_s', scene); m.diffuseColor = new Color3(0.9, 0.92, 0.95); m.freeze(); return m; });
    var r = Math.random();
    if (r > 0.5) {
      // Pine tree with snow cap
      var trunk = MB.CreateCylinder('trunk', { height: 1.5, diameter: 0.3, tessellation: 6 }, scene);
      trunk.position = pos.add(new V3(0, 0.75, 0));
      trunk.material = trunkMat;
      trunk.freezeWorldMatrix();
      var cone = MB.CreateCylinder('foliage', { height: 2.5, diameterTop: 0, diameterBottom: 1.5, tessellation: 6 }, scene);
      cone.position = pos.add(new V3(0, 2.5, 0));
      cone.material = foliageMat;
      cone.freezeWorldMatrix();
      // Snow cap
      var snowCap = MB.CreateCylinder('snowCap', { height: 0.4, diameterTop: 0, diameterBottom: 1.0, tessellation: 6 }, scene);
      snowCap.position = pos.add(new V3(0, 3.6, 0));
      snowCap.material = snowMat;
      snowCap.freezeWorldMatrix();
    } else if (r > 0.2) {
      // Ice crystal cluster
      var h = 1 + Math.random() * 3;
      var shard = MB.CreateCylinder('shard', { height: h, diameterTop: 0, diameterBottom: 0.6, tessellation: 5 }, scene);
      shard.position = pos.add(new V3(0, h / 2, 0));
      shard.material = shardMat;
      shard.freezeWorldMatrix();
      // Second smaller shard
      var h2 = h * 0.6;
      var shard2 = MB.CreateCylinder('shard2', { height: h2, diameterTop: 0, diameterBottom: 0.4, tessellation: 5 }, scene);
      shard2.position = pos.add(new V3(0.5, h2 / 2, 0.3));
      shard2.rotation.z = 0.3;
      shard2.material = shardMat;
      shard2.freezeWorldMatrix();
    } else {
      // Snow bank
      var bank = MB.CreateSphere('snowBank', { diameter: 2.5, segments: 5 }, scene);
      bank.position = pos.add(new V3(0, 0.5, 0));
      bank.scaling = new V3(1.5, 0.5, 1.2);
      bank.material = snowMat;
      bank.freezeWorldMatrix();
    }
  }

  function buildJungleProp(scene, pos) {
    var trunkMat = getCachedMat(scene, 'jungle_trunk', function() { var m = new BABYLON.StandardMaterial('jTrunk_s', scene); m.diffuseColor = new Color3(0.3, 0.2, 0.1); m.freeze(); return m; });
    var foliageMat = getCachedMat(scene, 'jungle_foliage', function() { var m = new BABYLON.StandardMaterial('jFoliage_s', scene); m.diffuseColor = new Color3(0.1, 0.4, 0.1); m.freeze(); return m; });
    var flowerMat = getCachedMat(scene, 'jungle_flower', function() { var m = new BABYLON.StandardMaterial('jFlower_s', scene); m.emissiveColor = new Color3(0.8, 0.2, 0.5); m.diffuseColor = new Color3(0.8, 0.2, 0.5); m.freeze(); return m; });
    var r = Math.random();
    if (r > 0.3) {
      // Tall tree with wide canopy
      var tH = 4 + Math.random() * 3;
      var trunk = MB.CreateCylinder('trunk', { height: tH, diameter: 0.5, tessellation: 6 }, scene);
      trunk.position = pos.add(new V3(0, tH / 2, 0));
      trunk.material = trunkMat;
      trunk.freezeWorldMatrix();
      var foliage = MB.CreateSphere('foliage', { diameter: 3 + Math.random() * 2, segments: 5 }, scene);
      foliage.position = pos.add(new V3(0, tH + 1, 0));
      foliage.scaling = new V3(1.2, 0.7, 1.2);
      foliage.material = foliageMat;
      foliage.freezeWorldMatrix();
      // Hanging vines
      if (Math.random() > 0.5) {
        var vine = MB.CreateCylinder('vine', { height: 2, diameter: 0.05, tessellation: 4 }, scene);
        vine.position = pos.add(new V3(0.8, tH - 0.5, 0));
        vine.material = foliageMat;
        vine.freezeWorldMatrix();
      }
    } else {
      // Bush with flowers
      var bush = MB.CreateSphere('bush', { diameter: 1.5, segments: 5 }, scene);
      bush.position = pos.add(new V3(0, 0.6, 0));
      bush.scaling = new V3(1.3, 0.8, 1.3);
      bush.material = foliageMat;
      bush.freezeWorldMatrix();
      // Flower accent
      var flower = MB.CreateSphere('flower', { diameter: 0.3, segments: 4 }, scene);
      flower.position = pos.add(new V3(0.3, 1.1, 0.2));
      flower.material = flowerMat;
      flower.freezeWorldMatrix();
    }
  }

  function buildSkyProp(scene, pos) {
    var cloudMat = getCachedMat(scene, 'sky_cloud', function() { var m = new BABYLON.StandardMaterial('cloud_s', scene); m.diffuseColor = new Color3(1, 1, 1); m.emissiveColor = new Color3(0.3, 0.3, 0.4); m.alpha = 0.65; m.freeze(); return m; });
    var crystalMat = getCachedMat(scene, 'sky_crystal', function() { var m = new BABYLON.StandardMaterial('crystal_s', scene); m.emissiveColor = new Color3(1, 0.85, 0); m.diffuseColor = new Color3(1, 0.85, 0); m.alpha = 0.8; m.freeze(); return m; });
    var r = Math.random();
    if (r > 0.4) {
      // Cloud cluster
      var cloud = MB.CreateSphere('cloud', { diameter: 4, segments: 4 }, scene);
      cloud.position = pos.add(new V3(0, Math.random() * 3, 0));
      cloud.scaling = new V3(1 + Math.random(), 0.4, 1 + Math.random());
      cloud.material = cloudMat;
      cloud.freezeWorldMatrix();
      // Secondary puff
      var puff = MB.CreateSphere('puff', { diameter: 2.5, segments: 4 }, scene);
      puff.position = pos.add(new V3(2, Math.random() * 2, 1));
      puff.scaling = new V3(1, 0.35, 1);
      puff.material = cloudMat;
      puff.freezeWorldMatrix();
    } else {
      // Floating crystal pillar
      var cH = 2 + Math.random() * 3;
      var crystal = MB.CreateCylinder('crystal', { height: cH, diameterTop: 0, diameterBottom: 0.8, tessellation: 6 }, scene);
      crystal.position = pos.add(new V3(0, cH / 2 - 1, 0));
      crystal.material = crystalMat;
      crystal.freezeWorldMatrix();
    }
  }

  // ─── Track Collision Helpers ──────────────────────────────────────
  function getClosestPointOnTrack(splinePoints, position) {
    let bestDist = Infinity;
    let bestT = 0;
    let bestPoint = splinePoints[0];
    const step = 1 / splinePoints.length;

    for (let i = 0; i < splinePoints.length; i++) {
      const d = V3.DistanceSquared(position, splinePoints[i]);
      if (d < bestDist) {
        bestDist = d;
        bestT = i * step;
        bestPoint = splinePoints[i];
      }
    }
    return { t: bestT, point: bestPoint, distance: Math.sqrt(bestDist) };
  }

  function isOnTrack(splinePoints, trackWidth, position) {
    const closest = getClosestPointOnTrack(splinePoints, position);
    return closest.distance < trackWidth / 2;
  }

  function getWallNormal(splinePoints, trackWidth, position) {
    const closest = getClosestPointOnTrack(splinePoints, position);
    if (closest.distance < trackWidth / 2) return null; // on track
    const outward = position.subtract(closest.point).normalize();
    outward.y = 0;
    return outward.scale(-1); // normal pointing inward
  }

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.TrackBuilder = {
    TRACKS,
    ENVIRONMENTS,
    buildTrack,
    getSplinePoint,
    getSplineTangent,
    getClosestPointOnTrack,
    isOnTrack,
    getWallNormal,
  };
})();

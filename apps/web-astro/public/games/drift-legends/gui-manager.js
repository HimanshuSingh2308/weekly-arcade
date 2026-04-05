'use strict';
/**
 * Drift Legends -- GUI Manager
 * ALL UI via Babylon.js GUI AdvancedDynamicTexture.
 * Manages screen state machine: MENU, STORY_SELECT, CAR_SELECT, RACE_HUD,
 * RACE_RESULT, MP_LOBBY, SETTINGS, LOADING, COUNTDOWN, DISCONNECT.
 */
(function () {
  const GUI = BABYLON.GUI;

  // ─── Design Tokens ────────────────────────────────────────────────
  const COLORS = {
    bg: '#0d0d1a',
    bgPanel: 'rgba(13,13,26,0.92)',
    bgCard: 'rgba(20,20,40,0.85)',
    accent: '#ff4d00',
    accentGlow: 'rgba(255,77,0,0.35)',
    accentDark: '#cc3d00',
    accentLight: '#ff7733',
    text: '#ffffff',
    textDim: '#999999',
    textMuted: '#666666',
    gold: '#ffd700',
    silver: '#c0c0c0',
    bronze: '#cd7f32',
    green: '#00ff88',
    red: '#ff4444',
    // Chapter theme colors
    ch1: '#00d4ff',  // City neon cyan
    ch2: '#ff9933',  // Desert orange
    ch3: '#88ccff',  // Ice blue
    ch4: '#33cc66',  // Jungle green
    ch5: '#cc66ff',  // Sky purple
  };
  const CH_COLORS = [COLORS.ch1, COLORS.ch2, COLORS.ch3, COLORS.ch4, COLORS.ch5];
  const FONT = 'bold 24px monospace';
  const FONT_SMALL = '16px monospace';
  const STAR_FILLED = '\u2b50';
  const STAR_EMPTY = '\u2606';

  class GUIManager {
    constructor(scene) {
      this.scene = scene;
      this.ui = GUI.AdvancedDynamicTexture.CreateFullscreenUI('driftLegendsUI', true, scene);
      this.screens = {};
      this.currentScreen = null;
      this.callbacks = {};

      // HUD elements (updated each frame)
      this.hud = {};

      // Mobile touch controls
      this.touchControls = null;

      this._buildAllScreens();
    }

    // ─── Screen Management ────────────────────────────────────────
    show(screenName) {
      if (this.currentScreen && this.screens[this.currentScreen]) {
        this.screens[this.currentScreen].isVisible = false;
      }
      if (this.screens[screenName]) {
        this.screens[screenName].isVisible = true;
      }
      this.currentScreen = screenName;
      // Hide touch controls for menu/overlay screens — they block clicks
      if (this.touchControls) {
        var racingScreens = ['RACE_HUD', 'COUNTDOWN', 'CINEMATIC_INTRO'];
        this.touchControls.isVisible = racingScreens.indexOf(screenName) >= 0 && window.DriftLegends.Input.isMobile();
      }
      // Hide result buttons when leaving result screen
      if (screenName !== 'RACE_RESULT') {
        if (this._resultNextBtn) this._resultNextBtn.isVisible = false;
        if (this._resultRetryBtn) this._resultRetryBtn.isVisible = false;
        if (this._resultMenuBtn) this._resultMenuBtn.isVisible = false;
      }
      // Auto-unlock chapters when entering story select
      if (screenName === 'STORY_SELECT') {
        try {
          var SM = window.DriftLegends.StoryMode;
          var prog = SM.loadLocalProgress();
          SM.CHAPTERS.forEach(function(ch) {
            if (ch.id > 1 && SM.isChapterUnlocked(prog, ch.id) && !prog.chaptersUnlocked.includes(ch.id)) {
              prog.chaptersUnlocked.push(ch.id);
              SM.saveLocalProgress(prog);
            }
          });
        } catch(_) {}
      }
      // Toggle garage 3D car preview
      if (this._showGaragePreview) {
      if (screenName === 'CAR_SELECT') {
        // Dispose menu car — it conflicts with garage car
        if (this._menuCar) { this._menuCar.dispose(false, true); this._menuCar = null; }
        if (this._menuCarLight) this._menuCarLight.setEnabled(false);
        if (this._menuCarFill) this._menuCarFill.setEnabled(false);
        if (this._menuCarRim) this._menuCarRim.setEnabled(false);
        if (this._menuCarHemi) this._menuCarHemi.setEnabled(false);
        // Build garage preview
        if (!this._garageCar && this._selectedCarId) {
          this._showGarageCarPreview(this._selectedCarId);
        }
        this._showGaragePreview(true);
      } else {
        this._showGaragePreview(false);
      }
      }
      // Re-enable mesh picking when leaving overlay screens
      if (screenName !== 'RACE_RESULT' && screenName !== 'PAUSE') {
        if (this.scene) this.scene.meshes.forEach(function(m) { m.isPickable = true; });
      }
      // Toggle HTML backgrounds based on screen
      var mtnBg = document.getElementById('storyMtnBg');
      var skyBg = document.getElementById('skylineBg');
      if (mtnBg) mtnBg.style.display = (screenName === 'STORY_SELECT') ? '' : 'none';
      if (skyBg) skyBg.style.display = (screenName === 'MENU') ? '' : 'none';
      // Hide all HTML backgrounds on car select (3D scene renders its own bg)
      if (screenName === 'CAR_SELECT') {
        if (mtnBg) mtnBg.style.display = 'none';
        if (skyBg) skyBg.style.display = 'none';
      }
    }

    hide(screenName) {
      if (this.screens[screenName]) {
        this.screens[screenName].isVisible = false;
      }
    }

    hideAll() {
      Object.values(this.screens).forEach(s => s.isVisible = false);
      this.currentScreen = null;
    }

    onAction(name, callback) {
      this.callbacks[name] = callback;
    }

    _fire(name, data) {
      if (this.callbacks[name]) this.callbacks[name](data);
    }

    // Standard back button — always top-left, same position on every screen
    _addBackButton(panel, targetScreen) {
      var btn = this._createSecondaryButton('\u2190 BACK', '110px', '36px');
      btn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      btn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      btn.left = '16px';
      btn.top = '12px';
      btn.fontSize = 13;
      panel.addControl(btn);
      btn.onPointerClickObservable.add(() => { this._fire('click'); this.show(targetScreen); });
      return btn;
    }

    // Standard screen title — top-right for balance with back button on left
    _addScreenTitle(panel, text) {
      var title = this._createTitle(text, 24, COLORS.text);
      title.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      title.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      title.left = '-20px';
      title.top = '14px';
      panel.addControl(title);
      return title;
    }

    // ─── Screen Builders ──────────────────────────────────────────
    _buildAllScreens() {
      this._buildMainMenu();
      this._buildStorySelect();
      this._buildCarSelect();
      this._buildPreRace();
      this._buildRaceHUD();
      this._buildCountdown();
      this._buildRaceResult();
      this._buildMPMenu();
      this._buildSettings();
      this._buildLoading();
      this._buildPauseMenu();
      this._buildDisconnect();
      this._buildMobileTouchControls();
      this._buildTutorialOverlay();
    }

    _createPanel(name, transparent) {
      const panel = new GUI.Rectangle(name);
      panel.width = '100%';
      panel.height = '100%';
      panel.background = transparent ? 'transparent' : COLORS.bg;
      panel.thickness = 0;
      panel.isVisible = false;
      this.ui.addControl(panel);
      this.screens[name] = panel;

      // Add vignette overlay for non-transparent menu panels (game-like depth)
      if (!transparent) {
        // Top accent line
        var topLine = new GUI.Rectangle(name + '_topLine');
        topLine.width = '100%';
        topLine.height = '2px';
        topLine.background = 'rgba(255,77,0,0.3)';
        topLine.thickness = 0;
        topLine.isHitTestVisible = false;
        topLine.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        topLine.top = '0px';
        panel.addControl(topLine);
        // Bottom accent line
        var botLine = new GUI.Rectangle(name + '_botLine');
        botLine.width = '100%';
        botLine.height = '1px';
        botLine.background = 'rgba(255,77,0,0.15)';
        botLine.thickness = 0;
        botLine.isHitTestVisible = false;
        botLine.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        botLine.top = '-10px';
        panel.addControl(botLine);
      }

      return panel;
    }

    // Gradient-style card container with glow border
    _createCard(name, width, height, parent, glowColor) {
      const card = new GUI.Rectangle(name);
      card.width = width || '320px';
      card.height = height || '70px';
      card.cornerRadius = 12;
      card.background = COLORS.bgCard;
      card.thickness = 1.5;
      card.isHitTestVisible = false; // don't block clicks to buttons behind
      card.color = glowColor || COLORS.accent;
      card.shadowColor = glowColor || COLORS.accentGlow;
      card.shadowBlur = 12;
      card.shadowOffsetX = 0;
      card.shadowOffsetY = 2;
      card.paddingBottom = '8px';
      if (parent) parent.addControl(card);
      return card;
    }

    _createButton(text, width, height, parent) {
      const btn = GUI.Button.CreateSimpleButton('btn_' + text, text);
      btn.width = width || '260px';
      btn.height = height || '54px';
      btn.color = '#0d0d1a';
      btn.background = COLORS.accent;
      btn.cornerRadius = 10;
      btn.thickness = 0;
      btn.fontFamily = 'monospace';
      btn.fontWeight = 'bold';
      btn.fontSize = 18;
      btn.hoverCursor = 'pointer';
      btn.shadowColor = COLORS.accentGlow;
      btn.shadowBlur = 16;
      btn.shadowOffsetY = 3;
      // Hover: scale + brighten
      btn.onPointerEnterObservable.add(() => {
        btn.scaleX = 1.04; btn.scaleY = 1.04;
        btn.background = COLORS.accentLight;
        btn.shadowBlur = 24;
      });
      btn.onPointerOutObservable.add(() => {
        btn.scaleX = 1; btn.scaleY = 1;
        btn.background = COLORS.accent;
        btn.shadowBlur = 16;
      });
      // Press: shrink
      btn.onPointerDownObservable.add(() => { btn.scaleX = 0.97; btn.scaleY = 0.97; });
      btn.onPointerUpObservable.add(() => { btn.scaleX = 1.04; btn.scaleY = 1.04; });
      if (parent) parent.addControl(btn);
      return btn;
    }

    _createSecondaryButton(text, width, height, parent) {
      const btn = GUI.Button.CreateSimpleButton('btn_' + text, text);
      btn.width = width || '260px';
      btn.height = height || '50px';
      btn.color = COLORS.accent;
      btn.background = 'rgba(255,77,0,0.08)';
      btn.cornerRadius = 10;
      btn.thickness = 1.5;
      btn.fontFamily = 'monospace';
      btn.fontWeight = 'bold';
      btn.fontSize = 18;
      btn.hoverCursor = 'pointer';
      // Hover glow
      btn.onPointerEnterObservable.add(() => {
        btn.scaleX = 1.03; btn.scaleY = 1.03;
        btn.background = 'rgba(255,77,0,0.15)';
        btn.shadowColor = COLORS.accentGlow;
        btn.shadowBlur = 14;
      });
      btn.onPointerOutObservable.add(() => {
        btn.scaleX = 1; btn.scaleY = 1;
        btn.background = 'rgba(255,77,0,0.08)';
        btn.shadowBlur = 0;
      });
      btn.onPointerDownObservable.add(() => { btn.scaleX = 0.97; btn.scaleY = 0.97; });
      btn.onPointerUpObservable.add(() => { btn.scaleX = 1.03; btn.scaleY = 1.03; });
      if (parent) parent.addControl(btn);
      return btn;
    }

    _createText(text, fontSize, color, parent) {
      const tb = new GUI.TextBlock();
      tb.text = text;
      tb.color = color || COLORS.text;
      tb.fontSize = fontSize || 24;
      tb.fontFamily = 'monospace';
      tb.fontWeight = 'bold';
      tb.resizeToFit = true;
      tb.height = (fontSize || 24) + 12 + 'px';
      tb.isHitTestVisible = false; // don't intercept clicks
      if (parent) parent.addControl(tb);
      return tb;
    }

    // Large title text with shadow effect
    _createTitle(text, fontSize, color, parent) {
      const tb = new GUI.TextBlock();
      tb.text = text;
      tb.color = color || COLORS.text;
      tb.isHitTestVisible = false; // don't intercept clicks
      tb.fontSize = fontSize || 36;
      tb.fontFamily = 'monospace';
      tb.fontWeight = 'bold';
      tb.resizeToFit = true;
      tb.height = (fontSize || 36) + 16 + 'px';
      tb.shadowColor = COLORS.accentGlow;
      tb.shadowBlur = 8;
      tb.shadowOffsetX = 0;
      tb.shadowOffsetY = 2;
      if (parent) parent.addControl(tb);
      return tb;
    }

    // ─── SVG Scene Generators ──────────────────────────────────────
    _buildCitySkylineSVG() {
      // Procedural neon city skyline — no external files
      var w = 1200, h = 600;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">';
      // Sky gradient
      svg += '<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">';
      svg += '<stop offset="0%" stop-color="#0a0820"/>';
      svg += '<stop offset="60%" stop-color="#0f1028"/>';
      svg += '<stop offset="100%" stop-color="#1a1035"/>';
      svg += '</linearGradient>';
      // Neon glow filter
      svg += '<filter id="glow"><feGaussianBlur stdDeviation="4" result="blur"/>';
      svg += '<feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
      svg += '</defs>';
      svg += '<rect width="' + w + '" height="' + h + '" fill="url(#sky)"/>';

      // Stars
      for (var s = 0; s < 40; s++) {
        var sx = Math.random() * w, sy = Math.random() * h * 0.4;
        var sr = 0.5 + Math.random() * 1.5;
        svg += '<circle cx="' + sx + '" cy="' + sy + '" r="' + sr + '" fill="rgba(255,255,255,' + (0.2 + Math.random() * 0.5) + ')"/>';
      }

      // Moon
      svg += '<circle cx="900" cy="80" r="30" fill="#1a1a40" stroke="rgba(200,200,255,0.3)" stroke-width="2"/>';
      svg += '<circle cx="908" cy="74" r="28" fill="#0f1028"/>';

      // Buildings (back row — darker, taller)
      var buildings = [
        { x: 0, w: 80, h: 280 }, { x: 70, w: 60, h: 350 }, { x: 120, w: 90, h: 300 },
        { x: 200, w: 70, h: 400 }, { x: 260, w: 100, h: 320 }, { x: 350, w: 60, h: 380 },
        { x: 400, w: 80, h: 290 }, { x: 470, w: 110, h: 420 }, { x: 570, w: 70, h: 340 },
        { x: 630, w: 90, h: 370 }, { x: 710, w: 60, h: 310 }, { x: 760, w: 100, h: 450 },
        { x: 850, w: 80, h: 330 }, { x: 920, w: 70, h: 390 }, { x: 980, w: 90, h: 360 },
        { x: 1060, w: 80, h: 300 }, { x: 1130, w: 70, h: 340 },
      ];
      var neonColors = ['#00d4ff', '#ff4d00', '#00ff88', '#ff0066', '#8844ff', '#ffaa00'];

      buildings.forEach(function(b, i) {
        var by = h - b.h;
        // Building body
        svg += '<rect x="' + b.x + '" y="' + by + '" width="' + b.w + '" height="' + b.h + '" fill="#0c0c1a" stroke="rgba(255,255,255,0.03)" stroke-width="0.5"/>';

        // Window grid
        var wCols = Math.floor(b.w / 14);
        var wRows = Math.floor(b.h / 20);
        for (var wr = 1; wr < wRows; wr++) {
          for (var wc = 0; wc < wCols; wc++) {
            var lit = Math.random() > 0.5;
            if (!lit) continue;
            var wx = b.x + 6 + wc * 14;
            var wy = by + 8 + wr * 20;
            var wColor = Math.random() > 0.8 ? 'rgba(255,200,100,0.6)' : 'rgba(180,200,255,0.25)';
            svg += '<rect x="' + wx + '" y="' + wy + '" width="8" height="10" fill="' + wColor + '" rx="1"/>';
          }
        }

        // Neon strip
        var nColor = neonColors[i % neonColors.length];
        var ny = by + b.h * (0.2 + Math.random() * 0.4);
        svg += '<rect x="' + b.x + '" y="' + ny + '" width="' + b.w + '" height="4" fill="' + nColor + '" filter="url(#glow)" opacity="0.8"/>';

        // Second neon on tall buildings
        if (b.h > 350) {
          var n2Color = neonColors[(i + 3) % neonColors.length];
          var n2y = by + b.h * 0.15;
          svg += '<rect x="' + b.x + '" y="' + n2y + '" width="' + b.w + '" height="3" fill="' + n2Color + '" filter="url(#glow)" opacity="0.6"/>';
        }

        // Rooftop antenna/light on some
        if (Math.random() > 0.6) {
          var ax = b.x + b.w / 2;
          svg += '<line x1="' + ax + '" y1="' + by + '" x2="' + ax + '" y2="' + (by - 15) + '" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>';
          svg += '<circle cx="' + ax + '" cy="' + (by - 15) + '" r="2" fill="#ff0000" filter="url(#glow)"/>';
        }
      });

      // Road at bottom
      svg += '<rect x="0" y="' + (h - 50) + '" width="' + w + '" height="50" fill="#1a1a2e"/>';
      // Center line dashes
      for (var d = 0; d < w; d += 40) {
        svg += '<rect x="' + d + '" y="' + (h - 27) + '" width="20" height="3" fill="#ff6600" rx="1" opacity="0.7"/>';
      }
      // Edge lines
      svg += '<rect x="0" y="' + (h - 50) + '" width="' + w + '" height="2" fill="rgba(255,255,255,0.4)"/>';
      svg += '<rect x="0" y="' + (h - 2) + '" width="' + w + '" height="2" fill="rgba(255,255,255,0.3)"/>';

      // Reflection/fog at base
      svg += '<rect x="0" y="' + (h - 80) + '" width="' + w + '" height="30" fill="rgba(15,16,40,0.6)"/>';

      svg += '</svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    _buildTrackLoadingSVG() {
      // Abstract track/road scene for loading screen
      var w = 800, h = 400;
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '">';
      svg += '<defs><linearGradient id="lsky" x1="0" y1="0" x2="0" y2="1">';
      svg += '<stop offset="0%" stop-color="#0a0820"/><stop offset="100%" stop-color="#0f1028"/>';
      svg += '</linearGradient>';
      svg += '<filter id="lglow"><feGaussianBlur stdDeviation="3" result="b"/>';
      svg += '<feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>';
      svg += '</defs>';
      svg += '<rect width="' + w + '" height="' + h + '" fill="url(#lsky)"/>';

      // Perspective road vanishing to center
      svg += '<polygon points="300,' + h + ' 500,' + h + ' 420,180 380,180" fill="#2a2a3a"/>';
      // Edge lines
      svg += '<line x1="300" y1="' + h + '" x2="380" y2="180" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>';
      svg += '<line x1="500" y1="' + h + '" x2="420" y2="180" stroke="rgba(255,255,255,0.5)" stroke-width="2"/>';
      // Center dashes
      for (var d = 0; d < 8; d++) {
        var t = d / 8;
        var y1 = h - t * (h - 180);
        var y2 = y1 - 15 * (1 - t * 0.7);
        var cx = 400;
        var dw = 3 * (1 - t * 0.6);
        svg += '<rect x="' + (cx - dw / 2) + '" y="' + y2 + '" width="' + dw + '" height="' + (y1 - y2) + '" fill="#ff6600" opacity="' + (0.8 - t * 0.4) + '"/>';
      }

      // Wall barriers
      svg += '<line x1="280" y1="' + h + '" x2="370" y2="180" stroke="#ff4d00" stroke-width="3" filter="url(#lglow)" opacity="0.6"/>';
      svg += '<line x1="520" y1="' + h + '" x2="430" y2="180" stroke="#ff4d00" stroke-width="3" filter="url(#lglow)" opacity="0.6"/>';

      // Horizon glow
      svg += '<ellipse cx="400" cy="180" rx="120" ry="30" fill="rgba(255,77,0,0.08)"/>';

      // City silhouette at horizon
      var bldgs = [
        { x: 200, w: 30, h: 40 }, { x: 225, w: 20, h: 60 }, { x: 240, w: 35, h: 45 },
        { x: 270, w: 25, h: 70 }, { x: 290, w: 40, h: 50 }, { x: 325, w: 20, h: 80 },
        { x: 340, w: 30, h: 55 }, { x: 365, w: 25, h: 65 }, { x: 385, w: 35, h: 90 },
        { x: 415, w: 20, h: 60 }, { x: 430, w: 30, h: 75 }, { x: 455, w: 25, h: 50 },
        { x: 475, w: 35, h: 70 }, { x: 505, w: 20, h: 45 }, { x: 520, w: 30, h: 55 },
        { x: 545, w: 25, h: 40 }, { x: 565, w: 20, h: 60 },
      ];
      bldgs.forEach(function(b) {
        svg += '<rect x="' + b.x + '" y="' + (180 - b.h) + '" width="' + b.w + '" height="' + b.h + '" fill="#080812" opacity="0.8"/>';
      });

      svg += '</svg>';
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    _buildGUISkyline(panel) {
      var neonColors = ['#00d4ff', '#ff4d00', '#00ff88', '#ff0066', '#8844ff', '#ffaa00'];
      // Building definitions: left%, width%, height% (from bottom)
      var bldgs = [
        { l: 0, w: 6, h: 35 }, { l: 5, w: 5, h: 50 }, { l: 9, w: 7, h: 40 },
        { l: 15, w: 5, h: 55 }, { l: 19, w: 8, h: 42 }, { l: 26, w: 5, h: 60 },
        { l: 30, w: 6, h: 38 }, { l: 35, w: 9, h: 65 }, { l: 43, w: 5, h: 45 },
        { l: 47, w: 7, h: 55 }, { l: 53, w: 5, h: 48 }, { l: 57, w: 8, h: 70 },
        { l: 64, w: 6, h: 43 }, { l: 69, w: 5, h: 58 }, { l: 73, w: 7, h: 50 },
        { l: 79, w: 6, h: 40 }, { l: 84, w: 5, h: 52 }, { l: 88, w: 7, h: 45 },
        { l: 94, w: 6, h: 38 },
      ];

      bldgs.forEach(function(b, i) {
        // Building body
        var bldg = new GUI.Rectangle('skyBldg_' + i);
        bldg.width = b.w + '%';
        bldg.height = b.h + '%';
        bldg.background = '#0c0c1a';
        bldg.thickness = 0.5;
        bldg.color = 'rgba(255,255,255,0.04)';
        bldg.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        bldg.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        bldg.left = b.l + '%';
        bldg.top = '-8%'; // above the road area
        panel.addControl(bldg);

        // Window dots — small emissive rectangles
        var wRows = Math.min(6, Math.floor(b.h / 8));
        var wCols = Math.max(1, Math.floor(b.w / 3));
        for (var r = 0; r < wRows; r++) {
          for (var c = 0; c < wCols; c++) {
            if (Math.random() > 0.45) continue; // many windows dark
            var win = new GUI.Rectangle('w_' + i + '_' + r + '_' + c);
            win.width = '6px';
            win.height = '4px';
            win.background = Math.random() > 0.7 ? 'rgba(255,200,100,0.7)' : 'rgba(150,180,255,0.25)';
            win.thickness = 0;
            win.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
            win.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
            win.left = (15 + c * (70 / Math.max(1, wCols))) + '%';
            win.top = (8 + r * (80 / Math.max(1, wRows))) + '%';
            bldg.addControl(win);
          }
        }

        // Neon strip
        var neon = new GUI.Rectangle('neon_' + i);
        neon.width = '100%';
        neon.height = '3px';
        neon.background = neonColors[i % neonColors.length];
        neon.thickness = 0;
        neon.shadowColor = neonColors[i % neonColors.length];
        neon.shadowBlur = 12;
        neon.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        neon.top = (20 + Math.random() * 40) + '%';
        bldg.addControl(neon);

        // Second neon on tall buildings
        if (b.h > 50) {
          var neon2 = new GUI.Rectangle('neon2_' + i);
          neon2.width = '100%';
          neon2.height = '2px';
          neon2.background = neonColors[(i + 3) % neonColors.length];
          neon2.thickness = 0;
          neon2.shadowColor = neonColors[(i + 3) % neonColors.length];
          neon2.shadowBlur = 8;
          neon2.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
          neon2.top = '10%';
          bldg.addControl(neon2);
        }

        // Rooftop red light on some
        if (Math.random() > 0.5) {
          var roofLight = new GUI.Ellipse('roof_' + i);
          roofLight.width = '6px';
          roofLight.height = '6px';
          roofLight.background = '#ff0000';
          roofLight.thickness = 0;
          roofLight.shadowColor = '#ff0000';
          roofLight.shadowBlur = 8;
          roofLight.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
          roofLight.top = '-4px';
          bldg.addControl(roofLight);
        }
      });

      // Road strip at bottom
      var road = new GUI.Rectangle('skyRoad');
      road.width = '100%';
      road.height = '8%';
      road.background = '#1a1a2e';
      road.thickness = 0;
      road.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      panel.addControl(road);

      // Road center dashes
      for (var d = 0; d < 20; d++) {
        var dash = new GUI.Rectangle('roadDash_' + d);
        dash.width = '2%';
        dash.height = '3px';
        dash.background = '#ff6600';
        dash.thickness = 0;
        dash.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        dash.left = (d * 5 + 1) + '%';
        dash.alpha = 0.7;
        road.addControl(dash);
      }

      // Road edge lines
      var edgeTop = new GUI.Rectangle('roadEdge1');
      edgeTop.width = '100%'; edgeTop.height = '2px';
      edgeTop.background = 'rgba(255,255,255,0.4)'; edgeTop.thickness = 0;
      edgeTop.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      road.addControl(edgeTop);
    }

    // ─── Main Menu ────────────────────────────────────────────────
    _buildMainMenu() {
      const panel = this._createPanel('MENU');

      // Menu background is semi-transparent — HTML SVG skyline shows through
      panel.background = 'rgba(13,13,26,0.35)';

      // Speed-line particle effect (diagonal lines shooting across)
      this._menuSpeedLines = [];
      for (let i = 0; i < 16; i++) {
        const line = new GUI.Rectangle('speed_line_' + i);
        line.width = (80 + Math.random() * 200) + 'px';
        line.height = '1.5px';
        line.background = 'rgba(255,77,0,' + (0.06 + Math.random() * 0.12) + ')';
        line.thickness = 0;
        line.rotation = -0.35;
        line.left = (-600 + Math.random() * 1200) + 'px';
        line.top = (-400 + Math.random() * 800) + 'px';
        panel.addControl(line);
        this._menuSpeedLines.push({ el: line, speed: 1.5 + Math.random() * 3, startLeft: parseFloat(line.left) });
      }

      // Animate speed lines
      this.scene.registerBeforeRender(() => {
        if (!this.screens['MENU'] || !this.screens['MENU'].isVisible) return;
        this._menuSpeedLines.forEach(sl => {
          var currentLeft = parseFloat(sl.el.left) || 0;
          currentLeft += sl.speed;
          if (currentLeft > 700) currentLeft = -700;
          sl.el.left = currentLeft + 'px';
        });
      });

      // 3D car preview (rotating slowly behind menu)
      this._buildMenuCarPreview();

      // ─── Top section: Title (left-aligned, game-style) ─────────
      var titleBlock = new GUI.StackPanel('menuTitleBlock');
      titleBlock.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      titleBlock.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      titleBlock.width = '500px';
      titleBlock.left = '40px';
      titleBlock.top = '16px';
      panel.addControl(titleBlock);

      // Title — bold, left-aligned, game-style
      const title = this._createTitle('DRIFT LEGENDS', 44, COLORS.text, titleBlock);
      title.shadowColor = COLORS.accent;
      title.shadowBlur = 24;
      title.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      title.paddingBottom = '2px';

      // Tagline
      const tagline = this._createText('Master the drift. Claim the crown.', 14, COLORS.textDim, titleBlock);
      tagline.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      tagline.paddingBottom = '4px';

      // Completion progress
      this.menuCompletionText = this._createText('', 13, COLORS.textMuted, titleBlock);
      this.menuCompletionText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;

      // ─── Top-right: Game stats (mirrors title on top-left) ───────
      var statsBlock = new GUI.StackPanel('menuStatsBlock');
      statsBlock.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      statsBlock.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      statsBlock.width = '220px';
      statsBlock.left = '-40px';
      statsBlock.top = '16px'; // same as title block
      panel.addControl(statsBlock);

      // Stats — right-aligned text rows, no card box (cleaner)
      this.menuStatsCompletion = this._createText('0% Complete', 15, COLORS.text, statsBlock);
      this.menuStatsCompletion.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.menuStatsCompletion.paddingBottom = '4px';

      this.menuStatsStars = this._createText('\u2605 0 / 45', 13, COLORS.gold, statsBlock);
      this.menuStatsStars.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.menuStatsStars.paddingBottom = '4px';

      this.menuStatsCoins = this._createText('0 coins', 13, COLORS.textDim, statsBlock);
      this.menuStatsCoins.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.menuStatsCoins.paddingBottom = '4px';

      this.menuStatsChapter = this._createText('Ch 1: Street Rookie', 12, COLORS.textMuted, statsBlock);
      this.menuStatsChapter.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;

      // ─── Bottom section: Buttons (center-bottom, horizontal) ───
      var btnBar = new GUI.StackPanel('menuBtnBar');
      btnBar.isVertical = false;
      btnBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      btnBar.height = '70px';
      btnBar.top = '-30px';
      panel.addControl(btnBar);

      const storyBtn = this._createButton('STORY MODE', '220px', '54px', btnBar);
      storyBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('storyMode'); });

      // Spacer
      var sp1 = new GUI.Rectangle(); sp1.width = '16px'; sp1.height = '1px'; sp1.thickness = 0; sp1.background = 'transparent'; btnBar.addControl(sp1);

      const mpBtn = this._createSecondaryButton('MULTIPLAYER', '220px', '54px', btnBar);
      mpBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('multiplayer'); });

      var sp2 = new GUI.Rectangle(); sp2.width = '16px'; sp2.height = '1px'; sp2.thickness = 0; sp2.background = 'transparent'; btnBar.addControl(sp2);

      const settingsBtn = this._createSecondaryButton('SETTINGS', '160px', '54px', btnBar);
      settingsBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('settings'); });
    }

    // Animated 3D car rotating on the menu background (positioned below and behind text)
    _buildMenuCarPreview() {
      try {
        const CB = window.DriftLegends.CarBuilder;
        if (!CB || !CB.buildCar) return;
        // Build a bright accent-colored car for menu display
        this._menuCar = CB.buildCar(this.scene, 'street-kart', '#ff4d00');
        // Use a dedicated ArcRotateCamera for menu — orbits around the car
        this._menuArcCam = new BABYLON.ArcRotateCamera('menuCam',
          Math.PI * 0.8,   // alpha (horizontal angle)
          Math.PI * 0.25,  // beta (low angle = looking down more = car at bottom of viewport)
          9,               // radius (distance from target)
          new BABYLON.Vector3(0, 2, 0),   // target above car = car appears lower
          this.scene
        );
        this._menuArcCam.lowerRadiusLimit = 9;
        this._menuArcCam.upperRadiusLimit = 9;
        this._menuArcCam.fov = 0.9;
        // Don't attach controls — this is display only

        // Position car at origin, camera orbits it
        this._menuCar.position = new BABYLON.Vector3(0, 0, 0);
        this._menuCar.scaling = new BABYLON.Vector3(1.0, 1.0, 1.0);
        this._menuCar.rotation.y = Math.PI * 0.15;
        this._menuCarPos = null; // not needed with ArcRotateCamera

        // Strong ambient hemi light for menu car visibility
        var carHemi = new BABYLON.HemisphericLight('menuCarHemi', new BABYLON.Vector3(0, 1, 0), this.scene);
        carHemi.intensity = 1.5;
        carHemi.diffuse = new BABYLON.Color3(1, 0.95, 0.9);
        this._menuCarHemi = carHemi;
        // Key light (warm, strong, from right-above car at origin)
        var carLight = new BABYLON.PointLight('menuCarLight', new BABYLON.Vector3(5, 4, -3), this.scene);
        carLight.intensity = 3.0;
        carLight.diffuse = new BABYLON.Color3(1, 0.7, 0.4);
        // Cool fill (from left)
        var carFill = new BABYLON.PointLight('menuCarFill', new BABYLON.Vector3(-4, 3, 2), this.scene);
        carFill.intensity = 1.5;
        carFill.diffuse = new BABYLON.Color3(0.4, 0.6, 1.0);
        this._menuCarFill = carFill;
        // Rim light (from behind, orange)
        var carRim = new BABYLON.PointLight('menuCarRim', new BABYLON.Vector3(0, 1, 5), this.scene);
        carRim.intensity = 1.0;
        carRim.diffuse = new BABYLON.Color3(1, 0.3, 0);
        this._menuCarRim = carRim;
        this._menuCarLight = carLight;

        // Slow rotation animation
        this.scene.registerBeforeRender(() => {
          if (this.screens['MENU'] && this.screens['MENU'].isVisible) {
            // Rebuild menu car if it was disposed (e.g. after racing)
            if (!this._menuCar) {
              try {
                var CB = window.DriftLegends.CarBuilder;
                if (CB && CB.buildCar) {
                  this._menuCar = CB.buildCar(this.scene, 'street-kart', '#ff4d00');
                  this._menuCar.position = new BABYLON.Vector3(0, 0, 0);
                  this._menuCar.scaling = new BABYLON.Vector3(1.0, 1.0, 1.0);
                  this._menuCar.rotation.y = Math.PI * 0.2;
                }
              } catch(_) {}
            }
            if (!this._menuCar) return;
            this._menuCar.rotation.y += 0.004;
            this._menuCar.isVisible = true;
            // Use the dedicated menu camera
            if (this._menuArcCam && this.scene.activeCamera !== this._menuArcCam) {
              this._savedCamera = this.scene.activeCamera;
              this.scene.activeCamera = this._menuArcCam;
            }
            // Slowly orbit
            if (this._menuArcCam) this._menuArcCam.alpha += 0.002;
            if (this._menuCarLight) this._menuCarLight.setEnabled(true);
            if (this._menuCarFill) this._menuCarFill.setEnabled(true);
            if (this._menuCarRim) this._menuCarRim.setEnabled(true);
            if (this._menuCarHemi) this._menuCarHemi.setEnabled(true);
          } else if (this._menuCar) {
            this._menuCar.isVisible = false;
            // Restore the chase camera
            if (this._savedCamera && this.scene.activeCamera === this._menuArcCam) {
              this.scene.activeCamera = this._savedCamera;
            }
            if (this._menuCarLight) this._menuCarLight.setEnabled(false);
            if (this._menuCarFill) this._menuCarFill.setEnabled(false);
            if (this._menuCarRim) this._menuCarRim.setEnabled(false);
            if (this._menuCarHemi) this._menuCarHemi.setEnabled(false);
          }
        });
      } catch (_) { /* car builder may not be ready */ }

      // Garage car rotation
      this.scene.registerBeforeRender(() => {
        if (this._garageCar && this.screens['CAR_SELECT'] && this.screens['CAR_SELECT'].isVisible) {
          this._garageCar.rotation.y += 0.005;
          // Don't orbit camera — only rotate car
        }
      });
    }

    updateMenuCompletion(percent, progress) {
      if (this.menuCompletionText) {
        this.menuCompletionText.text = percent > 0 ? percent + '% complete' : 'New here? Start your career.';
      }
      // Update right-side stats panel
      if (this.menuStatsCompletion) {
        this.menuStatsCompletion.text = percent + '% Complete';
      }
      if (progress && this.menuStatsStars) {
        var totalStars = 0;
        Object.values(progress.raceResults || {}).forEach(function(r) { totalStars += (r.bestStars || 0); });
        this.menuStatsStars.text = '\u2605 ' + totalStars + ' / 45';
      }
      if (progress && this.menuStatsCoins) {
        this.menuStatsCoins.text = '\ud83d\udcb0 ' + (progress.coins || 0) + ' coins';
      }
      if (progress && this.menuStatsChapter) {
        var maxCh = 1;
        (progress.chaptersUnlocked || []).forEach(function(c) { if (c > maxCh) maxCh = c; });
        var chNames = { 1: 'Street Rookie', 2: 'Desert Dash', 3: 'Frozen Peak', 4: 'Jungle Fury', 5: 'Sky Championship' };
        this.menuStatsChapter.text = 'Ch ' + maxCh + ': ' + (chNames[maxCh] || '');
      }
    }

    // ─── Story Select ─────────────────────────────────────────────
    _buildStorySelect() {
      const panel = this._createPanel('STORY_SELECT');
      panel.background = 'rgba(8,8,20,0.45)'; // semi-transparent — mountain SVG shows through
      var chThemes = ['\ud83c\udfd9\ufe0f', '\ud83c\udfdc\ufe0f', '\u2744\ufe0f', '\ud83c\udf34', '\u2601\ufe0f'];
      var chRivals = ['vs Blaze', 'vs Sandstorm', 'vs Glacier', 'vs Viper', 'vs Apex'];
      var chEnvNames = ['CITY', 'DESERT', 'ICE', 'JUNGLE', 'SKY'];

      this._addBackButton(panel, 'MENU');
      this._addScreenTitle(panel, 'STORY MODE');

      // Mountain SVG background is toggled by show() method

      // ─── Winding Mountain Road ─────────────────────────────────
      // Chapter positions — zigzag from bottom-left to top-right
      // Positions mapped to SVG road curve path:
      // SVG road: M 50,700 → C 450,550 → C 800,400 → C 1150,450 → C 1550,250
      // GUI left: -40% to +35%, top: % of canvas height
      var chPositions = [
        { x: -35, y: 38 },    // Ch1: road start, bottom-left (City)
        { x: -12, y: 15 },    // Ch2: first curve apex (Desert)
        { x: 8,   y: 25 },    // Ch3: mid road dip (Ice)
        { x: 22,  y: 5 },     // Ch4: third curve (Jungle)
        { x: 38,  y: -18 },   // Ch5: road end, top-right (Sky)
      ];

      // Road is drawn by the SVG background — no GUI dashes needed
      this._storyRoadSegs = [];

      // "You are here" — pulsing ring around current chapter (not separate element)
      this._storyCarMarker = new GUI.Ellipse('storyCarMarker');
      this._storyCarMarker.width = '24px';
      this._storyCarMarker.height = '24px';
      this._storyCarMarker.thickness = 4;
      this._storyCarMarker.color = COLORS.accent;
      this._storyCarMarker.background = 'transparent';
      this._storyCarMarker.shadowColor = COLORS.accent;
      this._storyCarMarker.shadowBlur = 25;
      panel.addControl(this._storyCarMarker);

      // Dynamic sizing + pulse animation
      var markerPulse = 0;
      var lastH = 0;
      this.scene.registerBeforeRender(() => {
        if (!this.screens['STORY_SELECT'] || !this.screens['STORY_SELECT'].isVisible) return;
        // Pulse car marker
        markerPulse += 0.05;
        if (this._storyCarMarker) {
          var s = 1 + Math.sin(markerPulse) * 0.15;
          this._storyCarMarker.scaleX = s;
          this._storyCarMarker.scaleY = s;
          this._storyCarMarker.alpha = 0.5 + Math.sin(markerPulse) * 0.4;
        }
        // Dynamic sizing — recalc on resize
        var ch = this.scene.getEngine().getRenderHeight();
        if (ch !== lastH && ch > 0) {
          lastH = ch;
          var ringSize = Math.max(70, Math.min(120, ch * 0.15));
          var emojiSize = Math.max(28, ringSize * 0.42);
          var numSize = Math.max(16, ringSize * 0.22);
          var markerSize = ringSize + 20; // slightly bigger than chapter circle
          if (this._storyCarMarker) {
            this._storyCarMarker.widthInPixels = markerSize;
            this._storyCarMarker.heightInPixels = markerSize;
          }
          this.chapterCards.forEach(function(cc) {
            if (cc.card && cc.card.widthInPixels !== undefined) {
              cc.card.widthInPixels = ringSize;
              cc.card.heightInPixels = ringSize;
              if (cc.card._themeText) cc.card._themeText.fontSize = emojiSize;
              if (cc.card._numText) {
                cc.card._numText.fontSize = numSize;
                cc.card._numText.top = Math.round(ringSize * 0.22) + 'px';
              }
              if (cc.card._themeText) cc.card._themeText.top = -Math.round(ringSize * 0.12) + 'px';
              // Reposition labels based on ring size
              var halfR = Math.round(ringSize / 2);
              if (cc.nameText) cc.nameText.top = (cc.baseY + halfR + 8) + 'px';
              if (cc.starsText) cc.starsText.top = (cc.baseY + halfR + 26) + 'px';
              if (cc.envTag) cc.envTag.top = (cc.baseY - halfR - 18) + 'px';
            }
          });
        }
      });
      // Position updated in updateChapterCards

      // Store positions for updateChapterCards
      this._storyChPositions = chPositions;

      // Chapter nodes — circular markers along the road
      this.chapterCards = [];

      for (var i = 0; i < 5; i++) {
        var chColor = CH_COLORS[i];
        var pos = chPositions[i];

        // Outer ring — sized relative to viewport height (bigger on bigger screens)
        var ring = new GUI.Ellipse('chRing_' + i);
        ring.widthInPixels = 0; // set dynamically below
        ring.heightInPixels = 0;
        ring.thickness = 3;
        ring.color = chColor;
        ring.background = 'rgba(13,13,26,0.85)';
        ring.shadowColor = chColor;
        ring.shadowBlur = 20;
        ring.left = pos.x + '%';
        ring.top = pos.y + 'px';
        panel.addControl(ring);

        // Theme emoji inside circle
        var themeText = new GUI.TextBlock('chTheme_' + i, chThemes[i]);
        themeText.fontSize = 0; // set dynamically
        themeText.top = '-10px';
        ring.addControl(themeText);

        // Chapter number below emoji
        var numText = new GUI.TextBlock('chNum_' + i, (i + 1) + '');
        numText.fontSize = 0; // set dynamically
        numText.fontFamily = 'monospace';
        numText.fontWeight = 'bold';
        numText.color = chColor;
        numText.top = '18px';
        ring.addControl(numText);

        // Store refs for dynamic sizing
        ring._themeText = themeText;
        ring._numText = numText;

        // Name label below circle (positioned dynamically)
        var nameText = new GUI.TextBlock('chName_' + i, '');
        nameText.fontSize = 15;
        nameText.fontFamily = 'monospace';
        nameText.fontWeight = 'bold';
        nameText.color = COLORS.text;
        nameText.shadowColor = 'rgba(0,0,0,0.9)';
        nameText.shadowBlur = 8;
        nameText.left = pos.x + '%';
        nameText.top = '0px'; // set dynamically
        nameText.resizeToFit = true;
        nameText.height = '20px';
        panel.addControl(nameText);

        // Stars below name (positioned dynamically)
        var starsText = new GUI.TextBlock('chStars_' + i, '');
        starsText.fontSize = 14;
        starsText.fontFamily = 'monospace';
        starsText.fontWeight = 'bold';
        starsText.color = COLORS.gold;
        starsText.shadowColor = 'rgba(0,0,0,0.9)';
        starsText.shadowBlur = 6;
        starsText.left = pos.x + '%';
        starsText.top = '0px'; // set dynamically
        starsText.resizeToFit = true;
        starsText.height = '18px';
        panel.addControl(starsText);

        // Environment tag above circle (positioned dynamically)
        var envTag = new GUI.TextBlock('chEnv_' + i, chEnvNames[i]);
        envTag.fontSize = 12;
        envTag.fontFamily = 'monospace';
        envTag.fontWeight = 'bold';
        envTag.color = chColor;
        envTag.shadowColor = 'rgba(0,0,0,0.9)';
        envTag.shadowBlur = 6;
        envTag.left = pos.x + '%';
        envTag.top = '0px'; // set dynamically
        envTag.resizeToFit = true;
        envTag.height = '16px';
        panel.addControl(envTag);

        // Click handler on the ring
        ring.onPointerEnterObservable.add((function(rng, clr) {
          return function() { rng.shadowBlur = 28; rng.scaleX = 1.1; rng.scaleY = 1.1; rng.thickness = 4; };
        })(ring, chColor));
        ring.onPointerOutObservable.add((function(rng) {
          return function() { rng.shadowBlur = 16; rng.scaleX = 1; rng.scaleY = 1; rng.thickness = 3; };
        })(ring));

        ring.onPointerClickObservable.add((function(idx) {
          return function() {
            this._fire('click');
            this._fire('selectChapter', { chapterIndex: idx });
          }.bind(this);
        }).call(this, i));

        this.chapterCards.push({ card: ring, nameText: nameText, starsText: starsText, envTag: envTag, baseY: pos.y, accentBar: null });
      }
    }

    updateChapterCards(chapters, progress) {
      const SM = window.DriftLegends.StoryMode;
      var highestUnlocked = 0;
      chapters.forEach((ch, i) => {
        if (i >= this.chapterCards.length) return;
        const cc = this.chapterCards[i];
        const unlocked = SM.isChapterUnlocked(progress, ch.id);
        cc.nameText.text = unlocked ? ch.name : '\ud83d\udd12 LOCKED';
        cc.nameText.color = unlocked ? COLORS.text : COLORS.textMuted;
        if (unlocked) {
          highestUnlocked = i;
          const earned = SM.getChapterStars ? SM.getChapterStars(progress, ch.id) : 0;
          cc.starsText.text = STAR_FILLED + ' ' + earned + '/9';
        } else {
          cc.starsText.text = '';
        }
        cc.card.alpha = unlocked ? 1 : 0.3;
        cc.card.isEnabled = unlocked;
      });
      // Light up road segments for completed chapters
      if (this._storyRoadSegs) {
        this._storyRoadSegs.forEach(function(seg) {
          if (seg.segIdx < highestUnlocked) {
            seg.el.background = COLORS.accent;
            seg.el.shadowColor = COLORS.accentGlow;
            seg.el.shadowBlur = 8;
          } else {
            seg.el.background = 'rgba(255,255,255,0.15)';
            seg.el.shadowBlur = 0;
          }
        });
      }
      // Move car marker to current chapter position
      if (this._storyCarMarker && this._storyChPositions) {
        var pos = this._storyChPositions[highestUnlocked];
        if (pos) {
          this._storyCarMarker.left = pos.x + '%';
          this._storyCarMarker.top = pos.y + 'px'; // same position as chapter — pulses around it
        }
      }
    }

    // ─── Car Select ───────────────────────────────────────────────
    _buildCarSelect() {
      const panel = this._createPanel('CAR_SELECT');
      panel.background = 'rgba(13,13,26,0.3)'; // semi-transparent — 3D car visible, dark scene bg hides HTML

      this._addBackButton(panel, 'STORY_SELECT');
      this._addScreenTitle(panel, 'GARAGE');

      // Garage floor — subtle gradient at bottom half
      var floor = new GUI.Rectangle('garageFloor');
      floor.width = '100%';
      floor.height = '40%';
      floor.background = 'rgba(20,20,30,0.4)';
      floor.thickness = 0;
      floor.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      floor.top = '-130px';
      floor.isHitTestVisible = false;
      panel.addControl(floor);

      // Spotlight glow on floor (ellipse)
      var spotlight = new GUI.Ellipse('garageSpotlight');
      spotlight.width = '400px';
      spotlight.height = '80px';
      spotlight.background = 'rgba(255,255,255,0.04)';
      spotlight.thickness = 0;
      spotlight.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      spotlight.top = '60px';
      spotlight.isHitTestVisible = false;
      panel.addControl(spotlight);

      // (tool icons removed — too subtle, added noise)

      // Center — selected car info display
      // (posters removed — looked distracting)

      // Car name — TOP CENTER
      this._garageCarEmoji = null; // no emoji needed — 3D car is the visual
      this._garageCarName = this._createTitle('Street Kart', 32, COLORS.text);
      this._garageCarName.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      this._garageCarName.top = '55px';
      this._garageCarName.shadowColor = COLORS.accentGlow;
      this._garageCarName.shadowBlur = 12;
      panel.addControl(this._garageCarName);

      // Default selected car (3D preview built on first show, not at init)
      this._selectedCarId = 'street-kart';

      // Stats bar — HORIZONTAL, above the car cards
      var statsBar = new GUI.StackPanel('garageStatsBar');
      statsBar.isVertical = false;
      statsBar.height = '50px';
      statsBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      statsBar.top = '-145px';
      panel.addControl(statsBar);

      this._garageStatBars = {};
      var statDefs = [
        { key: 'speed', label: 'SPEED', color: '#00d4ff' },
        { key: 'handling', label: 'HANDLING', color: COLORS.accent },
        { key: 'drift', label: 'DRIFT', color: '#00ff88' },
      ];
      statDefs.forEach((sd) => {
        // Each stat: vertical stack (label on top, bar below)
        var statCol = new GUI.StackPanel('gStatCol_' + sd.key);
        statCol.width = '140px';
        statsBar.addControl(statCol);

        // Label — centered above bar
        var lbl = this._createText(sd.label, 11, COLORS.textDim, statCol);
        lbl.paddingBottom = '3px';

        // Bar with outline
        var barBg = new GUI.Rectangle('gStatBg_' + sd.key);
        barBg.width = '120px';
        barBg.height = '18px';
        barBg.cornerRadius = 9;
        barBg.background = 'rgba(255,255,255,0.06)';
        barBg.thickness = 1.5;
        barBg.color = 'rgba(255,255,255,0.15)';
        barBg.isHitTestVisible = false;
        statCol.addControl(barBg);

        var barFill = new GUI.Rectangle('gStatFill_' + sd.key);
        barFill.width = '60%';
        barFill.height = '100%';
        barFill.cornerRadius = 9;
        barFill.background = sd.color;
        barFill.thickness = 0;
        barFill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        barBg.addControl(barFill);

        this._garageStatBars[sd.key] = barFill;

        // Spacer
        var sp = new GUI.Rectangle(); sp.width = '10px'; sp.height = '1px'; sp.thickness = 0; sp.background = 'transparent'; statsBar.addControl(sp);
      });

      // ─── Bottom: Horizontal car cards ─────────────────────────
      var bottomBar = new GUI.Rectangle('carBottomBar');
      bottomBar.width = '100%';
      bottomBar.height = '150px';
      bottomBar.background = 'rgba(13,13,26,0.8)';
      bottomBar.thickness = 0;
      bottomBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      bottomBar.top = '0px'; // flush at bottom
      panel.addControl(bottomBar);

      // Top accent line
      var barAccent = new GUI.Rectangle('carBarAccent');
      barAccent.width = '100%';
      barAccent.height = '2px';
      barAccent.background = COLORS.accent;
      barAccent.thickness = 0;
      barAccent.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      bottomBar.addControl(barAccent);

      var cardRow = new GUI.StackPanel('carCardRow');
      cardRow.isVertical = false;
      cardRow.height = '120px';
      cardRow.top = '10px';
      cardRow.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      cardRow.left = '10px';
      cardRow.width = '75%';
      bottomBar.addControl(cardRow);

      // SELECT button — right side of bottom bar
      var selectBtn = this._createButton('SELECT >', '140px', '50px');
      selectBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      selectBtn.left = '-16px';
      selectBtn.fontSize = 18;
      selectBtn.onPointerClickObservable.add(() => {
        this._fire('click');
        if (this._selectedCarId) {
          this._fire('selectCar', { carId: this._selectedCarId });
        }
      });
      bottomBar.addControl(selectBtn);

      this.carSelectCards = [];
      var carDefs = [
        { id: 'street-kart', name: 'Street Kart', speed: 6, handling: 7, drift: 6, emoji: '\ud83d\ude97' },
        { id: 'drift-racer', name: 'Drift Racer', speed: 5, handling: 8, drift: 9, emoji: '\ud83c\udfce\ufe0f' },
        { id: 'sand-runner', name: 'Sand Runner', speed: 9, handling: 5, drift: 5, emoji: '\ud83d\ude99' },
      ];

      carDefs.forEach((car, i) => {
        // Car card — vertical layout inside horizontal row
        var card = new GUI.Rectangle('car_' + i);
        card.width = '200px';
        card.height = '110px';
        card.cornerRadius = 10;
        card.background = COLORS.bgCard;
        card.thickness = 2;
        card.color = COLORS.accent;
        card.shadowColor = COLORS.accentGlow;
        card.shadowBlur = 10;
        card.paddingLeft = '8px';
        card.paddingRight = '8px';

        var inner = new GUI.StackPanel('carInner_' + i);
        inner.width = '180px';
        card.addControl(inner);

        // Car name + emoji
        var nameRow = new GUI.StackPanel('carNameRow_' + i);
        nameRow.isVertical = false;
        nameRow.height = '28px';
        nameRow.paddingTop = '6px';
        inner.addControl(nameRow);

        var emoji = this._createText(car.emoji, 18, COLORS.text, nameRow);
        emoji.width = '28px';
        var nameText = this._createText(car.name, 16, COLORS.text, nameRow);
        nameText.fontWeight = 'bold';
        nameText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        nameText.width = '140px';

        // Stat bars — compact row
        var statsRow = new GUI.StackPanel('carStats_' + i);
        statsRow.isVertical = false;
        statsRow.height = '16px';
        statsRow.paddingTop = '4px';
        inner.addControl(statsRow);

        var labels = ['SPD', 'HND', 'DFT'];
        var vals = [car.speed, car.handling, car.drift];
        var statColors = ['#00d4ff', COLORS.accent, '#00ff88'];
        labels.forEach(function(lbl, j) {
          var lblTb = new GUI.TextBlock();
          lblTb.text = lbl;
          lblTb.color = COLORS.textDim;
          lblTb.fontSize = 10;
          lblTb.fontFamily = 'monospace';
          lblTb.width = '26px';
          statsRow.addControl(lblTb);

          var barBg = new GUI.Rectangle();
          barBg.width = '36px';
          barBg.height = '6px';
          barBg.cornerRadius = 3;
          barBg.background = 'rgba(255,255,255,0.08)';
          barBg.thickness = 0;
          statsRow.addControl(barBg);

          var barFill = new GUI.Rectangle();
          barFill.width = Math.round(vals[j] / 10 * 100) + '%';
          barFill.height = '100%';
          barFill.cornerRadius = 3;
          barFill.background = statColors[j];
          barFill.thickness = 0;
          barFill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
          barBg.addControl(barFill);
        });

        // Status text (OWNED / LOCKED / UNLOCK)
        var statusText = this._createText('', 12, COLORS.gold, inner);
        statusText.paddingTop = '4px';

        // Hover
        card.onPointerEnterObservable.add(() => { card.shadowBlur = 20; card.scaleX = 1.04; card.scaleY = 1.04; });
        card.onPointerOutObservable.add(() => { card.shadowBlur = 10; card.scaleX = 1; card.scaleY = 1; });

        card.onPointerClickObservable.add(() => {
          this._fire('click');
          // Update center display
          if (this._garageCarEmoji) this._garageCarEmoji.text = car.emoji;
          if (this._garageCarName) this._garageCarName.text = car.name;
          if (this._garageStatBars) {
            if (this._garageStatBars.speed) this._garageStatBars.speed.width = (car.speed * 10) + '%';
            if (this._garageStatBars.handling) this._garageStatBars.handling.width = (car.handling * 10) + '%';
            if (this._garageStatBars.drift) this._garageStatBars.drift.width = (car.drift * 10) + '%';
          }
          // Highlight selected card
          this.carSelectCards.forEach(function(cc) {
            cc.card.thickness = cc.carId === car.id ? 3 : 1;
            cc.card.shadowBlur = cc.carId === car.id ? 20 : 8;
          });
          // 3D car preview — swap to selected car (don't advance yet)
          this._showGarageCarPreview(car.id);
          this._showGaragePreview(true);
          this._selectedCarId = car.id;
        });

        cardRow.addControl(card);
        // Spacer between cards
        if (i < carDefs.length - 1) {
          var csp = new GUI.Rectangle(); csp.width = '12px'; csp.height = '1px'; csp.thickness = 0; csp.background = 'transparent'; cardRow.addControl(csp);
        }

        this.carSelectCards.push({ card: card, nameText: nameText, statusText: statusText, carId: car.id });
      });
    }

    _showGarageCarPreview(carId) {
      try {
        var CB = window.DriftLegends.CarBuilder;
        if (!CB || !CB.buildCar) return;

        // Remove previous preview car
        if (this._garageCar) {
          this._garageCar.dispose(false, true);
          this._garageCar = null;
        }

        // Build new car at origin
        this._garageCar = CB.buildCar(this.scene, carId);
        // Use car's original PBR materials — hemi at 3.0 is bright enough
        this._garageCar.position = new BABYLON.Vector3(3, 0, 0); // offset right so it doesn't overlap left panel
        this._garageCar.scaling = new BABYLON.Vector3(1.0, 1.0, 1.0);
        this._garageCar.rotation.y = Math.PI * 0.2;

        // Create/recreate garage camera + lights (may have been disposed by _returnToMenu)
        if (!this._garageCam || this._garageCam.isDisposed()) {
          // alpha=PI → camera at (cx, y, -9) looking toward (cx, 0.3, 0)
          // Back wall at z=8 is behind the car from camera's perspective
          this._garageCam = new BABYLON.ArcRotateCamera('garageCam',
            Math.PI, Math.PI * 0.42, 9,
            new BABYLON.Vector3(3, 0.3, 0), this.scene);
          this._garageCam.lowerRadiusLimit = 10;
          this._garageCam.upperRadiusLimit = 10;
          this._garageCam.fov = 0.9;
        }
        // Recreate lights if disposed
        // ═══ GARAGE ENVIRONMENT ═══
        // Dispose old garage meshes/lights
        if (this._garageEnv) {
          this._garageEnv.forEach(function(obj) { try { obj.dispose(); } catch(_) {} });
        }
        this._garageEnv = [];
        var MB = BABYLON.MeshBuilder;
        var Color3 = BABYLON.Color3;
        var V3 = BABYLON.Vector3;
        var cx = 3; // car center x

        // ── Floor — checkerboard tile pattern ──
        var floorLight = new BABYLON.StandardMaterial('gFloorL', this.scene);
        floorLight.diffuseColor = new Color3(0.18, 0.18, 0.22);
        floorLight.specularColor = new Color3(0.3, 0.3, 0.35);
        var floorDark = new BABYLON.StandardMaterial('gFloorD', this.scene);
        floorDark.diffuseColor = new Color3(0.1, 0.1, 0.13);
        floorDark.specularColor = new Color3(0.2, 0.2, 0.25);

        var tileSize = 2;
        for (var tx = -6; tx < 6; tx++) {
          for (var tz = -4; tz < 4; tz++) {
            var tile = MB.CreateBox('gTile', { width: tileSize - 0.05, height: 0.05, depth: tileSize - 0.05 }, this.scene);
            tile.position = new V3(cx + tx * tileSize + tileSize / 2, -0.5, tz * tileSize + tileSize / 2);
            tile.material = (tx + tz) % 2 === 0 ? floorLight : floorDark;
            this._garageEnv.push(tile);
          }
        }

        // ── Back wall — lighter, with details ──
        var backWall = MB.CreateBox('gBackWall', { width: 24, height: 8, depth: 0.3 }, this.scene);
        backWall.position = new V3(cx, 3.5, 8);
        var wallMat = new BABYLON.StandardMaterial('gWallMat', this.scene);
        wallMat.diffuseColor = new Color3(0.18, 0.18, 0.22);
        backWall.material = wallMat;
        this._garageEnv.push(backWall);

        // Back wall horizontal stripe (dark accent)
        var wallStripe = MB.CreateBox('gWallStripe', { width: 24, height: 0.4, depth: 0.1 }, this.scene);
        wallStripe.position = new V3(cx, 1.5, 7.85);
        var stripeDark = new BABYLON.StandardMaterial('gStripeDark', this.scene);
        stripeDark.diffuseColor = new Color3(0.08, 0.08, 0.1);
        wallStripe.material = stripeDark;
        this._garageEnv.push(wallStripe);

        // (wall light removed — hemi handles ambient)

        // Pegboard section on back wall (right of sign)
        var pegboard = MB.CreateBox('gPegboard', { width: 4, height: 3, depth: 0.1 }, this.scene);
        pegboard.position = new V3(cx + 7, 3, 7.85);
        var pegMat = new BABYLON.StandardMaterial('gPegMat', this.scene);
        pegMat.diffuseColor = new Color3(0.25, 0.22, 0.18);
        pegboard.material = pegMat;
        this._garageEnv.push(pegboard);

        // Small tools on pegboard (simple boxes)
        [[6, 3.5], [6.5, 4], [7.5, 3.2], [8, 3.8]].forEach(function(pos, i) {
          var tool = MB.CreateBox('gTool_' + i, { width: 0.1, height: 0.8, depth: 0.05 }, this.scene);
          tool.position = new V3(cx + pos[0], pos[1], 7.8);
          tool.rotation.z = (Math.random() - 0.5) * 0.3;
          var toolMat = new BABYLON.StandardMaterial('gToolMat_' + i, this.scene);
          toolMat.diffuseColor = new Color3(0.4, 0.4, 0.45);
          tool.material = toolMat;
          this._garageEnv.push(tool);
        }.bind(this));

        // ── Side walls ──
        [-12, 12].forEach(function(x) {
          var sideWall = MB.CreateBox('gSideWall', { width: 0.3, height: 8, depth: 16 }, this.scene);
          sideWall.position = new V3(cx + x, 3.5, 0);
          sideWall.material = wallMat;
          this._garageEnv.push(sideWall);
        }.bind(this));

        // ── Ceiling ──
        var ceiling = MB.CreateBox('gCeiling', { width: 24, height: 0.2, depth: 16 }, this.scene);
        ceiling.position = new V3(cx, 7.5, 0);
        ceiling.material = wallMat;
        this._garageEnv.push(ceiling);

        // ── Large softbox light panel (covers entire floor) ──
        var softbox = MB.CreateBox('gSoftbox', { width: 18, height: 0.05, depth: 12 }, this.scene);
        softbox.position = new V3(cx, 7.4, 0);
        var softboxMat = new BABYLON.StandardMaterial('gSoftboxMat', this.scene);
        softboxMat.emissiveColor = new Color3(0.8, 0.8, 0.9);
        softboxMat.diffuseColor = Color3.Black();
        softboxMat.disableLighting = true;
        softboxMat.alpha = 0.3;
        softbox.material = softboxMat;
        this._garageEnv.push(softbox);

        // ── SOFT-ONLY LIGHTING (no spots, no arcs) ──

        // Main ambient — fills room evenly from above
        var hemi = new BABYLON.HemisphericLight('gHemi', new V3(0, 1, 0), this.scene);
        hemi.intensity = 3.0;
        hemi.diffuse = new Color3(0.9, 0.9, 1.0);
        hemi.groundColor = new Color3(0.25, 0.25, 0.3);
        this._garageEnv.push(hemi);
        this._garageHemi = hemi;

        // Sign glow — warm orange accent
        var signGlowLight = new BABYLON.PointLight('gSignGlow2', new V3(9, 2, 0.5), this.scene);
        signGlowLight.diffuse = new Color3(1, 0.4, 0.1);
        signGlowLight.intensity = 2;
        signGlowLight.range = 6;
        this._garageEnv.push(signGlowLight);

        // ── Neon "GARAGE" sign on back wall (using GUI 3D texture) ──
        var signPlane = MB.CreatePlane('gSign', { width: 5, height: 1.2 }, this.scene);
        signPlane.position = new V3(10.01, 2.0, 0.119);
        signPlane.rotation.x = 38 * Math.PI / 180;
        signPlane.rotation.y = 90 * Math.PI / 180;
        signPlane.rotation.z = 0;
        var signMat = new BABYLON.StandardMaterial('gSignMat', this.scene);
        signMat.emissiveColor = new Color3(1, 0.3, 0);
        signMat.diffuseColor = Color3.Black();
        signMat.disableLighting = true;
        signMat.backFaceCulling = false;

        // Create dynamic texture for the sign text
        var signTex = new BABYLON.DynamicTexture('gSignTex', { width: 512, height: 128 }, this.scene);
        signTex.hasAlpha = true;
        var ctx2d = signTex.getContext();
        ctx2d.clearRect(0, 0, 512, 128);
        ctx2d.font = 'bold 80px monospace';
        ctx2d.fillStyle = '#ff4d00';
        ctx2d.textAlign = 'center';
        ctx2d.fillText('GARAGE', 256, 90);
        signTex.update();
        signMat.emissiveTexture = signTex;
        signMat.opacityTexture = signTex;
        signPlane.material = signMat;
        this._garageEnv.push(signPlane);

        // Glitch animation — random flicker + position jitter
        var glitchTimer = 0;
        var nextGlitch = 2 + Math.random() * 3;
        var scene = this.scene;
        scene.registerBeforeRender(function() {
          if (!signPlane || signPlane.isDisposed()) return;
          glitchTimer += scene.getEngine().getDeltaTime() * 0.001;
          if (glitchTimer > nextGlitch) {
            // Glitch! Flicker for a brief moment
            signMat.emissiveColor = new BABYLON.Color3(0.15, 0.03, 0);
            signPlane.position.x = 10.01 + (Math.random() - 0.5) * 0.15;
            signPlane.position.y = 2.0 + (Math.random() - 0.5) * 0.05;
            // Recover after short delay
            setTimeout(function() {
              if (signPlane && !signPlane.isDisposed()) {
                signMat.emissiveColor = new BABYLON.Color3(1, 0.3, 0);
                signPlane.position.x = 10.01;
                signPlane.position.y = 2.0;
              }
            }, 80 + Math.random() * 120);
            // Double glitch sometimes
            if (Math.random() > 0.5) {
              setTimeout(function() {
                if (signPlane && !signPlane.isDisposed()) {
                  signMat.emissiveColor = new BABYLON.Color3(0.1, 0.02, 0);
                  setTimeout(function() {
                    if (signPlane && !signPlane.isDisposed()) {
                      signMat.emissiveColor = new BABYLON.Color3(1, 0.3, 0);
                    }
                  }, 50);
                }
              }, 200);
            }
            nextGlitch = glitchTimer + 2 + Math.random() * 4;
          }
        });

        // Sign glow
        var signGlow = new BABYLON.PointLight('gSignGlow', new V3(9, 2.0, 0.1), this.scene);
        signGlow.diffuse = new Color3(1, 0.3, 0);
        signGlow.intensity = 2;
        signGlow.range = 5;
        this._garageEnv.push(signGlow);

        // ── Garage props ──
        var propMat = new BABYLON.StandardMaterial('gPropMat', this.scene);
        propMat.diffuseColor = new Color3(0.2, 0.2, 0.25);

        // Tool shelf — right wall
        var shelf = MB.CreateBox('gShelf', { width: 0.3, height: 3, depth: 4 }, this.scene);
        shelf.position = new V3(cx + 11.5, 1, 3);
        shelf.material = propMat;
        this._garageEnv.push(shelf);

        // Oil barrel — left corner
        var barrel = MB.CreateCylinder('gBarrel', { height: 1.2, diameter: 0.7, tessellation: 8 }, this.scene);
        barrel.position = new V3(cx - 10, 0.1, 6);
        var barrelMat = new BABYLON.StandardMaterial('gBarrelMat', this.scene);
        barrelMat.diffuseColor = new Color3(0.3, 0.15, 0.1);
        barrel.material = barrelMat;
        this._garageEnv.push(barrel);

        // Tire stack — back right
        [0, 0.4, 0.8].forEach(function(y) {
          var tire = MB.CreateTorus('gTire', { diameter: 0.8, thickness: 0.25, tessellation: 12 }, this.scene);
          tire.position = new V3(cx + 10, y + 0.1, 5);
          tire.rotation.x = Math.PI / 2;
          tire.material = propMat;
          this._garageEnv.push(tire);
        }.bind(this));

        // Workbench — left wall
        var bench = MB.CreateBox('gBench', { width: 0.3, height: 1, depth: 3 }, this.scene);
        bench.position = new V3(cx - 11.5, 0, -2);
        bench.material = propMat;
        this._garageEnv.push(bench);
        var benchTop = MB.CreateBox('gBenchTop', { width: 1.2, height: 0.1, depth: 3 }, this.scene);
        benchTop.position = new V3(cx - 11, 0.5, -2);
        benchTop.material = propMat;
        this._garageEnv.push(benchTop);

        // (hemi already created above in 3-light setup)
      } catch (_) {}
    }

    _showGaragePreview(visible) {
      if (this._garageCar) this._garageCar.isVisible = !!visible;
      if (visible && this._garageCam) {
        this._savedCamForGarage = this.scene.activeCamera;
        this.scene.activeCamera = this._garageCam;
        // Dark background for garage
        this.scene.clearColor = new BABYLON.Color4(0.03, 0.03, 0.06, 1);
      } else if (!visible) {
        if (this._savedCamForGarage) this.scene.activeCamera = this._savedCamForGarage;
        if (this._garageCar) { this._garageCar.dispose(false, true); this._garageCar = null; }
        if (this._garageEnv) {
          this._garageEnv.forEach(function(obj) { try { obj.dispose(); } catch(_) {} });
          this._garageEnv = null;
        }
        // Restore transparent bg for menu
        this.scene.clearColor = new BABYLON.Color4(0, 0, 0, 0);
      }
      if (this._garageEnv) {
        this._garageEnv.forEach(function(obj) {
          if (obj && !obj.isDisposed()) {
            if (obj.setEnabled) obj.setEnabled(!!visible);
            if (obj.isVisible !== undefined) obj.isVisible = !!visible;
          }
        });
      }
    }

    updateCarSelectCards(progress) {
      const SM = window.DriftLegends.StoryMode;
      this.carSelectCards.forEach(cc => {
        const status = SM.isCarUnlockable(progress, cc.carId);
        if (status === 'owned') {
          cc.statusText.text = 'OWNED';
          cc.statusText.color = COLORS.green;
          cc.card.alpha = 1;
          cc.card.isEnabled = true;
        } else if (status === 'available') {
          const cost = cc.carId === 'drift-racer' ? 200 : 300;
          cc.statusText.text = 'UNLOCK (' + cost + ' coins)';
          cc.statusText.color = COLORS.gold;
          cc.card.alpha = 1;
          cc.card.isEnabled = true;
        } else {
          cc.statusText.text = 'LOCKED';
          cc.statusText.color = COLORS.red;
          cc.card.alpha = 0.4;
          cc.card.isEnabled = false;
        }
      });
    }

    // ─── Pre-Race ─────────────────────────────────────────────────
    _buildPreRace() {
      const panel = this._createPanel('PRE_RACE');
      this._addBackButton(panel, 'CAR_SELECT');

      // Centered content stack
      var center = new GUI.StackPanel('preCenter');
      center.width = '500px';
      center.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      center.top = '-20px';
      panel.addControl(center);

      // Environment emoji — big
      this.preRaceEnvEmoji = this._createText('', 48, COLORS.text, center);
      this.preRaceEnvEmoji.paddingBottom = '4px';

      // Track name — large, dramatic
      this.preRaceTrackName = new GUI.TextBlock('preTrack', '');
      this.preRaceTrackName.fontSize = 40;
      this.preRaceTrackName.fontFamily = 'monospace';
      this.preRaceTrackName.fontWeight = 'bold';
      this.preRaceTrackName.color = COLORS.text;
      this.preRaceTrackName.shadowColor = COLORS.accentGlow;
      this.preRaceTrackName.shadowBlur = 16;
      this.preRaceTrackName.resizeToFit = true;
      this.preRaceTrackName.height = '52px';
      this.preRaceTrackName.paddingBottom = '6px';
      center.addControl(this.preRaceTrackName);

      // Info row: laps + environment
      this.preRaceInfo = this._createText('3 LAPS', 13, COLORS.textDim, center);
      this.preRaceInfo.paddingBottom = '12px';

      // Divider
      var div = new GUI.Rectangle('prDiv');
      div.width = '60px'; div.height = '2px';
      div.background = COLORS.accent; div.thickness = 0;
      div.paddingBottom = '12px';
      center.addControl(div);

      // Rival line — "VS BLAZE"
      this.preRaceRivalName = new GUI.TextBlock('preRival', '');
      this.preRaceRivalName.fontSize = 22;
      this.preRaceRivalName.fontFamily = 'monospace';
      this.preRaceRivalName.fontWeight = 'bold';
      this.preRaceRivalName.color = COLORS.accent;
      this.preRaceRivalName.shadowColor = COLORS.accentGlow;
      this.preRaceRivalName.shadowBlur = 12;
      this.preRaceRivalName.resizeToFit = true;
      this.preRaceRivalName.height = '30px';
      this.preRaceRivalName.paddingBottom = '6px';
      center.addControl(this.preRaceRivalName);

      // Rival quote
      this.preRaceRivalLine = new GUI.TextBlock('preRivalLine', '');
      this.preRaceRivalLine.fontSize = 14;
      this.preRaceRivalLine.fontFamily = 'monospace';
      this.preRaceRivalLine.color = COLORS.textDim;
      this.preRaceRivalLine.textWrapping = GUI.TextWrapping.WordWrap;
      this.preRaceRivalLine.width = '400px';
      this.preRaceRivalLine.height = '40px';
      center.addControl(this.preRaceRivalLine);

      // RACE! button — part of center stack, not at bottom edge
      // Race goals list
      this.preRaceGoals = this._createText('', 13, COLORS.textDim, center);
      this.preRaceGoals.textWrapping = GUI.TextWrapping.WordWrap;
      this.preRaceGoals.width = '400px';
      this.preRaceGoals.height = '50px';
      this.preRaceGoals.paddingTop = '8px';

      var raceBtn = this._createButton('RACE!', '260px', '58px', center);
      raceBtn.paddingTop = '16px';
      raceBtn.fontSize = 24;
      raceBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('startRace'); });

      // Screen title
      this._addScreenTitle(panel, 'RACE BRIEFING');
    }

    showPreRace(trackName, rivalName, rivalLine, goals) {
      this.preRaceTrackName.text = trackName || '';
      this.preRaceRivalName.text = rivalName ? rivalName.toUpperCase() : '';
      this.preRaceRivalLine.text = rivalLine ? '\u201c' + rivalLine + '\u201d' : '';

      // Determine environment emoji from track name
      var envEmojis = { 'city': '\ud83c\udfd9\ufe0f', 'neon': '\ud83c\udfd9\ufe0f', 'blaze': '\ud83d\udd25',
        'mesa': '\ud83c\udfdc\ufe0f', 'canyon': '\ud83c\udfdc\ufe0f', 'sandstorm': '\ud83c\udfdc\ufe0f',
        'frost': '\u2744\ufe0f', 'glacier': '\u2744\ufe0f',
        'vine': '\ud83c\udf34', 'canopy': '\ud83c\udf34', 'viper': '\ud83c\udf34',
        'cloud': '\u2601\ufe0f', 'grand': '\u2601\ufe0f', 'apex': '\ud83c\udfc6' };
      var emoji = '\ud83c\udfc1';
      var tn = (trackName || '').toLowerCase();
      Object.keys(envEmojis).forEach(function(k) { if (tn.indexOf(k) >= 0) emoji = envEmojis[k]; });
      if (this.preRaceEnvEmoji) this.preRaceEnvEmoji.text = emoji;

      // Difficulty
      if (this.preRaceDifficulty) {
        var diff = '\u2b50\u2b50\u2b50'; // default 3 stars difficulty
        this.preRaceDifficulty.text = 'Difficulty: ' + diff;
      }

      // Display race goals
      if (this.preRaceGoals && goals && goals.length) {
        var goalsStr = 'RACE GOALS:\n';
        goals.forEach(function(g) { goalsStr += '-' + g.label + '\n'; });
        this.preRaceGoals.text = goalsStr;
        this.preRaceGoals.color = COLORS.accent;
      } else if (this.preRaceGoals) {
        this.preRaceGoals.text = '';
      }

      this.show('PRE_RACE');
    }

    // ─── Countdown ────────────────────────────────────────────────
    _buildCountdown() {
      const panel = this._createPanel('COUNTDOWN');
      panel.background = 'transparent';
      this.countdownText = new GUI.TextBlock('countdownNum', '3');
      this.countdownText.color = COLORS.accent;
      this.countdownText.fontSize = 100;
      this.countdownText.fontFamily = 'monospace';
      this.countdownText.fontWeight = 'bold';
      this.countdownText.shadowColor = COLORS.accentGlow;
      this.countdownText.shadowBlur = 30;
      this.countdownText.shadowOffsetY = 4;
      panel.addControl(this.countdownText);
    }

    showCountdown(number) {
      this.countdownText.text = number === 0 ? 'GO!' : String(number);
      this.countdownText.color = number === 0 ? COLORS.green : COLORS.accent;
      this.countdownText.fontSize = number === 0 ? 120 : 100;
      this.countdownText.shadowColor = number === 0 ? 'rgba(0,255,136,0.4)' : COLORS.accentGlow;
      this.show('COUNTDOWN');
    }

    // ─── Track Intro Overlay (shown during cinematic camera sweep) ──
    showTrackIntro(trackId, chapterName, goals) {
      if (!this._trackIntroPanel) {
        var panel = new GUI.Rectangle('TRACK_INTRO');
        panel.width = '100%';
        panel.height = '100%';
        panel.thickness = 0;
        panel.background = 'transparent';
        this.ui.addControl(panel);
        this._trackIntroPanel = panel;

        // Track name (big, bottom-center)
        this._introTrackName = new GUI.TextBlock('introTrack', '');
        this._introTrackName.fontSize = 36;
        this._introTrackName.fontFamily = 'monospace';
        this._introTrackName.fontWeight = 'bold';
        this._introTrackName.color = COLORS.text;
        this._introTrackName.shadowColor = 'rgba(0,0,0,0.6)';
        this._introTrackName.shadowBlur = 12;
        this._introTrackName.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this._introTrackName.top = '-120px';
        panel.addControl(this._introTrackName);

        // Chapter name (smaller, above track name)
        this._introChapterName = new GUI.TextBlock('introChapter', '');
        this._introChapterName.fontSize = 16;
        this._introChapterName.fontFamily = 'monospace';
        this._introChapterName.color = COLORS.accent;
        this._introChapterName.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        this._introChapterName.top = '-160px';
        panel.addControl(this._introChapterName);

        // "GET READY" text (top center, pulsing)
        this._introGetReady = new GUI.TextBlock('introReady', 'GET READY');
        this._introGetReady.fontSize = 24;
        this._introGetReady.fontFamily = 'monospace';
        this._introGetReady.fontWeight = 'bold';
        this._introGetReady.color = COLORS.accent;
        this._introGetReady.shadowColor = COLORS.accentGlow;
        this._introGetReady.shadowBlur = 15;
        this._introGetReady.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        this._introGetReady.top = '80px';
        panel.addControl(this._introGetReady);

        // Subtle cinematic bars (top and bottom black strips)
        var topBar = new GUI.Rectangle('cinBar1');
        topBar.width = '100%';
        topBar.height = '50px';
        topBar.background = 'rgba(0,0,0,0.7)';
        topBar.thickness = 0;
        topBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
        topBar.top = '0px'; // below header
        panel.addControl(topBar);

        var botBar = new GUI.Rectangle('cinBar2');
        botBar.width = '100%';
        botBar.height = '60px';
        botBar.background = 'rgba(0,0,0,0.75)';
        botBar.thickness = 0;
        botBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
        panel.addControl(botBar);

        // Race goals inside bottom cinematic bar
        var goalsLabel = new GUI.TextBlock('cinGoalsLabel', 'RACE GOALS');
        goalsLabel.fontSize = 11;
        goalsLabel.fontFamily = 'monospace';
        goalsLabel.fontWeight = 'bold';
        goalsLabel.color = COLORS.accent;
        goalsLabel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        goalsLabel.left = '20px';
        goalsLabel.top = '-12px';
        botBar.addControl(goalsLabel);

        this._introGoalsText = new GUI.TextBlock('cinGoalsText', '');
        this._introGoalsText.fontSize = 13;
        this._introGoalsText.fontFamily = 'monospace';
        this._introGoalsText.color = COLORS.text;
        this._introGoalsText.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
        this._introGoalsText.left = '20px';
        this._introGoalsText.top = '8px';
        botBar.addControl(this._introGoalsText);
      }

      // Find track name from TRACKS data
      var trackName = trackId;
      try {
        var trackDef = window.DriftLegends.TrackBuilder.TRACKS[trackId];
        if (trackDef) trackName = trackDef.name;
      } catch(_) {}

      this._introTrackName.text = trackName;
      this._introChapterName.text = chapterName || '';

      // Show goals in cinematic bar
      if (this._introGoalsText && goals && goals.length) {
        this._introGoalsText.text = goals.map(function(g) { return '> ' + g.label; }).join('   ');
      } else if (this._introGoalsText) {
        this._introGoalsText.text = '';
      }

      this._trackIntroPanel.isVisible = true;
    }

    hideTrackIntro() {
      if (this._trackIntroPanel) this._trackIntroPanel.isVisible = false;
    }

    // ─── Race HUD ─────────────────────────────────────────────────
    _buildRaceHUD() {
      const panel = this._createPanel('RACE_HUD');
      panel.background = 'transparent';

      // ─── Top-right: Position indicator ───────────────────────────
      var posBox = new GUI.Rectangle('posBox');
      posBox.width = '90px';
      posBox.height = '50px';
      posBox.cornerRadius = 8;
      posBox.background = 'rgba(13,13,26,0.7)';
      posBox.thickness = 1;
      posBox.color = 'rgba(255,255,255,0.1)';
      posBox.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      posBox.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      posBox.left = '-16px';
      posBox.top = '10px';
      panel.addControl(posBox);

      this.hud.position = new GUI.TextBlock('hudPos', '1ST');
      this.hud.position.color = COLORS.gold;
      this.hud.position.fontSize = 28;
      this.hud.position.fontFamily = 'monospace';
      this.hud.position.fontWeight = 'bold';
      posBox.addControl(this.hud.position);

      // ─── Bottom Bar ──────────────────────────────────────────────
      var bottomBar = new GUI.Rectangle('bottomBar');
      bottomBar.width = '100%';
      bottomBar.height = '48px';
      bottomBar.background = 'rgba(13,13,26,0.75)';
      bottomBar.thickness = 0;
      bottomBar.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      panel.addControl(bottomBar);

      var barAccent = new GUI.Rectangle('barAccent');
      barAccent.width = '100%';
      barAccent.height = '2px';
      barAccent.background = COLORS.accent;
      barAccent.thickness = 0;
      barAccent.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      bottomBar.addControl(barAccent);

      // Left: Drift meter
      this.hud.driftLabel = new GUI.TextBlock('driftLabel', 'DRIFT');
      this.hud.driftLabel.color = COLORS.textDim;
      this.hud.driftLabel.fontSize = 10;
      this.hud.driftLabel.fontFamily = 'monospace';
      this.hud.driftLabel.fontWeight = 'bold';
      this.hud.driftLabel.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.hud.driftLabel.left = '16px';
      this.hud.driftLabel.top = '-10px';
      this.hud.driftLabel.width = '50px';
      bottomBar.addControl(this.hud.driftLabel);

      var driftContainer = new GUI.Rectangle('driftContainer');
      driftContainer.width = '120px';
      driftContainer.height = '10px';
      driftContainer.cornerRadius = 5;
      driftContainer.background = 'rgba(255,255,255,0.1)';
      driftContainer.thickness = 0;
      driftContainer.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      driftContainer.left = '16px';
      driftContainer.top = '8px';
      bottomBar.addControl(driftContainer);

      this.hud.driftFill = new GUI.Rectangle('driftFill');
      this.hud.driftFill.width = '0%';
      this.hud.driftFill.height = '100%';
      this.hud.driftFill.background = COLORS.accent;
      this.hud.driftFill.thickness = 0;
      this.hud.driftFill.cornerRadius = 5;
      this.hud.driftFill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      driftContainer.addControl(this.hud.driftFill);

      // Drift score — above the bottom bar, left-aligned
      this.hud.driftScore = new GUI.TextBlock('hudDriftScore', '');
      this.hud.driftScore.color = COLORS.accent;
      this.hud.driftScore.fontSize = 14;
      this.hud.driftScore.fontFamily = 'monospace';
      this.hud.driftScore.fontWeight = 'bold';
      this.hud.driftScore.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.hud.driftScore.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      this.hud.driftScore.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      this.hud.driftScore.left = '16px';
      this.hud.driftScore.top = '-56px';
      this.hud.driftScore.width = '160px';
      this.hud.driftScore.isVisible = false;
      this.hud.driftScore.isHitTestVisible = false;
      panel.addControl(this.hud.driftScore);

      // Center: Lap
      this.hud.lap = new GUI.TextBlock('hudLap', 'LAP 1/3');
      this.hud.lap.color = COLORS.text;
      this.hud.lap.fontSize = 16;
      this.hud.lap.fontFamily = 'monospace';
      this.hud.lap.fontWeight = 'bold';
      bottomBar.addControl(this.hud.lap);

      // Right: Speed
      this.hud.speed = new GUI.TextBlock('hudSpeed', '0');
      this.hud.speed.color = COLORS.text;
      this.hud.speed.fontSize = 26;
      this.hud.speed.fontFamily = 'monospace';
      this.hud.speed.fontWeight = 'bold';
      this.hud.speed.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.hud.speed.left = '-50px';
      this.hud.speed.width = '80px';
      bottomBar.addControl(this.hud.speed);
      this.hud.speed.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.hud.speed.left = '-60px';
      this.hud.speed.width = '100px';
      bottomBar.addControl(this.hud.speed);

      // KM/H label (smaller, next to speed)
      var speedUnit = new GUI.TextBlock('speedUnit', 'KM/H');
      speedUnit.color = COLORS.textDim;
      speedUnit.fontSize = 11;
      speedUnit.fontFamily = 'monospace';
      speedUnit.fontWeight = 'bold';
      speedUnit.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      speedUnit.left = '-20px';
      speedUnit.top = '4px';
      speedUnit.width = '40px';
      bottomBar.addControl(speedUnit);

      // ─── Top overlays ────────────────────────────────────────────

      // Pause button (top-left) — for mobile/touch
      var pauseBtn = GUI.Button.CreateSimpleButton('pauseBtn', '||');
      pauseBtn.width = '44px';
      pauseBtn.height = '44px';
      pauseBtn.color = COLORS.text;
      pauseBtn.background = 'rgba(13,13,26,0.5)';
      pauseBtn.cornerRadius = 8;
      pauseBtn.thickness = 1;
      pauseBtn.fontSize = 18;
      pauseBtn.fontFamily = 'monospace';
      pauseBtn.fontWeight = 'bold';
      pauseBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      pauseBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      pauseBtn.left = '16px';
      pauseBtn.top = '10px';
      pauseBtn.onPointerClickObservable.add(() => {
        this._fire('pauseClick');
      });
      panel.addControl(pauseBtn);

      // Race goal reminder (top-center, small)
      this.hud.goalReminder = new GUI.TextBlock('hudGoal', '');
      this.hud.goalReminder.fontSize = 12;
      this.hud.goalReminder.fontFamily = 'monospace';
      this.hud.goalReminder.color = 'rgba(255,200,100,0.6)';
      this.hud.goalReminder.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      this.hud.goalReminder.top = '10px';
      this.hud.goalReminder.isHitTestVisible = false;
      panel.addControl(this.hud.goalReminder);

      // Race time (top-right, subtle)
      this.hud.time = new GUI.TextBlock('hudTime', '0:00');
      this.hud.time.color = 'rgba(255,255,255,0.5)';
      this.hud.time.fontSize = 16;
      this.hud.time.fontFamily = 'monospace';
      this.hud.time.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      this.hud.time.textVerticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      this.hud.time.left = '-20px';
      this.hud.time.top = '70px';
      panel.addControl(this.hud.time);

      // Wrong way indicator (center, hidden by default)
      this.hud.wrongWay = this._createText('WRONG WAY!', 30, COLORS.red, panel);
      this.hud.wrongWay.isVisible = false;

      // Boost indicator (center, flash on boost)
      this.hud.boostText = new GUI.TextBlock('boostText', 'BOOST!');
      this.hud.boostText.color = COLORS.accent;
      this.hud.boostText.fontSize = 28;
      this.hud.boostText.fontFamily = 'monospace';
      this.hud.boostText.fontWeight = 'bold';
      this.hud.boostText.isVisible = false;
      this.hud.boostText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      this.hud.boostText.top = '-60px';
      this.hud.boostText.shadowColor = COLORS.accentGlow;
      this.hud.boostText.shadowBlur = 20;
      panel.addControl(this.hud.boostText);
    }

    updateHUD(data) {
      if (!data) return;
      // Position
      const posColors = { 1: COLORS.gold, 2: COLORS.silver, 3: COLORS.bronze, 4: COLORS.text };
      const posSuffix = { 1: 'ST', 2: 'ND', 3: 'RD', 4: 'TH' };
      this.hud.position.text = data.position + (posSuffix[data.position] || 'TH');
      this.hud.position.color = posColors[data.position] || COLORS.text;

      // Lap
      this.hud.lap.text = 'LAP ' + data.lap + '/' + data.totalLaps;

      // Speed (number only — unit label is separate)
      this.hud.speed.text = '' + data.speed;

      // Drift meter
      const pct = Math.round(data.driftMeter * 100);
      this.hud.driftFill.width = pct + '%';
      if (pct < 33) {
        this.hud.driftFill.background = COLORS.textDim;
      } else if (pct < 66) {
        this.hud.driftFill.background = COLORS.accent;
      } else {
        this.hud.driftFill.background = '#00aaff';
      }

      // Drift score with combo multiplier
      if (this.hud.driftScore) {
        if (data.isDrifting && data.driftScoreActive > 0) {
          var comboText = data.driftCombo > 1 ? ' x' + data.driftCombo : '';
          this.hud.driftScore.text = '+' + data.driftScoreActive + comboText;
          this.hud.driftScore.color = data.driftCombo >= 3 ? COLORS.gold : COLORS.accent;
          this.hud.driftScore.fontSize = data.driftCombo >= 3 ? 18 : 14;
          this.hud.driftScore.isVisible = true;
        } else if (data.driftScoreTotal > 0) {
          this.hud.driftScore.text = 'DRIFT: ' + data.driftScoreTotal;
          this.hud.driftScore.color = COLORS.textDim;
          this.hud.driftScore.fontSize = 14;
          this.hud.driftScore.isVisible = true;
        } else {
          this.hud.driftScore.isVisible = false;
        }
      }

      // Boost
      this.hud.boostText.isVisible = !!data.isBoosting;

      // Time
      if (data.raceTime !== undefined) {
        const totalSec = Math.floor(data.raceTime);
        const min = Math.floor(totalSec / 60);
        const sec = totalSec % 60;
        this.hud.time.text = min + ':' + String(sec).padStart(2, '0');
      }
    }

    // ─── Race Result ──────────────────────────────────────────────
    _buildRaceResult() {
      const panel = this._createPanel('RACE_RESULT');
      panel.background = 'rgba(8,8,20,0.9)';
      panel.isPointerBlocker = true;
      panel.zIndex = 50;

      // Single centered column — no cramped card
      var col = new GUI.StackPanel('resCol');
      col.width = '90%';
      col.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      col.top = '-20px';
      col.isHitTestVisible = false;
      panel.addControl(col);

      // Title
      this.resultTitle = this._createTitle('', 36, COLORS.gold, col);
      this.resultTitle.shadowColor = 'rgba(255,215,0,0.5)';
      this.resultTitle.shadowBlur = 20;
      this.resultTitle.paddingBottom = '4px';

      // Stars
      this.resultStars = this._createText('', 26, COLORS.gold, col);
      this.resultStars.paddingBottom = '8px';

      // Position
      this.resultPosition = this._createText('', 20, COLORS.text, col);
      this.resultPosition.paddingBottom = '6px';

      // Stats — vertical, each on own line
      this.resultScore = this._createText('', 13, COLORS.textDim, col);
      this.resultScore.paddingBottom = '2px';
      this.resultCoins = this._createText('', 15, COLORS.gold, col);
      this.resultCoins.paddingBottom = '2px';
      this.resultTime = this._createText('', 13, COLORS.textDim, col);
      this.resultTime.paddingBottom = '6px';

      // Divider
      var div = new GUI.Rectangle('resDiv');
      div.width = '80px'; div.height = '2px';
      div.background = COLORS.accent; div.thickness = 0;
      div.isHitTestVisible = false;
      div.paddingBottom = '8px';
      col.addControl(div);

      // Goals — full width, each on its own line
      this.resultUnlock = new GUI.TextBlock('resUnlock', '');
      this.resultUnlock.fontSize = 14;
      this.resultUnlock.fontFamily = 'monospace';
      this.resultUnlock.fontWeight = 'bold';
      this.resultUnlock.color = COLORS.green;
      this.resultUnlock.textWrapping = GUI.TextWrapping.WordWrap;
      this.resultUnlock.width = '90%';
      this.resultUnlock.height = '80px';
      this.resultUnlock.isHitTestVisible = false;
      col.addControl(this.resultUnlock);

      // Buttons on UI root — guaranteed clickable
      this._resultNextBtn = this._createButton('NEXT RACE', '160px', '48px');
      this._resultNextBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      this._resultNextBtn.top = '-20px';
      this._resultNextBtn.left = '-140px';
      this._resultNextBtn.isVisible = false;
      this._resultNextBtn.zIndex = 60;
      this._resultNextBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('resultNext'); });
      this.ui.addControl(this._resultNextBtn);

      this._resultRetryBtn = this._createSecondaryButton('RETRY', '130px', '48px');
      this._resultRetryBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      this._resultRetryBtn.top = '-20px';
      this._resultRetryBtn.left = '10px';
      this._resultRetryBtn.isVisible = false;
      this._resultRetryBtn.zIndex = 60;
      this._resultRetryBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('resultRetry'); });
      this.ui.addControl(this._resultRetryBtn);

      this._resultMenuBtn = this._createSecondaryButton('MENU', '110px', '48px');
      this._resultMenuBtn.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      this._resultMenuBtn.top = '-20px';
      this._resultMenuBtn.left = '160px';
      this._resultMenuBtn.isVisible = false;
      this._resultMenuBtn.zIndex = 60;
      this._resultMenuBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('resultMenu'); });
      this.ui.addControl(this._resultMenuBtn);
    }

    showRaceResult(data) {
      const won = data.position === 1;
      this.resultTitle.text = won ? '\ud83c\udfc6 VICTORY!' : 'RACE COMPLETE';
      this.resultTitle.color = won ? COLORS.gold : COLORS.text;
      this.resultTitle.shadowColor = won ? 'rgba(255,215,0,0.5)' : 'rgba(255,255,255,0.2)';
      this.resultPosition.text = data.position + this._ordSuffix(data.position) + ' Place';
      this.resultPosition.color = won ? COLORS.gold : COLORS.text;
      // Stars
      this.resultStars.text = '\u2b50'.repeat(data.stars) + '\u2606'.repeat(3 - data.stars);
      this.resultStars.color = data.stars >= 2 ? COLORS.gold : COLORS.textDim;
      this.resultStars.fontSize = data.stars === 3 ? 32 : 26;
      // Stats — each on separate line
      this.resultScore.text = 'Score: ' + data.raceScore + (data.driftScore ? '   Drift: ' + data.driftScore : '');
      this.resultCoins.text = '+' + data.coins + ' coins';
      if (data.totalTimeMs) {
        var sec = (data.totalTimeMs / 1000).toFixed(1);
        this.resultTime.text = 'Time: ' + sec + 's';
      } else {
        this.resultTime.text = '';
      }
      // Show goal results — dynamically size card to fit
      if (data.goalResults && data.goalResults.length) {
        var goalStr = '';
        data.goalResults.forEach(function(g) {
          goalStr += (g.passed ? '\u2705' : '\u274c') + g.label + '\n';
        });
        if (data.allGoalsPassed && data.unlockText) {
          goalStr += '\n' + data.unlockText;
        } else if (!data.allGoalsPassed) {
          goalStr += '\nComplete all goals\nto advance!';
        }
        this.resultUnlock.text = goalStr;
        this.resultUnlock.color = data.allGoalsPassed ? COLORS.green : COLORS.accent;
        // Dynamic height: 20px per goal line + 50px for advance text
        var goalLines = data.goalResults.length + (data.allGoalsPassed ? 0 : 2);
        this.resultUnlock.height = (goalLines * 20 + 30) + 'px';
      } else if (data.unlockText) {
        this.resultUnlock.text = data.unlockText;
        this.resultUnlock.color = COLORS.green;
      } else {
        this.resultUnlock.text = '';
      }
      // Show buttons (they're on ui root, not inside panel)
      if (this._resultRetryBtn) this._resultRetryBtn.isVisible = true;
      if (this._resultMenuBtn) this._resultMenuBtn.isVisible = true;
      if (this._resultNextBtn) {
        this._resultNextBtn.isVisible = !!(data.allGoalsPassed);
      }
      // Reposition based on which buttons are visible
      if (this._resultRetryBtn && this._resultMenuBtn) {
        if (data.allGoalsPassed) {
          this._resultRetryBtn.left = '10px';
          this._resultMenuBtn.left = '150px';
        } else {
          this._resultRetryBtn.left = '-70px';
          this._resultMenuBtn.left = '70px';
        }
      }

      this.show('RACE_RESULT');
    }

    _ordSuffix(n) {
      return { 1: 'st', 2: 'nd', 3: 'rd' }[n] || 'th';
    }

    // ─── Multiplayer Menu ─────────────────────────────────────────
    _buildMPMenu() {
      const panel = this._createPanel('MP_MENU');

      // Header
      this._addScreenTitle(panel, 'MULTIPLAYER');

      // Buttons — horizontal row, center
      var btnRow = new GUI.StackPanel('mpBtnRow');
      btnRow.isVertical = false;
      btnRow.height = '60px';
      panel.addControl(btnRow);

      const quickBtn = this._createButton('QUICK MATCH', '220px', '54px', btnRow);
      quickBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('mpQuickMatch'); });

      var sp1 = new GUI.Rectangle(); sp1.width = '16px'; sp1.height = '1px'; sp1.thickness = 0; sp1.background = 'transparent'; btnRow.addControl(sp1);

      const privateBtn = this._createSecondaryButton('CREATE ROOM', '200px', '54px', btnRow);
      privateBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('mpCreatePrivate'); });

      var sp2 = new GUI.Rectangle(); sp2.width = '16px'; sp2.height = '1px'; sp2.thickness = 0; sp2.background = 'transparent'; btnRow.addControl(sp2);

      const joinBtn = this._createSecondaryButton('JOIN CODE', '180px', '54px', btnRow);
      joinBtn.onPointerClickObservable.add(() => { this._fire('click'); this._fire('mpJoinCode'); });

      // Status text
      this.mpStatusText = this._createText('', 16, COLORS.textDim, panel);
      this.mpStatusText.top = '50px';

      this._addBackButton(panel, 'MENU');
    }

    // ─── Settings ─────────────────────────────────────────────────
    _buildSettings() {
      const panel = this._createPanel('SETTINGS');

      // Header
      this._addBackButton(panel, 'MENU');
      this._addScreenTitle(panel, 'SETTINGS');

      // Settings card — centered, contained
      var settingsCard = new GUI.Rectangle('settingsCard');
      settingsCard.width = '500px';
      settingsCard.height = '200px';
      settingsCard.cornerRadius = 12;
      settingsCard.background = 'rgba(20,20,40,0.8)';
      settingsCard.thickness = 1;
      settingsCard.color = 'rgba(255,255,255,0.1)';
      panel.addControl(settingsCard);

      var stack = new GUI.StackPanel();
      stack.width = '440px';
      settingsCard.addControl(stack);

      this._createText('AUDIO VOLUME', 14, COLORS.textDim, stack).paddingBottom = '4px';
      const slider = new GUI.Slider('volumeSlider');
      slider.minimum = 0;
      slider.maximum = 1;
      slider.value = 0.4;
      slider.width = '380px';
      slider.height = '44px';
      slider.color = COLORS.accent;
      slider.background = 'rgba(255,255,255,0.1)';
      slider.thumbWidth = 24;
      slider.paddingBottom = '16px';
      slider.onValueChangedObservable.add(val => this._fire('volumeChange', val));
      stack.addControl(slider);
      this.volumeSlider = slider;

      // Controls reference — horizontal layout
      var controlsRow = new GUI.StackPanel();
      controlsRow.isVertical = false;
      controlsRow.height = '40px';
      stack.addControl(controlsRow);

      this._createText('WASD / Arrows = Drive', 12, COLORS.textDim, controlsRow).width = '180px';
      this._createText('Space = Drift', 12, COLORS.textDim, controlsRow).width = '110px';
      this._createText('M = Mute', 12, COLORS.textDim, controlsRow).width = '80px';

    }

    // ─── Loading Screen ───────────────────────────────────────────
    _buildLoading() {
      const panel = this._createPanel('LOADING');

      // Semi-transparent — HTML SVG shows through
      panel.background = 'rgba(13,13,26,0.7)';

      // Track name — large, top area
      this.loadingTrackName = new GUI.TextBlock('loadTrack', '');
      this.loadingTrackName.fontSize = 36;
      this.loadingTrackName.fontFamily = 'monospace';
      this.loadingTrackName.fontWeight = 'bold';
      this.loadingTrackName.color = COLORS.text;
      this.loadingTrackName.shadowColor = COLORS.accentGlow;
      this.loadingTrackName.shadowBlur = 16;
      this.loadingTrackName.top = '-60px';
      panel.addControl(this.loadingTrackName);

      // Loading status text
      this.loadingText = new GUI.TextBlock('loadStatus', 'Building track...');
      this.loadingText.fontSize = 14;
      this.loadingText.fontFamily = 'monospace';
      this.loadingText.color = COLORS.textDim;
      this.loadingText.top = '-20px';
      panel.addControl(this.loadingText);

      // Loading bar (animated)
      var loadBarBg = new GUI.Rectangle('loadBarBg');
      loadBarBg.width = '300px';
      loadBarBg.height = '4px';
      loadBarBg.cornerRadius = 2;
      loadBarBg.background = 'rgba(255,255,255,0.1)';
      loadBarBg.thickness = 0;
      loadBarBg.top = '10px';
      panel.addControl(loadBarBg);

      this._loadBarFill = new GUI.Rectangle('loadBarFill');
      this._loadBarFill.width = '0%';
      this._loadBarFill.height = '100%';
      this._loadBarFill.cornerRadius = 2;
      this._loadBarFill.background = COLORS.accent;
      this._loadBarFill.thickness = 0;
      this._loadBarFill.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      loadBarBg.addControl(this._loadBarFill);

      // Tip/quote at bottom — rotates through tips
      this._loadingTip = new GUI.TextBlock('loadTip', '');
      this._loadingTip.fontSize = 13;
      this._loadingTip.fontFamily = 'monospace';
      this._loadingTip.color = COLORS.textMuted;
      this._loadingTip.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      this._loadingTip.top = '-40px';
      this._loadingTip.width = '600px';
      this._loadingTip.textWrapping = GUI.TextWrapping.WordWrap;
      panel.addControl(this._loadingTip);

      // "TIP" label
      var tipLabel = new GUI.TextBlock('tipLabel', 'TIP');
      tipLabel.fontSize = 11;
      tipLabel.fontFamily = 'monospace';
      tipLabel.fontWeight = 'bold';
      tipLabel.color = COLORS.accent;
      tipLabel.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      tipLabel.top = '-60px';
      panel.addControl(tipLabel);

      // Animate loading bar and rotate tips
      this._loadProgress = 0;
      this._tipIndex = 0;
      this._tipTimer = 0;
      this.scene.registerBeforeRender(() => {
        if (!this.screens['LOADING'] || !this.screens['LOADING'].isVisible) return;
        var dt = this.scene.getEngine().getDeltaTime() / 1000;
        // Animate loading bar (fake progress that accelerates)
        if (this._loadProgress < 90) {
          this._loadProgress += dt * 25;
          this._loadBarFill.width = Math.min(90, this._loadProgress) + '%';
        }
        // Rotate tips every 3 seconds
        this._tipTimer += dt;
        if (this._tipTimer > 3) {
          this._tipTimer = 0;
          this._tipIndex = (this._tipIndex + 1) % this._TIPS.length;
          this._loadingTip.text = this._TIPS[this._tipIndex];
        }
      });

      // Tips/quotes pool
      this._TIPS = [
        'Hold Space while turning to initiate a drift — build boost meter for a speed burst!',
        'Complete chapters to unlock new cars with unique handling stats.',
        'Clean laps (no wall hits) earn bonus points toward your star rating.',
        'Each rival has a unique personality — Blaze is aggressive, Sandstorm is technical.',
        'Drift through corners to fill your boost meter. Release at full for maximum speed!',
        'Yellow nitro pads on the track give you an instant speed boost.',
        'Earn 3 stars on every race to unlock the "Perfectionist" achievement.',
        'Play at night (10 PM - 6 AM) to unlock the "Night Racer" achievement.',
        'The Sand Runner has the highest top speed but the worst drift handling.',
        'Your best lap times are saved to the leaderboard — compete globally!',
        'Sign in to save your progress to the cloud and sync across devices.',
        'Beat all 5 chapter rivals to complete the story and unlock multiplayer tracks.',
      ];
    }

    showLoading(trackName) {
      this.loadingTrackName.text = trackName || 'Loading Track...';
      this.loadingText.text = 'Building track...';
      this._loadProgress = 0;
      this._tipIndex = Math.floor(Math.random() * this._TIPS.length);
      this._loadingTip.text = this._TIPS[this._tipIndex];
      this._tipTimer = 0;
      this.show('LOADING');
    }

    // ─── Pause Menu ──────────────────────────────────────────────
    _buildPauseMenu() {
      var panel = this._createPanel('PAUSE', true);
      panel.background = 'rgba(8,8,20,0.8)';
      panel.isPointerBlocker = true;
      panel.zIndex = 50; // above touch controls and HUD
      this.screens['PAUSE'] = panel;

      // Center card
      var card = new GUI.Rectangle('pauseCard');
      card.width = '320px';
      card.height = '280px';
      card.cornerRadius = 14;
      card.background = 'rgba(20,20,40,0.9)';
      card.thickness = 2;
      card.color = COLORS.accent;
      card.shadowColor = COLORS.accentGlow;
      card.shadowBlur = 20;
      panel.addControl(card);

      var stack = new GUI.StackPanel('pauseStack');
      stack.width = '260px';
      card.addControl(stack);

      // Title
      this._createTitle('PAUSED', 30, COLORS.text, stack).paddingTop = '20px';
      this._createText('', 1, 'transparent', stack).height = '16px'; // spacer

      // Resume
      var resumeBtn = this._createButton('RESUME', '240px', '48px', stack);
      resumeBtn.paddingBottom = '10px';
      resumeBtn.onPointerClickObservable.add(() => {
        this._fire('click');
        this._fire('pauseResume');
      });

      // Restart
      var restartBtn = this._createSecondaryButton('RESTART RACE', '240px', '44px', stack);
      restartBtn.paddingBottom = '10px';
      restartBtn.onPointerClickObservable.add(() => {
        this._fire('click');
        this._fire('pauseRestart');
      });

      // Quit to menu
      var quitBtn = this._createSecondaryButton('QUIT TO MENU', '240px', '44px', stack);
      quitBtn.onPointerClickObservable.add(() => {
        this._fire('click');
        this._fire('pauseQuit');
      });
    }

    showPause() {
      // Don't use show() — keep RACE_HUD visible underneath
      if (this.screens['PAUSE']) this.screens['PAUSE'].isVisible = true;
      // Hide touch controls so they don't intercept clicks
      if (this.touchControls) this.touchControls.isVisible = false;
    }
    hidePause() {
      if (this.screens['PAUSE']) this.screens['PAUSE'].isVisible = false;
      // Restore touch controls
      if (this.touchControls && window.DriftLegends.Input.isMobile()) this.touchControls.isVisible = true;
    }

    // ─── Tutorial Overlay ──────────────────────────────────────────
    _buildTutorialOverlay() {
      // Top banner for tutorial steps
      var banner = new GUI.Rectangle('tutBanner');
      banner.width = '100%';
      banner.height = '60px';
      banner.background = 'rgba(255,77,0,0.9)';
      banner.thickness = 0;
      banner.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      banner.top = '0px';
      banner.isVisible = false;
      banner.zIndex = 40;
      banner.isHitTestVisible = false;
      this.ui.addControl(banner);
      this._tutBanner = banner;

      // Accent stripe on left
      var stripe = new GUI.Rectangle('tutStripe');
      stripe.width = '6px';
      stripe.height = '100%';
      stripe.background = '#cc0000';
      stripe.thickness = 0;
      stripe.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      banner.addControl(stripe);

      // Step text
      this._tutText = new GUI.TextBlock('tutText', '');
      this._tutText.fontSize = 16;
      this._tutText.fontFamily = 'monospace';
      this._tutText.fontWeight = 'bold';
      this._tutText.color = '#ffffff';
      this._tutText.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      this._tutText.left = '20px';
      this._tutText.isHitTestVisible = false;
      banner.addControl(this._tutText);

      // Sub-text (hint)
      this._tutHint = new GUI.TextBlock('tutHint', '');
      this._tutHint.fontSize = 12;
      this._tutHint.fontFamily = 'monospace';
      this._tutHint.color = 'rgba(255,255,255,0.7)';
      this._tutHint.textHorizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      this._tutHint.left = '20px';
      this._tutHint.top = '12px';
      this._tutHint.isHitTestVisible = false;
      banner.addControl(this._tutHint);

      // Skip button (right side)
      var skipBtn = GUI.Button.CreateSimpleButton('tutSkip', 'SKIP >>');
      skipBtn.width = '90px';
      skipBtn.height = '34px';
      skipBtn.color = '#ffffff';
      skipBtn.background = 'rgba(0,0,0,0.3)';
      skipBtn.cornerRadius = 6;
      skipBtn.thickness = 0;
      skipBtn.fontSize = 12;
      skipBtn.fontFamily = 'monospace';
      skipBtn.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      skipBtn.left = '-16px';
      skipBtn.onPointerClickObservable.add(() => { this._fire('tutorialSkip'); });
      banner.addControl(skipBtn);
    }

    showTutorialStep(text, hint) {
      if (this._tutBanner) {
        this._tutBanner.isVisible = true;
        this._tutText.text = text || '';
        this._tutHint.text = hint || '';
      }
    }

    hideTutorial() {
      if (this._tutBanner) this._tutBanner.isVisible = false;
    }

    // ─── Disconnect Overlay ───────────────────────────────────────
    _buildDisconnect() {
      const panel = this._createPanel('DISCONNECT');
      panel.background = 'rgba(0,0,0,0.7)';
      this._createText('Reconnecting...', 24, COLORS.accent, panel);
    }

    showDisconnectOverlay() { this.show('DISCONNECT'); }
    hideDisconnectOverlay() { this.hide('DISCONNECT'); }

    // ─── Mobile Gesture Controls (Asphalt-style) ──────────────────
    // Left half: hold = accelerate, swipe left/right = steer
    // Right half: tap = boost/nitro, swipe down = brake
    // Two-finger hold anywhere = drift
    // Thin visual indicators at screen edges show steer direction
    _buildMobileTouchControls() {
      const container = new GUI.Rectangle('touchControls');
      container.width = '100%';
      container.height = '100%';
      container.thickness = 0;
      container.background = 'transparent';
      container.isVisible = false;
      container.isHitTestVisible = false; // don't block GUI buttons
      container.zIndex = 5; // below pause/result overlays (50+)
      this.ui.addControl(container);
      this.touchControls = container;

      const Input = () => window.DriftLegends.Input;

      // ── Visual indicators (subtle, Asphalt-style) ──

      // Left steer arrow indicator
      const leftIndicator = new GUI.TextBlock('steer_left_ind', '\u25C0');
      leftIndicator.fontSize = 40;
      leftIndicator.color = 'rgba(255,255,255,0.12)';
      leftIndicator.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_LEFT;
      leftIndicator.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      leftIndicator.left = '16px';
      container.addControl(leftIndicator);
      this._steerLeftInd = leftIndicator;

      // Right steer arrow indicator
      const rightIndicator = new GUI.TextBlock('steer_right_ind', '\u25B6');
      rightIndicator.fontSize = 40;
      rightIndicator.color = 'rgba(255,255,255,0.12)';
      rightIndicator.horizontalAlignment = GUI.Control.HORIZONTAL_ALIGNMENT_RIGHT;
      rightIndicator.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_CENTER;
      rightIndicator.left = '-16px';
      container.addControl(rightIndicator);
      this._steerRightInd = rightIndicator;

      // Brake indicator (bottom center)
      const brakeInd = new GUI.TextBlock('brake_ind', 'BRAKE');
      brakeInd.fontSize = 14;
      brakeInd.fontFamily = 'monospace';
      brakeInd.color = 'rgba(255,80,80,0.0)';
      brakeInd.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      brakeInd.top = '-60px';
      container.addControl(brakeInd);
      this._brakeInd = brakeInd;

      // Drift indicator (top center, shows when drifting)
      const driftInd = new GUI.TextBlock('drift_active_ind', 'DRIFTING');
      driftInd.fontSize = 16;
      driftInd.fontFamily = 'monospace';
      driftInd.fontWeight = 'bold';
      driftInd.color = 'rgba(0,170,255,0.0)';
      driftInd.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_TOP;
      driftInd.top = '80px';
      container.addControl(driftInd);
      this._driftInd = driftInd;

      // ── Gesture zone hint at first touch ──
      const hintText = new GUI.TextBlock('gesture_hint', 'Swipe to steer \u2022 Hold to accelerate \u2022 Two fingers to drift');
      hintText.fontSize = 12;
      hintText.fontFamily = 'monospace';
      hintText.color = 'rgba(255,255,255,0.4)';
      hintText.verticalAlignment = GUI.Control.VERTICAL_ALIGNMENT_BOTTOM;
      hintText.top = '-20px';
      container.addControl(hintText);
      this._gestureHint = hintText;
      // Auto-hide hint after 5 seconds
      setTimeout(function() { if (hintText) hintText.isVisible = false; }, 5000);

      // ── Touch gesture tracking via canvas pointer events ──
      const canvas = document.getElementById('renderCanvas');
      if (!canvas) return;

      const touches = {};    // Track active touches by identifier
      let swipeStartX = 0;
      let swipeStartY = 0;
      const SWIPE_THRESHOLD = 20; // px to count as a swipe
      const STEER_SENSITIVITY = 0.015; // steer per px of horizontal drag
      let gestureActive = false;

      canvas.addEventListener('touchstart', (e) => {
        if (!this.touchControls.isVisible) return;
        e.preventDefault();

        // Hide hint after first interaction
        if (this._gestureHint.alpha > 0) {
          this._gestureHint.alpha = 0;
        }

        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          touches[t.identifier] = {
            startX: t.clientX,
            startY: t.clientY,
            currentX: t.clientX,
            currentY: t.clientY,
            startTime: Date.now(),
          };
        }

        const touchCount = Object.keys(touches).length;

        // Two-finger = drift (Asphalt style)
        if (touchCount >= 2) {
          Input().setTouch('drift', true);
          this._driftInd.color = 'rgba(0,170,255,0.7)';
        }

        // Single touch = auto-accelerate
        if (touchCount >= 1) {
          Input().setTouch('accelerate', true);
        }
      }, { passive: false });

      canvas.addEventListener('touchmove', (e) => {
        if (!this.touchControls.isVisible) return;
        e.preventDefault();

        for (let i = 0; i < e.changedTouches.length; i++) {
          const t = e.changedTouches[i];
          if (touches[t.identifier]) {
            touches[t.identifier].currentX = t.clientX;
            touches[t.identifier].currentY = t.clientY;
          }
        }

        // Use the first touch for steering
        const firstId = Object.keys(touches)[0];
        if (firstId !== undefined && touches[firstId]) {
          const dx = touches[firstId].currentX - touches[firstId].startX;
          const dy = touches[firstId].currentY - touches[firstId].startY;

          // Horizontal swipe = steer
          if (Math.abs(dx) > SWIPE_THRESHOLD) {
            const steerAmount = dx * STEER_SENSITIVITY;
            if (steerAmount < -0.1) {
              Input().setTouch('steerLeft', true);
              Input().setTouch('steerRight', false);
              this._steerLeftInd.color = 'rgba(255,77,0,0.5)';
              this._steerRightInd.color = 'rgba(255,255,255,0.12)';
            } else if (steerAmount > 0.1) {
              Input().setTouch('steerRight', true);
              Input().setTouch('steerLeft', false);
              this._steerRightInd.color = 'rgba(255,77,0,0.5)';
              this._steerLeftInd.color = 'rgba(255,255,255,0.12)';
            }
            // Update start for continuous drag steering (relative, not absolute)
            touches[firstId].startX = touches[firstId].currentX - (dx * 0.3);
          } else {
            Input().setTouch('steerLeft', false);
            Input().setTouch('steerRight', false);
            this._steerLeftInd.color = 'rgba(255,255,255,0.12)';
            this._steerRightInd.color = 'rgba(255,255,255,0.12)';
          }

          // Vertical swipe down = brake
          if (dy > SWIPE_THRESHOLD * 2) {
            Input().setTouch('brake', true);
            Input().setTouch('accelerate', false);
            this._brakeInd.color = 'rgba(255,80,80,0.7)';
          } else {
            Input().setTouch('brake', false);
            if (Object.keys(touches).length >= 1) {
              Input().setTouch('accelerate', true);
            }
            this._brakeInd.color = 'rgba(255,80,80,0.0)';
          }
        }
      }, { passive: false });

      const endTouch = (e) => {
        if (!this.touchControls.isVisible) return;

        for (let i = 0; i < e.changedTouches.length; i++) {
          delete touches[e.changedTouches[i].identifier];
        }

        const touchCount = Object.keys(touches).length;

        // Release drift when fewer than 2 fingers
        if (touchCount < 2) {
          Input().setTouch('drift', false);
          this._driftInd.color = 'rgba(0,170,255,0.0)';
        }

        // Release everything when no touches
        if (touchCount === 0) {
          Input().setTouch('accelerate', false);
          Input().setTouch('brake', false);
          Input().setTouch('steerLeft', false);
          Input().setTouch('steerRight', false);
          Input().setTouch('drift', false);
          this._steerLeftInd.color = 'rgba(255,255,255,0.12)';
          this._steerRightInd.color = 'rgba(255,255,255,0.12)';
          this._brakeInd.color = 'rgba(255,80,80,0.0)';
          this._driftInd.color = 'rgba(0,170,255,0.0)';
        }
      };

      canvas.addEventListener('touchend', endTouch, { passive: false });
      canvas.addEventListener('touchcancel', endTouch, { passive: false });
    }

    showTouchControls(visible) {
      if (this.touchControls) this.touchControls.isVisible = !!visible;
    }

    // ─── Utility ──────────────────────────────────────────────────
    dispose() {
      if (this.ui) this.ui.dispose();
    }
  }

  window.DriftLegends = window.DriftLegends || {};
  window.DriftLegends.GUIManager = GUIManager;
})();

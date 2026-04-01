/**
 * Chess 3D — Board Themes Module
 * Separated from game.js for maintainability.
 * Attaches to window._chess3d for cross-module communication.
 */
(function () {
  'use strict';

  const BOARD_THEMES = {
    classic:  { name: 'Classic',  light: '#F0D9B5', dark: '#5C3317', frame: '#3B1E08', desc: 'Default wood' },
    marble:   { name: 'Marble',   light: '#E8E8E8', dark: '#6B6B6B', frame: '#404040', desc: 'Grey marble' },
    forest:   { name: 'Forest',   light: '#AECF9F', dark: '#4A7B3C', frame: '#2D4A24', desc: 'Green tournament' },
    midnight: { name: 'Midnight', light: '#4A5568', dark: '#1A202C', frame: '#0D1117', desc: 'Dark mode' }
  };

  let currentTheme = localStorage.getItem('chess3d-theme') || 'classic';

  function hexToColor3(hex) {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new BABYLON.Color3(r, g, b);
  }

  function getThemeColors(themeName) {
    const theme = BOARD_THEMES[themeName || currentTheme] || BOARD_THEMES.classic;
    return {
      light: hexToColor3(theme.light),
      dark: hexToColor3(theme.dark),
      frame: hexToColor3(theme.frame),
    };
  }

  function applyBoardTheme(themeName) {
    const theme = BOARD_THEMES[themeName];
    if (!theme) return;
    currentTheme = themeName;
    localStorage.setItem('chess3d-theme', themeName);

    const g = window._chess3d;
    if (!g) return;

    const lightCol = hexToColor3(theme.light);
    const darkCol = hexToColor3(theme.dark);
    const frameCol = hexToColor3(theme.frame);

    // Update shared color refs
    if (g.setColors) g.setColors(lightCol, darkCol);

    // Update board square materials
    if (g.boardMeshes) {
      for (const sq of g.boardMeshes) {
        if (!sq.metadata || sq.metadata.type !== 'square') continue;
        const r = sq.metadata.row, c = sq.metadata.col;
        if (sq.material && sq.material.albedoColor) {
          sq.material.albedoColor = (r + c) % 2 === 0 ? darkCol.clone() : lightCol.clone();
        }
      }
    }

    // Update board frame
    if (g.scene) {
      const baseMat = g.scene.getMaterialByName('baseMat');
      if (baseMat && baseMat.albedoColor) baseMat.albedoColor = frameCol.clone();
    }

    // Update UI
    document.querySelectorAll('.chess3d-theme-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.theme === themeName);
    });
  }

  // Expose to other modules
  window._chess3dThemes = {
    BOARD_THEMES,
    currentTheme: () => currentTheme,
    getThemeColors,
    applyBoardTheme,
    hexToColor3,
  };
})();

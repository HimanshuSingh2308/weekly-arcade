/**
 * Chess 3D — Piece Skins Module
 * Separated from game.js for maintainability.
 */
(function () {
  'use strict';

  const PIECE_SKINS = {
    classic:  { name: 'Classic',  desc: 'Standard pieces', unlock: null },
    minimal:  { name: 'Minimal',  desc: 'Simple cylinders', unlock: { type: 'elo', value: 1000, text: 'Reach Knight tier (ELO 1000)' } },
    royal:    { name: 'Royal',    desc: '20% taller + gold trim', unlock: { type: 'difficulty', value: 'hard', text: 'Beat Hard AI' } }
  };

  let currentSkin = localStorage.getItem('chess3d-skin') || 'classic';

  function isSkinUnlocked(skinName) {
    const skin = PIECE_SKINS[skinName];
    if (!skin || !skin.unlock) return true;
    if (skin.unlock.type === 'elo') {
      const g = window._chess3d;
      return g && g.elo && g.elo.rating >= skin.unlock.value;
    }
    if (skin.unlock.type === 'difficulty') {
      try {
        const stats = JSON.parse(localStorage.getItem('chess3d-stats') || '{}');
        return !!(stats.beatHard);
      } catch (e) { return false; }
    }
    return false;
  }

  function applySkin(skinName) {
    if (!isSkinUnlocked(skinName)) return false;
    currentSkin = skinName;
    localStorage.setItem('chess3d-skin', skinName);

    const g = window._chess3d;
    if (g && g.rebuildPieces) g.rebuildPieces();

    // Update UI
    document.querySelectorAll('.chess3d-skin-btn').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.skin === skinName);
      const locked = !isSkinUnlocked(btn.dataset.skin);
      btn.classList.toggle('locked', locked);
      const tip = btn.querySelector('.chess3d-skin-lock-tip');
      if (tip) {
        const s = PIECE_SKINS[btn.dataset.skin];
        tip.textContent = locked && s?.unlock ? s.unlock.text : '';
      }
    });
    return true;
  }

  function updateSkinUI() {
    document.querySelectorAll('.chess3d-skin-btn').forEach(btn => {
      const skinName = btn.dataset.skin;
      const locked = !isSkinUnlocked(skinName);
      btn.classList.toggle('locked', locked);
      btn.classList.toggle('selected', skinName === currentSkin);
      const tip = btn.querySelector('.chess3d-skin-lock-tip');
      if (tip) {
        const s = PIECE_SKINS[skinName];
        tip.textContent = locked && s?.unlock ? s.unlock.text : '';
      }
    });
  }

  window._chess3dSkins = {
    PIECE_SKINS,
    currentSkin: () => currentSkin,
    isSkinUnlocked,
    applySkin,
    updateSkinUI,
  };
})();

/**
 * Chess 3D — Daily Puzzles Module
 * Separated from game.js for maintainability.
 */
(function () {
  'use strict';

  const DAILY_PUZZLES = [
    { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4', solution: ['h5f7'], title: 'Mate in 1', difficulty: 'Easy', desc: "Scholar's Mate" },
    { fen: 'r1b1k2r/ppppqppp/2n2n2/2b5/3NP3/2P5/PP3PPP/RNBQKB1R w KQkq - 0 1', solution: ['d4f5', 'e7e5', 'f5d6'], title: 'Mate in 2', difficulty: 'Medium', desc: 'Fork & Mate' },
    { fen: '6k1/5ppp/8/8/8/8/1Q6/K7 w - - 0 1', solution: ['b2g7'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Queen Mate' },
    { fen: 'r1bqk2r/pppp1ppp/2n5/2b1p3/2BnP3/5N2/PPPP1PPP/RNBQ1RK1 w kq - 0 1', solution: ['f3e5'], title: 'Find the Best Move', difficulty: 'Medium', desc: 'Tactical' },
    { fen: '8/8/8/8/8/5k2/4R3/4K3 w - - 0 1', solution: ['e2f2'], title: 'Mate in 1', difficulty: 'Easy', desc: 'King & Rook Mate' },
    { fen: 'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 0 2', solution: ['e7e5'], title: 'Best Opening Move', difficulty: 'Easy', desc: 'Find best response' },
    { fen: '6k1/pp3ppp/8/8/8/8/PPR2PPP/6K1 w - - 0 1', solution: ['c2c8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Back rank mate' },
    { fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQ1RK1 w - - 0 1', solution: ['c4f7'], title: 'Find the Sacrifice', difficulty: 'Hard', desc: 'Bishop sacrifice' },
    { fen: '3r2k1/pp3ppp/8/3Q4/8/8/PPP2PPP/6K1 w - - 0 1', solution: ['d5d8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Back rank' },
    { fen: 'r1b1kb1r/pppp1ppp/5n2/4p1q1/2BnP3/2N2N2/PPPP1PPP/R1BQK2R w KQkq - 0 1', solution: ['f3e5'], title: 'Find the Tactic', difficulty: 'Medium', desc: 'Counter-attack' },
    { fen: '5rk1/5ppp/8/3Q4/8/8/5PPP/6K1 w - - 0 1', solution: ['d5f7'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Queen delivers mate' },
    { fen: '6k1/4Rppp/8/8/8/8/5PPP/6K1 w - - 0 1', solution: ['e7e8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Rook back rank' },
    { fen: 'r4rk1/ppp2ppp/8/3q4/8/1B6/PPP2PPP/R4RK1 w - - 0 1', solution: ['b3f7'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Bishop snipe' },
    { fen: '6k1/5ppp/4p3/8/8/8/2R2PPP/6K1 w - - 0 1', solution: ['c2c8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Back rank pattern' },
    { fen: 'r1bk3r/pppp1ppp/8/4N3/8/8/PPP2PPP/R1B1K2R w KQ - 0 1', solution: ['e5f7'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Knight smothered fork' },
    { fen: '2r3k1/5ppp/8/8/3B4/8/5PPP/4R1K1 w - - 0 1', solution: ['e1e8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Rook invades' },
    { fen: 'r1bqr1k1/pppp1ppp/2n2n2/8/1bB5/2N1PN2/PPPP1PPP/R1BQK2R w KQ - 0 1', solution: ['e1g1'], title: 'Best Move', difficulty: 'Easy', desc: 'Castle to safety' },
    { fen: '5r1k/pp4pp/8/3Q4/8/7P/PP4P1/6K1 w - - 0 1', solution: ['d5d8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Queen back rank' },
    { fen: 'r4rk1/pppb1ppp/2n5/3np3/8/3B1N2/PPP2PPP/R1B1R1K1 w - - 0 1', solution: ['d3h7'], title: 'Find the Sacrifice', difficulty: 'Medium', desc: 'Greek gift setup' },
    { fen: '2kr4/ppp2ppp/8/4N3/8/8/PPP2PPP/2KR4 w - - 0 1', solution: ['d1d8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Rook delivers mate' },
    { fen: 'r3k2r/ppp2ppp/2n5/3qN3/8/8/PPP2PPP/R2QK2R w KQkq - 0 1', solution: ['e5c6'], title: 'Find the Fork', difficulty: 'Medium', desc: 'Knight fork' },
    { fen: '4r1k1/5ppp/8/q7/8/4B3/5PPP/3Q2K1 w - - 0 1', solution: ['d1d8'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Queen exchange mate' },
    { fen: 'r2qk2r/ppp2ppp/2n1bn2/3pp3/4P3/2NP1N2/PPP2PPP/R1BQKB1R w KQkq - 0 1', solution: ['e4d5'], title: 'Best Capture', difficulty: 'Easy', desc: 'Central pawn grab' },
    { fen: 'r1b1k1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1', solution: ['c4f7'], title: 'Find the Sacrifice', difficulty: 'Hard', desc: 'Fried Liver Attack' },
    { fen: '3rr1k1/ppp2ppp/8/3Q4/8/8/PPP2PPP/4R1K1 w - - 0 1', solution: ['d5d8', 'e8d8', 'e1d1'], title: 'Mate in 2', difficulty: 'Medium', desc: 'Exchange and mate' },
    { fen: 'rnb1kbnr/pppp1ppp/8/4p3/5PPq/8/PPPPP2P/RNBQKBNR w KQkq - 0 1', solution: ['g4g5'], title: 'Defend!', difficulty: 'Medium', desc: 'Block the queen' },
    { fen: '6k1/5p1p/6pQ/8/8/8/5PPP/6K1 w - - 0 1', solution: ['h6g7'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Queen corner mate' },
    { fen: '2r2rk1/pp3ppp/8/2bQ4/8/6P1/PP3P1P/R3R1K1 w - - 0 1', solution: ['d5f7'], title: 'Mate in 1', difficulty: 'Easy', desc: 'Queen attacks f7' },
    { fen: 'r1bqkbnr/pppppppp/2n5/8/3PP3/8/PPP2PPP/RNBQKBNR b KQkq - 0 2', solution: ['d7d5'], title: 'Best Defense', difficulty: 'Easy', desc: 'Counter in center' },
    { fen: 'r3kb1r/ppp1pppp/2n2n2/3q4/3P4/2N2N2/PPP2PPP/R1BQKB1R w KQkq - 0 1', solution: ['c3d5'], title: 'Win Material', difficulty: 'Medium', desc: 'Knight captures queen' },
  ];

  let puzzleMode = false;
  let puzzleIndex = -1;
  let puzzleMoveIndex = 0;
  let puzzleSolved = false;
  let puzzleFenSnapshot = '';

  function getDailyPuzzleIndex() {
    return Math.floor(Date.now() / 86400000) % DAILY_PUZZLES.length;
  }

  function getPuzzleSolvedSet() {
    try { return new Set(JSON.parse(localStorage.getItem('chess3d-puzzles-solved') || '[]')); }
    catch (e) { return new Set(); }
  }

  function markPuzzleSolved(idx) {
    const set = getPuzzleSolvedSet();
    set.add(idx);
    localStorage.setItem('chess3d-puzzles-solved', JSON.stringify([...set]));
  }

  window._chess3dPuzzles = {
    DAILY_PUZZLES,
    getDailyPuzzleIndex,
    getPuzzleSolvedSet,
    markPuzzleSolved,
    // Mutable state — game.js reads/writes these
    get puzzleMode() { return puzzleMode; },
    set puzzleMode(v) { puzzleMode = v; },
    get puzzleIndex() { return puzzleIndex; },
    set puzzleIndex(v) { puzzleIndex = v; },
    get puzzleMoveIndex() { return puzzleMoveIndex; },
    set puzzleMoveIndex(v) { puzzleMoveIndex = v; },
    get puzzleSolved() { return puzzleSolved; },
    set puzzleSolved(v) { puzzleSolved = v; },
    get puzzleFenSnapshot() { return puzzleFenSnapshot; },
    set puzzleFenSnapshot(v) { puzzleFenSnapshot = v; },
  };
})();

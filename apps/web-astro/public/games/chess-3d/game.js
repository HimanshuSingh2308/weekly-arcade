/**
 * Chess 3D — Complete chess game with Babylon.js 3D rendering,
 * built-in chess engine, AI opponent with 4 difficulty levels,
 * ELO rating system, and Weekly Arcade integration.
 *
 * Single IIFE — no global pollution.
 */
(function () {
  'use strict';

  /* ================================================================
     0. CONSTANTS
     ================================================================ */
  const GAME_ID = 'chess-3d';
  const PIECE_TYPES = { PAWN: 'p', ROOK: 'r', KNIGHT: 'n', BISHOP: 'b', QUEEN: 'q', KING: 'k' };
  const WHITE = 'w', BLACK = 'b';
  const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

  const PIECE_VALUES = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000 };

  const PIECE_UNICODE = {
    wk: '\u2654', wq: '\u2655', wr: '\u2656', wb: '\u2657', wn: '\u2658', wp: '\u2659',
    bk: '\u265A', bq: '\u265B', br: '\u265C', bb: '\u265D', bn: '\u265E', bp: '\u265F'
  };

  const AI_ELO = { easy: 600, medium: 1100, hard: 1500, expert: 1900 };
  const AI_DEPTH = { easy: 1, medium: 3, hard: 4, expert: 5 };
  const AI_TIME_LIMIT = { easy: 200, medium: 500, hard: 1500, expert: 3000 };

  const RANK_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8'];
  const FILE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

  // Colors (initialized lazily in initColors() after Babylon loads)
  let COL_LIGHT_SQ, COL_DARK_SQ, COL_WHITE_PIECE, COL_BLACK_PIECE;
  let COL_GOLD, COL_EMERALD, COL_RED, COL_BLUE;

  // Module references (loaded from themes.js, skins.js, puzzles.js before game.js)
  const _t = window._chess3dThemes || {};
  const _sk = window._chess3dSkins || {};
  const _pz = window._chess3dPuzzles || {};

  // Aliases for backward compatibility with inline references
  const BOARD_THEMES = _t.BOARD_THEMES || { classic: { light: '#F0D9B5', dark: '#5C3317', frame: '#3B1E08' } };
  const PIECE_SKINS = _sk.PIECE_SKINS || { classic: { name: 'Classic', unlock: null } };
  const DAILY_PUZZLES = _pz.DAILY_PUZZLES || [];
  const currentTheme = _t.currentTheme ? _t.currentTheme() : 'classic';
  const currentSkin = _sk.currentSkin ? _sk.currentSkin() : 'classic';
  const _hexToColor3 = _t.hexToColor3 || ((hex) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    return new BABYLON.Color3(r, g, b);
  });

  // Shorthand functions
  function applyBoardTheme(n) { _t.applyBoardTheme?.(n); }
  function applySkin(n) { return _sk.applySkin?.(n) || false; }
  function isSkinUnlocked(n) { return _sk.isSkinUnlocked?.(n) || false; }
  function getDailyPuzzleIndex() { return _pz.getDailyPuzzleIndex?.() || 0; }
  function getPuzzleSolvedSet() { return _pz.getPuzzleSolvedSet?.() || new Set(); }
  function markPuzzleSolved(idx) { _pz.markPuzzleSolved?.(idx); }

  // Puzzle state proxied to module
  const puzzleState = _pz;
  // For code that reads puzzleMode/puzzleIndex directly, these are now on _pz

  function initColors() {
    const tc = _t.getThemeColors?.();
    COL_LIGHT_SQ = tc?.light || new BABYLON.Color3(0.94, 0.85, 0.71);
    COL_DARK_SQ = tc?.dark || new BABYLON.Color3(0.36, 0.20, 0.09);
    COL_WHITE_PIECE = new BABYLON.Color3(0.96, 0.94, 0.91); // #F5F0E8
    COL_BLACK_PIECE = new BABYLON.Color3(0.17, 0.17, 0.17); // #2C2C2C
    COL_GOLD = new BABYLON.Color3(0.79, 0.66, 0.30);       // #C9A84C
    COL_EMERALD = new BABYLON.Color3(0.24, 0.67, 0.38);    // #3DAA62
    COL_RED = new BABYLON.Color3(0.75, 0.22, 0.17);        // #C0392B
    COL_BLUE = new BABYLON.Color3(0.20, 0.40, 0.70);
  }

  /* ================================================================
     1. CHESS ENGINE
     ================================================================ */
  class ChessEngine {
    constructor() {
      this.reset();
    }

    reset() {
      this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
      this.turn = WHITE;
      this.castling = { K: true, Q: true, k: true, q: true };
      this.enPassant = null; // [row, col] or null
      this.halfMoveClock = 0;
      this.fullMoveNumber = 1;
      this.moveHistory = [];
      this.positionHistory = [];
      this.sanHistory = [];
      this.loadFEN(STARTING_FEN);
    }

    // --- FEN ---
    loadFEN(fen) {
      const parts = fen.split(' ');
      const rows = parts[0].split('/');
      this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

      for (let r = 0; r < 8; r++) {
        let col = 0;
        for (const ch of rows[r]) {
          if (ch >= '1' && ch <= '8') {
            col += parseInt(ch);
          } else {
            const color = ch === ch.toUpperCase() ? WHITE : BLACK;
            const type = ch.toLowerCase();
            this.board[7 - r][col] = { type, color };
            col++;
          }
        }
      }

      this.turn = parts[1] || WHITE;

      this.castling = { K: false, Q: false, k: false, q: false };
      const castStr = parts[2] || '-';
      if (castStr !== '-') {
        for (const c of castStr) this.castling[c] = true;
      }

      if (parts[3] && parts[3] !== '-') {
        const file = parts[3].charCodeAt(0) - 97;
        const rank = parseInt(parts[3][1]) - 1;
        this.enPassant = [rank, file];
      } else {
        this.enPassant = null;
      }

      this.halfMoveClock = parseInt(parts[4]) || 0;
      this.fullMoveNumber = parseInt(parts[5]) || 1;
      this.positionHistory = [this._positionKey()];
      return true;
    }

    getFEN() {
      let fen = '';
      for (let r = 7; r >= 0; r--) {
        let empty = 0;
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (!p) { empty++; continue; }
          if (empty > 0) { fen += empty; empty = 0; }
          fen += p.color === WHITE ? p.type.toUpperCase() : p.type;
        }
        if (empty > 0) fen += empty;
        if (r > 0) fen += '/';
      }

      fen += ' ' + this.turn;

      let castStr = '';
      if (this.castling.K) castStr += 'K';
      if (this.castling.Q) castStr += 'Q';
      if (this.castling.k) castStr += 'k';
      if (this.castling.q) castStr += 'q';
      fen += ' ' + (castStr || '-');

      if (this.enPassant) {
        fen += ' ' + FILE_NAMES[this.enPassant[1]] + RANK_NAMES[this.enPassant[0]];
      } else {
        fen += ' -';
      }

      fen += ' ' + this.halfMoveClock + ' ' + this.fullMoveNumber;
      return fen;
    }

    _positionKey() {
      // Position key for repetition detection (board + turn + castling + en passant)
      let key = '';
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          key += p ? (p.color === WHITE ? p.type.toUpperCase() : p.type) : '.';
        }
      }
      key += this.turn;
      key += (this.castling.K ? 'K' : '') + (this.castling.Q ? 'Q' : '') +
             (this.castling.k ? 'k' : '') + (this.castling.q ? 'q' : '');
      if (this.enPassant) key += FILE_NAMES[this.enPassant[1]] + this.enPassant[0];
      return key;
    }

    getTurn() { return this.turn; }
    getHistory() { return this.sanHistory.slice(); }
    getPieceAt(row, col) { return this.board[row]?.[col] || null; }
    getBoard() { return this.board.map(r => r.slice()); }

    // --- Square helpers ---
    _algebraic(row, col) { return FILE_NAMES[col] + RANK_NAMES[row]; }
    _fromAlgebraic(sq) { return [parseInt(sq[1]) - 1, sq.charCodeAt(0) - 97]; }

    _inBounds(r, c) { return r >= 0 && r < 8 && c >= 0 && c < 8; }

    _findKing(color) {
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (this.board[r][c]?.type === 'k' && this.board[r][c]?.color === color)
            return [r, c];
      return null;
    }

    // --- Attack detection ---
    _isSquareAttackedBy(row, col, byColor) {
      // Check all attack vectors
      const d = byColor === WHITE ? 1 : -1;

      // Pawn attacks
      if (this._inBounds(row - d, col - 1)) {
        const p = this.board[row - d][col - 1];
        if (p?.type === 'p' && p.color === byColor) return true;
      }
      if (this._inBounds(row - d, col + 1)) {
        const p = this.board[row - d][col + 1];
        if (p?.type === 'p' && p.color === byColor) return true;
      }

      // Knight attacks
      const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
      for (const [dr, dc] of knightMoves) {
        const nr = row + dr, nc = col + dc;
        if (this._inBounds(nr, nc)) {
          const p = this.board[nr][nc];
          if (p?.type === 'n' && p.color === byColor) return true;
        }
      }

      // King attacks (for adjacent squares)
      const kingMoves = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
      for (const [dr, dc] of kingMoves) {
        const nr = row + dr, nc = col + dc;
        if (this._inBounds(nr, nc)) {
          const p = this.board[nr][nc];
          if (p?.type === 'k' && p.color === byColor) return true;
        }
      }

      // Sliding pieces: rook/queen (straight), bishop/queen (diagonal)
      const straightDirs = [[0,1],[0,-1],[1,0],[-1,0]];
      for (const [dr, dc] of straightDirs) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i, nc = col + dc * i;
          if (!this._inBounds(nr, nc)) break;
          const p = this.board[nr][nc];
          if (p) {
            if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
            break;
          }
        }
      }

      const diagDirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
      for (const [dr, dc] of diagDirs) {
        for (let i = 1; i < 8; i++) {
          const nr = row + dr * i, nc = col + dc * i;
          if (!this._inBounds(nr, nc)) break;
          const p = this.board[nr][nc];
          if (p) {
            if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
            break;
          }
        }
      }

      return false;
    }

    isCheck(color) {
      color = color || this.turn;
      const king = this._findKing(color);
      if (!king) return false;
      const opp = color === WHITE ? BLACK : WHITE;
      return this._isSquareAttackedBy(king[0], king[1], opp);
    }

    // --- Pseudo-legal move generation ---
    _generatePseudoMoves(color) {
      const moves = [];
      const dir = color === WHITE ? 1 : -1;
      const startRank = color === WHITE ? 1 : 6;
      const promoRank = color === WHITE ? 7 : 0;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = this.board[r][c];
          if (!piece || piece.color !== color) continue;

          switch (piece.type) {
            case 'p': {
              // Forward
              const nr = r + dir;
              if (this._inBounds(nr, c) && !this.board[nr][c]) {
                if (nr === promoRank) {
                  for (const promo of ['q', 'r', 'b', 'n'])
                    moves.push({ from: [r, c], to: [nr, c], promotion: promo });
                } else {
                  moves.push({ from: [r, c], to: [nr, c] });
                }
                // Double push
                if (r === startRank) {
                  const nr2 = r + dir * 2;
                  if (!this.board[nr2][c])
                    moves.push({ from: [r, c], to: [nr2, c] });
                }
              }
              // Captures
              for (const dc of [-1, 1]) {
                const nc = c + dc;
                if (!this._inBounds(nr, nc)) continue;
                const target = this.board[nr][nc];
                if (target && target.color !== color) {
                  if (nr === promoRank) {
                    for (const promo of ['q', 'r', 'b', 'n'])
                      moves.push({ from: [r, c], to: [nr, nc], promotion: promo, capture: true });
                  } else {
                    moves.push({ from: [r, c], to: [nr, nc], capture: true });
                  }
                }
                // En passant
                if (this.enPassant && this.enPassant[0] === nr && this.enPassant[1] === nc) {
                  moves.push({ from: [r, c], to: [nr, nc], enPassant: true, capture: true });
                }
              }
              break;
            }
            case 'n': {
              const knightMoves = [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]];
              for (const [dr, dc] of knightMoves) {
                const nr = r + dr, nc = c + dc;
                if (!this._inBounds(nr, nc)) continue;
                const target = this.board[nr][nc];
                if (!target || target.color !== color)
                  moves.push({ from: [r, c], to: [nr, nc], capture: !!target });
              }
              break;
            }
            case 'b': {
              const dirs = [[-1,-1],[-1,1],[1,-1],[1,1]];
              for (const [dr, dc] of dirs) this._addSlidingMoves(r, c, dr, dc, color, moves);
              break;
            }
            case 'r': {
              const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
              for (const [dr, dc] of dirs) this._addSlidingMoves(r, c, dr, dc, color, moves);
              break;
            }
            case 'q': {
              const dirs = [[-1,-1],[-1,1],[1,-1],[1,1],[0,1],[0,-1],[1,0],[-1,0]];
              for (const [dr, dc] of dirs) this._addSlidingMoves(r, c, dr, dc, color, moves);
              break;
            }
            case 'k': {
              const kingDirs = [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]];
              for (const [dr, dc] of kingDirs) {
                const nr = r + dr, nc = c + dc;
                if (!this._inBounds(nr, nc)) continue;
                const target = this.board[nr][nc];
                if (!target || target.color !== color)
                  moves.push({ from: [r, c], to: [nr, nc], capture: !!target });
              }
              // Castling
              const opp = color === WHITE ? BLACK : WHITE;
              const rank = color === WHITE ? 0 : 7;
              if (r === rank && c === 4) {
                // Kingside
                const castleK = color === WHITE ? 'K' : 'k';
                if (this.castling[castleK] &&
                    this.board[rank][7]?.type === 'r' && this.board[rank][7]?.color === color &&
                    !this.board[rank][5] && !this.board[rank][6] &&
                    !this._isSquareAttackedBy(rank, 4, opp) &&
                    !this._isSquareAttackedBy(rank, 5, opp) &&
                    !this._isSquareAttackedBy(rank, 6, opp)) {
                  moves.push({ from: [r, c], to: [rank, 6], castle: 'K' });
                }
                // Queenside
                const castleQ = color === WHITE ? 'Q' : 'q';
                if (this.castling[castleQ] &&
                    this.board[rank][0]?.type === 'r' && this.board[rank][0]?.color === color &&
                    !this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1] &&
                    !this._isSquareAttackedBy(rank, 4, opp) &&
                    !this._isSquareAttackedBy(rank, 3, opp) &&
                    !this._isSquareAttackedBy(rank, 2, opp)) {
                  moves.push({ from: [r, c], to: [rank, 2], castle: 'Q' });
                }
              }
              break;
            }
          }
        }
      }
      return moves;
    }

    _addSlidingMoves(r, c, dr, dc, color, moves) {
      for (let i = 1; i < 8; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (!this._inBounds(nr, nc)) break;
        const target = this.board[nr][nc];
        if (target) {
          if (target.color !== color)
            moves.push({ from: [r, c], to: [nr, nc], capture: true });
          break;
        }
        moves.push({ from: [r, c], to: [nr, nc] });
      }
    }

    // --- Legal moves ---
    getLegalMoves(fromRow, fromCol) {
      const pseudo = typeof fromRow === 'number'
        ? this._generatePseudoMoves(this.turn).filter(m => m.from[0] === fromRow && m.from[1] === fromCol)
        : this._generatePseudoMoves(this.turn);

      return pseudo.filter(move => {
        // Try the move and check if our king is safe
        const undoData = this._applyMoveRaw(move);
        const king = this._findKing(this.turn === WHITE ? BLACK : WHITE);
        // After applying, turn has not been switched in raw apply, so the moved color is still this.turn (we check the color that just moved)
        const movedColor = undoData.turn;
        const kPos = this._findKing(movedColor);
        const opp = movedColor === WHITE ? BLACK : WHITE;
        const inCheck = kPos ? this._isSquareAttackedBy(kPos[0], kPos[1], opp) : true;
        this._undoMoveRaw(undoData);
        return !inCheck;
      });
    }

    getAllLegalMoves(color) {
      const savedTurn = this.turn;
      if (color) this.turn = color;
      const moves = this.getLegalMoves();
      this.turn = savedTurn;
      return moves;
    }

    isLegalMove(fromRow, fromCol, toRow, toCol, promotion) {
      const legal = this.getLegalMoves(fromRow, fromCol);
      return legal.find(m =>
        m.to[0] === toRow && m.to[1] === toCol &&
        (!m.promotion || m.promotion === (promotion || 'q'))
      );
    }

    // --- Apply / Undo (raw, for search) ---
    _applyMoveRaw(move) {
      const undo = {
        from: move.from,
        to: move.to,
        piece: this.board[move.from[0]][move.from[1]],
        captured: this.board[move.to[0]][move.to[1]],
        castle: move.castle,
        enPassant: this.enPassant,
        enPassantCapture: null,
        castling: { ...this.castling },
        halfMoveClock: this.halfMoveClock,
        fullMoveNumber: this.fullMoveNumber,
        turn: this.turn,
        promotion: move.promotion
      };

      const piece = this.board[move.from[0]][move.from[1]];

      // En passant capture
      if (move.enPassant) {
        const capturedRow = move.from[0];
        undo.enPassantCapture = this.board[capturedRow][move.to[1]];
        undo.enPassantCapturePos = [capturedRow, move.to[1]];
        this.board[capturedRow][move.to[1]] = null;
      }

      // Move piece
      this.board[move.to[0]][move.to[1]] = piece;
      this.board[move.from[0]][move.from[1]] = null;

      // Promotion
      if (move.promotion) {
        this.board[move.to[0]][move.to[1]] = { type: move.promotion, color: piece.color };
      }

      // Castling rook move
      if (move.castle) {
        const rank = move.from[0];
        if (move.castle === 'K') {
          this.board[rank][5] = this.board[rank][7];
          this.board[rank][7] = null;
        } else {
          this.board[rank][3] = this.board[rank][0];
          this.board[rank][0] = null;
        }
      }

      // Update castling rights
      if (piece.type === 'k') {
        if (piece.color === WHITE) { this.castling.K = false; this.castling.Q = false; }
        else { this.castling.k = false; this.castling.q = false; }
      }
      if (piece.type === 'r') {
        if (move.from[0] === 0 && move.from[1] === 0) this.castling.Q = false;
        if (move.from[0] === 0 && move.from[1] === 7) this.castling.K = false;
        if (move.from[0] === 7 && move.from[1] === 0) this.castling.q = false;
        if (move.from[0] === 7 && move.from[1] === 7) this.castling.k = false;
      }
      // If rook captured on starting square
      if (move.to[0] === 0 && move.to[1] === 0) this.castling.Q = false;
      if (move.to[0] === 0 && move.to[1] === 7) this.castling.K = false;
      if (move.to[0] === 7 && move.to[1] === 0) this.castling.q = false;
      if (move.to[0] === 7 && move.to[1] === 7) this.castling.k = false;

      // Update en passant
      if (piece.type === 'p' && Math.abs(move.to[0] - move.from[0]) === 2) {
        this.enPassant = [(move.from[0] + move.to[0]) / 2, move.from[1]];
      } else {
        this.enPassant = null;
      }

      // Half move clock
      if (piece.type === 'p' || move.capture) {
        this.halfMoveClock = 0;
      } else {
        this.halfMoveClock++;
      }

      if (this.turn === BLACK) this.fullMoveNumber++;
      this.turn = this.turn === WHITE ? BLACK : WHITE;

      return undo;
    }

    _undoMoveRaw(undo) {
      this.board[undo.from[0]][undo.from[1]] = undo.piece;
      this.board[undo.to[0]][undo.to[1]] = undo.captured;

      if (undo.enPassantCapturePos) {
        this.board[undo.enPassantCapturePos[0]][undo.enPassantCapturePos[1]] = undo.enPassantCapture;
      }

      if (undo.castle) {
        const rank = undo.from[0];
        if (undo.castle === 'K') {
          this.board[rank][7] = this.board[rank][5];
          this.board[rank][5] = null;
        } else {
          this.board[rank][0] = this.board[rank][3];
          this.board[rank][3] = null;
        }
      }

      this.castling = undo.castling;
      this.enPassant = undo.enPassant;
      this.halfMoveClock = undo.halfMoveClock;
      this.fullMoveNumber = undo.fullMoveNumber;
      this.turn = undo.turn;
    }

    // --- Make move (public, with SAN generation) ---
    makeMove(fromRow, fromCol, toRow, toCol, promotion) {
      const legalMove = this.getLegalMoves(fromRow, fromCol).find(m =>
        m.to[0] === toRow && m.to[1] === toCol &&
        (!m.promotion || m.promotion === (promotion || 'q'))
      );
      if (!legalMove) return null;

      // Generate SAN before applying
      const san = this._generateSAN(legalMove);

      // Save undo for history
      const undoData = this._applyMoveRaw(legalMove);
      this.positionHistory.push(this._positionKey());

      // Check/checkmate suffix
      let sanFinal = san;
      if (this.isCheckmate()) sanFinal += '#';
      else if (this.isCheck()) sanFinal += '+';

      this.sanHistory.push(sanFinal);
      this.moveHistory.push({
        ...legalMove,
        san: sanFinal,
        undo: undoData,
        captured: undoData.captured
      });

      return {
        from: legalMove.from,
        to: legalMove.to,
        san: sanFinal,
        capture: !!legalMove.capture || !!legalMove.enPassant,
        castle: legalMove.castle,
        promotion: legalMove.promotion,
        enPassant: legalMove.enPassant,
        piece: undoData.piece
      };
    }

    _generateSAN(move) {
      if (move.castle === 'K') return 'O-O';
      if (move.castle === 'Q') return 'O-O-O';

      const piece = this.board[move.from[0]][move.from[1]];
      let san = '';

      if (piece.type !== 'p') {
        san += piece.type.toUpperCase();
        // Disambiguation
        const others = this._generatePseudoMoves(this.turn).filter(m =>
          m.to[0] === move.to[0] && m.to[1] === move.to[1] &&
          this.board[m.from[0]][m.from[1]]?.type === piece.type &&
          (m.from[0] !== move.from[0] || m.from[1] !== move.from[1])
        );
        if (others.length > 0) {
          const sameFile = others.some(m => m.from[1] === move.from[1]);
          const sameRank = others.some(m => m.from[0] === move.from[0]);
          if (!sameFile) san += FILE_NAMES[move.from[1]];
          else if (!sameRank) san += RANK_NAMES[move.from[0]];
          else san += FILE_NAMES[move.from[1]] + RANK_NAMES[move.from[0]];
        }
      }

      if (move.capture || move.enPassant) {
        if (piece.type === 'p') san += FILE_NAMES[move.from[1]];
        san += 'x';
      }

      san += this._algebraic(move.to[0], move.to[1]);

      if (move.promotion) san += '=' + move.promotion.toUpperCase();

      return san;
    }

    undoMove() {
      if (this.moveHistory.length === 0) return null;
      const last = this.moveHistory.pop();
      this.sanHistory.pop();
      this.positionHistory.pop();
      this._undoMoveRaw(last.undo);
      return last;
    }

    // --- Game state detection ---
    isCheckmate() {
      if (!this.isCheck()) return false;
      return this.getLegalMoves().length === 0;
    }

    isStalemate() {
      if (this.isCheck()) return false;
      return this.getLegalMoves().length === 0;
    }

    isDraw() {
      return this.isStalemate() || this.isInsufficientMaterial() ||
             this.isThreefoldRepetition() || this.isFiftyMoveRule() ||
             this.isFivefoldRepetition() || this.is75MoveRule();
    }

    getDrawReason() {
      if (this.isStalemate()) return 'Stalemate';
      if (this.isInsufficientMaterial()) return 'Insufficient material';
      if (this.isFivefoldRepetition()) return 'Fivefold repetition';
      if (this.isThreefoldRepetition()) return 'Threefold repetition';
      if (this.is75MoveRule()) return '75-move rule';
      if (this.isFiftyMoveRule()) return '50-move rule';
      return null;
    }

    isInsufficientMaterial() {
      const pieces = { w: [], b: [] };
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = this.board[r][c];
          if (p && p.type !== 'k') pieces[p.color].push({ type: p.type, sq: [r, c] });
        }
      }
      const wc = pieces.w.length, bc = pieces.b.length;
      // K vs K
      if (wc === 0 && bc === 0) return true;
      // K+B vs K or K+N vs K
      if (wc === 0 && bc === 1 && (pieces.b[0].type === 'b' || pieces.b[0].type === 'n')) return true;
      if (bc === 0 && wc === 1 && (pieces.w[0].type === 'b' || pieces.w[0].type === 'n')) return true;
      // K+B vs K+B same color
      if (wc === 1 && bc === 1 && pieces.w[0].type === 'b' && pieces.b[0].type === 'b') {
        const ws = pieces.w[0].sq, bs = pieces.b[0].sq;
        if ((ws[0] + ws[1]) % 2 === (bs[0] + bs[1]) % 2) return true;
      }
      return false;
    }

    isThreefoldRepetition() {
      const current = this._positionKey();
      let count = 0;
      for (const pos of this.positionHistory) {
        if (pos === current) count++;
      }
      return count >= 3;
    }

    isFivefoldRepetition() {
      const current = this._positionKey();
      let count = 0;
      for (const pos of this.positionHistory) {
        if (pos === current) count++;
      }
      return count >= 5;
    }

    isFiftyMoveRule() { return this.halfMoveClock >= 100; }
    is75MoveRule() { return this.halfMoveClock >= 150; }

    isGameOver() {
      return this.isCheckmate() || this.isDraw();
    }
  }

  /* ================================================================
     2. AI ENGINE
     ================================================================ */

  // Piece-square tables (from white's perspective, row 0 = rank 1)
  const PST = {
    p: [
       0,  0,  0,  0,  0,  0,  0,  0,
       5, 10, 10,-20,-20, 10, 10,  5,
       5, -5,-10,  0,  0,-10, -5,  5,
       0,  0,  0, 20, 20,  0,  0,  0,
       5,  5, 10, 25, 25, 10,  5,  5,
      10, 10, 20, 30, 30, 20, 10, 10,
      50, 50, 50, 50, 50, 50, 50, 50,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    n: [
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50
    ],
    b: [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -20,-10,-10,-10,-10,-10,-10,-20
    ],
    r: [
       0,  0,  0,  5,  5,  0,  0,  0,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
       5, 10, 10, 10, 10, 10, 10,  5,
       0,  0,  0,  0,  0,  0,  0,  0
    ],
    q: [
      -20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  5,  0,-10,
      -10,  0,  5,  5,  5,  5,  5,-10,
       -5,  0,  5,  5,  5,  5,  0, -5,
       -5,  0,  5,  5,  5,  5,  0, -5,
      -10,  0,  5,  5,  5,  5,  0,-10,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20
    ],
    k: [
       20, 30, 10,  0,  0, 10, 30, 20,
       20, 20,  0,  0,  0,  0, 20, 20,
      -10,-20,-20,-20,-20,-20,-20,-10,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30
    ],
    k_end: [
      -50,-30,-30,-30,-30,-30,-30,-50,
      -30,-10,  0,  0,  0,  0,-10,-30,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,-20,  0,  0,  0,  0,-20,-30,
      -50,-30,-30,-30,-30,-30,-30,-50
    ]
  };

  // Opening book (Expert only) — keys use position + turn + castling only
  const OPENING_BOOK = {
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq': [
      { from: [1,4], to: [3,4], w: 40 }, // e4
      { from: [1,3], to: [3,3], w: 35 }, // d4
      { from: [0,6], to: [2,5], w: 15 }, // Nf3
      { from: [1,2], to: [3,2], w: 10 }, // c4
    ],
    // After 1.e4
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq': [
      { from: [6,4], to: [4,4], w: 35 }, // e5
      { from: [6,2], to: [4,2], w: 30 }, // c5 (Sicilian)
      { from: [6,4], to: [5,4], w: 15 }, // e6 (French)
      { from: [6,2], to: [5,2], w: 10 }, // c6 (Caro-Kann)
      { from: [6,3], to: [4,3], w: 10 }, // d5 (Scandinavian)
    ],
    // After 1.d4
    'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq': [
      { from: [6,3], to: [4,3], w: 40 }, // d5
      { from: [7,6], to: [5,5], w: 30 }, // Nf6 (Indian)
      { from: [6,4], to: [5,4], w: 15 }, // e6
      { from: [6,5], to: [4,5], w: 10 }, // f5 (Dutch)
    ],
    // After 1.e4 e5
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': [
      { from: [0,6], to: [2,5], w: 50 }, // Nf3
      { from: [1,5], to: [3,5], w: 20 }, // f4 (King's Gambit)
      { from: [0,5], to: [3,2], w: 15 }, // Bc4
    ],
    // After 1.e4 e5 2.Nf3
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq': [
      { from: [7,1], to: [5,2], w: 50 }, // Nc6
      { from: [7,6], to: [5,5], w: 25 }, // Nf6 (Petrov)
      { from: [6,3], to: [5,3], w: 15 }, // d6 (Philidor)
    ],
    // After 1.e4 c5 (Sicilian)
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq': [
      { from: [0,6], to: [2,5], w: 60 }, // Nf3 (Open Sicilian)
      { from: [1,2], to: [2,2], w: 20 }, // c3 (Alapin)
      { from: [1,3], to: [3,3], w: 10 }, // d4
    ],
    // After 1.d4 d5
    'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': [
      { from: [1,2], to: [3,2], w: 45 }, // c4 (Queen's Gambit)
      { from: [0,6], to: [2,5], w: 30 }, // Nf3
      { from: [0,1], to: [2,2], w: 15 }, // Nc3
    ],
    // After 1.d4 Nf6
    'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq': [
      { from: [1,2], to: [3,2], w: 40 }, // c4
      { from: [0,6], to: [2,5], w: 30 }, // Nf3
      { from: [0,2], to: [3,5], w: 15 }, // Bg5
    ],
  };

  class ChessAI {
    constructor(engine) {
      this.engine = engine;
      this.nodesSearched = 0;
    }

    findBestMove(difficulty) {
      this.nodesSearched = 0;
      const startTime = Date.now();
      const timeLimit = AI_TIME_LIMIT[difficulty];

      // Opening book check for expert (use position + turn + castling only for matching)
      if (difficulty === 'expert') {
        const fen = this.engine.getFEN();
        const bookKey = fen.split(' ').slice(0, 3).join(' ');
        const bookMoves = OPENING_BOOK[bookKey];
        if (bookMoves && bookMoves.length > 0) {
          // Weighted random from top 3
          const sorted = bookMoves.sort((a, b) => b.w - a.w).slice(0, 3);
          const totalW = sorted.reduce((s, m) => s + m.w, 0);
          let r = Math.random() * totalW;
          for (const m of sorted) {
            r -= m.w;
            if (r <= 0) {
              // Verify it's legal
              const legal = this.engine.getLegalMoves(m.from[0], m.from[1]);
              const match = legal.find(l => l.to[0] === m.to[0] && l.to[1] === m.to[1]);
              if (match) return match;
              break;
            }
          }
        }
      }

      const depth = AI_DEPTH[difficulty];
      const moves = this.engine.getLegalMoves();
      if (moves.length === 0) return null;
      if (moves.length === 1) return moves[0];

      if (difficulty === 'easy') {
        return this._easyMove(moves);
      }

      // Order moves for better pruning
      const ordered = this._orderMoves(moves);

      let bestMove = ordered[0];
      let bestScore = -Infinity;
      let secondBestMove = null;
      let secondBestScore = -Infinity;
      let alpha = -Infinity;
      const beta = Infinity;

      for (const move of ordered) {
        const undo = this.engine._applyMoveRaw(move);
        const score = -this._alphaBeta(depth - 1, -beta, -alpha, startTime, timeLimit);
        this.engine._undoMoveRaw(undo);

        if (score > bestScore) {
          secondBestScore = bestScore;
          secondBestMove = bestMove;
          bestScore = score;
          bestMove = move;
        } else if (score > secondBestScore) {
          secondBestScore = score;
          secondBestMove = move;
        }
        if (score > alpha) alpha = score;

        // Time check
        if (Date.now() - startTime > timeLimit) break;
      }

      // Medium AI blundering: 20% chance to play 2nd-best move
      // This smooths the Easy→Medium difficulty gap significantly
      if (difficulty === 'medium' && secondBestMove && Math.random() < 0.2) {
        return secondBestMove;
      }

      return bestMove;
    }

    _easyMove(moves) {
      // Prefer captures, but mostly random
      const captures = moves.filter(m => m.capture);
      if (captures.length > 0 && Math.random() < 0.5) {
        return captures[Math.floor(Math.random() * captures.length)];
      }
      return moves[Math.floor(Math.random() * moves.length)];
    }

    _alphaBeta(depth, alpha, beta, startTime, timeLimit) {
      this.nodesSearched++;

      if (this.engine.isCheckmate()) return -PIECE_VALUES.k;
      if (this.engine.isDraw()) return 0;
      if (depth <= 0) return this._quiescence(alpha, beta, 4);

      // Time check every 1000 nodes
      if (this.nodesSearched % 1000 === 0 && Date.now() - startTime > timeLimit) {
        return this._evaluate();
      }

      const moves = this._orderMoves(this.engine.getLegalMoves());
      if (moves.length === 0) {
        return this.engine.isCheck() ? -PIECE_VALUES.k : 0;
      }

      for (const move of moves) {
        const undo = this.engine._applyMoveRaw(move);
        const score = -this._alphaBeta(depth - 1, -beta, -alpha, startTime, timeLimit);
        this.engine._undoMoveRaw(undo);

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }

      return alpha;
    }

    _quiescence(alpha, beta, depthLeft) {
      this.nodesSearched++;
      const standPat = this._evaluate();

      if (depthLeft === 0) return standPat;
      if (standPat >= beta) return beta;
      if (standPat > alpha) alpha = standPat;

      // Only search captures
      const moves = this.engine.getLegalMoves().filter(m => m.capture);
      const ordered = this._orderMoves(moves);

      for (const move of ordered) {
        const undo = this.engine._applyMoveRaw(move);
        const score = -this._quiescence(-beta, -alpha, depthLeft - 1);
        this.engine._undoMoveRaw(undo);

        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }

      return alpha;
    }

    _orderMoves(moves) {
      return moves.sort((a, b) => {
        let scoreA = 0, scoreB = 0;

        // Captures first (MVV-LVA)
        if (a.capture) {
          const victim = this.engine.board[a.to[0]][a.to[1]];
          const attacker = this.engine.board[a.from[0]][a.from[1]];
          scoreA += (victim ? PIECE_VALUES[victim.type] : 100) * 10 -
                    (attacker ? PIECE_VALUES[attacker.type] : 0);
        }
        if (b.capture) {
          const victim = this.engine.board[b.to[0]][b.to[1]];
          const attacker = this.engine.board[b.from[0]][b.from[1]];
          scoreB += (victim ? PIECE_VALUES[victim.type] : 100) * 10 -
                    (attacker ? PIECE_VALUES[attacker.type] : 0);
        }

        // Promotions
        if (a.promotion) scoreA += 900;
        if (b.promotion) scoreB += 900;

        // Castling
        if (a.castle) scoreA += 50;
        if (b.castle) scoreB += 50;

        return scoreB - scoreA;
      });
    }

    _evaluate() {
      let score = 0;
      const color = this.engine.turn;
      const sign = color === WHITE ? 1 : -1;

      // Count pieces to detect endgame
      let totalPieces = 0;
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (this.engine.board[r][c] && this.engine.board[r][c].type !== 'k')
            totalPieces++;
      const isEndgame = totalPieces <= 10;

      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = this.engine.board[r][c];
          if (!piece) continue;

          const val = PIECE_VALUES[piece.type];
          const psIdx = piece.color === WHITE ? r * 8 + c : (7 - r) * 8 + c;
          let pstKey = piece.type;
          if (piece.type === 'k' && isEndgame) pstKey = 'k_end';
          const positional = PST[pstKey] ? PST[pstKey][psIdx] : 0;

          if (piece.color === color) {
            score += val + positional;
          } else {
            score -= val + positional;
          }
        }
      }

      // Mobility bonus (simple count of legal moves)
      const myMoves = this.engine.getLegalMoves().length;
      score += myMoves * 5;

      return score;
    }
  }

  /* ================================================================
     3. ELO RATING
     ================================================================ */
  class EloSystem {
    constructor() {
      this.rating = parseInt(localStorage.getItem('chess3d-elo')) || 800;
      this.gamesPlayed = 0;
      this._loadStats();
    }

    _loadStats() {
      try {
        const stats = JSON.parse(localStorage.getItem('chess3d-stats') || '{}');
        this.gamesPlayed = stats.gamesPlayed || 0;
        this.wins = stats.wins || 0;
        this.losses = stats.losses || 0;
        this.draws = stats.draws || 0;
        this.streak = stats.streak || 0;
        this.bestStreak = stats.bestStreak || 0;
      } catch (e) {
        this.gamesPlayed = 0;
        this.wins = 0;
        this.losses = 0;
        this.draws = 0;
        this.streak = 0;
        this.bestStreak = 0;
      }
    }

    _saveStats() {
      localStorage.setItem('chess3d-elo', this.rating.toString());
      localStorage.setItem('chess3d-stats', JSON.stringify({
        gamesPlayed: this.gamesPlayed,
        wins: this.wins,
        losses: this.losses,
        draws: this.draws,
        streak: this.streak,
        bestStreak: this.bestStreak
      }));
    }

    getKFactor() {
      if (this.gamesPlayed < 20) return 32;
      if (this.rating < 1000) return 32;
      if (this.rating <= 1800) return 24;
      return 16;
    }

    calculateNewRating(opponentElo, result) {
      // result: 1 = win, 0.5 = draw, 0 = loss
      const expected = 1 / (1 + Math.pow(10, (opponentElo - this.rating) / 400));
      const K = this.getKFactor();
      const delta = Math.round(K * (result - expected));
      const oldRating = this.rating;
      this.rating = Math.max(100, this.rating + delta);
      this.gamesPlayed++;

      if (result === 1) {
        this.wins++;
        this.streak = Math.max(0, this.streak) + 1;
      } else if (result === 0) {
        this.losses++;
        this.streak = Math.min(0, this.streak) - 1;
      } else {
        this.draws++;
        this.streak = 0;
      }
      this.bestStreak = Math.max(this.bestStreak, this.streak);

      this._saveStats();
      return { oldRating, newRating: this.rating, delta, expected };
    }

    getTier() {
      const r = this.rating;
      if (r >= 2000) return { name: 'Grandmaster', badge: '\u2654', color: '#C9A84C' };
      if (r >= 1800) return { name: 'King', badge: '\u265A', color: '#B9F2FF' };
      if (r >= 1600) return { name: 'Queen', badge: '\u265B', color: '#E5E4E2' };
      if (r >= 1400) return { name: 'Rook', badge: '\u265C', color: '#FFD700' };
      if (r >= 1200) return { name: 'Bishop', badge: '\u265D', color: '#C0C0C0' };
      if (r >= 1000) return { name: 'Knight', badge: '\u265E', color: '#CD7F32' };
      return { name: 'Pawn', badge: '\u265F', color: '#808080' };
    }
  }

  /* ================================================================
     4. SOUND MANAGER
     ================================================================ */
  class SoundManager {
    constructor() {
      this.ctx = null;
      this.muted = localStorage.getItem('chess3d-mute') === 'true';
      this.volume = parseFloat(localStorage.getItem('chess3d-volume') || '0.5');
      this._noiseBuffer = null;  // Pre-allocated noise buffer
      this._activeSounds = 0;
      this._MAX_SIMULTANEOUS = 4;
      this._lastPlayTime = {};   // Debounce tracker

      // Pause audio when tab is hidden
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) this.ctx.suspend();
        else this.ctx.resume();
      });
    }

    _ensureContext() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        // Pre-allocate noise buffer for capture sounds (avoids GC pressure)
        const bufferSize = this.ctx.sampleRate * 0.15;
        this._noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = this._noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.muted = !this.muted;
      localStorage.setItem('chess3d-mute', this.muted.toString());

      // Stop/start ambient music on toggle
      if (this.muted) {
        stopAmbientMusic();
        // Suspend audio context to fully silence everything
        if (this.ctx && this.ctx.state === 'running') {
          this.ctx.suspend();
        }
      } else {
        // Resume audio context
        if (this.ctx && this.ctx.state === 'suspended') {
          this.ctx.resume();
        }
        // Restart ambient if game is active
        if (typeof gameActive !== 'undefined' && gameActive) {
          startAmbientMusic();
        }
      }

      return !this.muted;
    }

    play(type) {
      if (this.muted) return;
      try { this._ensureContext(); } catch (e) { return; }

      // Debounce: min 50ms between same sound type
      const now = performance.now();
      if (this._lastPlayTime[type] && now - this._lastPlayTime[type] < 50) return;
      this._lastPlayTime[type] = now;

      // Limit simultaneous sounds
      if (this._activeSounds >= this._MAX_SIMULTANEOUS) return;

      switch (type) {
        case 'move': this._playTone(300, 0.08, 'triangle', 0.25); break;
        case 'capture': this._playNoise(0.15, 600, 0.35); break;
        // Tiered captures by piece importance
        case 'capture-pawn': this._playNoise(0.1, 400, 0.2); break;
        case 'capture-knight':
        case 'capture-bishop': this._playNoise(0.15, 600, 0.3); this._playTone(500, 0.1, 'triangle', 0.15); break;
        case 'capture-rook': this._playNoise(0.2, 800, 0.35); this._playChime([400, 500], 0.15, 0.2); break;
        case 'capture-queen': this._playNoise(0.25, 1000, 0.4); this._playChime([523, 659, 784], 0.2, 0.3); break;
        case 'check': this._playChime([880, 1100], 0.3, 0.3); break;
        case 'checkmate': this._playChime([440, 554, 659], 0.5, 0.4); break;
        case 'castle': this._playTone(280, 0.06, 'triangle', 0.2); setTimeout(() => this._playTone(320, 0.06, 'triangle', 0.2), 80); break;
        case 'promotion': this._playChime([523, 659, 784, 1047], 0.12, 0.25); break;
        case 'win': this._playChime([440, 554, 659, 880], 0.4, 0.4); break;
        case 'loss': this._playChime([440, 370, 330], 0.4, 0.35); break;
        case 'draw': this._playChime([440, 494, 554], 0.5, 0.3); break;
        case 'click': this._playTone(800, 0.02, 'sine', 0.15); break;
        case 'error': this._playTone(150, 0.15, 'square', 0.2); break;
        // Timeout / auto-move sounds
        case 'timeout': this._playChime([440, 330, 220], 0.2, 0.3); break; // Descending warning
        case 'timeout-warning': this._playChime([880, 880], 0.1, 0.25); setTimeout(() => this._playChime([880, 880], 0.1, 0.25), 300); break; // Urgent double beep
        case 'opponent-timeout': this._playTone(600, 0.12, 'triangle', 0.2); break; // Neutral notification
      }
    }

    _playTone(freq, duration, type, vol) {
      this._activeSounds++;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.01);
      osc.onended = () => { this._activeSounds--; };
    }

    _playNoise(duration, filterFreq, vol) {
      this._activeSounds++;
      const source = this.ctx.createBufferSource();
      source.buffer = this._noiseBuffer; // Reuse pre-allocated buffer
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(vol * this.volume, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      source.connect(filter).connect(gain).connect(this.ctx.destination);
      source.start();
      source.stop(this.ctx.currentTime + duration + 0.01);
      source.onended = () => { this._activeSounds--; };
    }

    _playChime(freqs, noteDur, vol) {
      freqs.forEach((freq, i) => {
        setTimeout(() => this._playTone(freq, noteDur, 'sine', vol), i * noteDur * 1000 * 0.7);
      });
    }
  }

  /* ================================================================
     5. MULTIPLAYER INTERFACE (STUB)
     ================================================================ */
  class MultiplayerManager {
    constructor() { this.connected = false; }
    connect(roomId) { console.log('[Chess3D] Multiplayer not yet implemented'); }
    disconnect() { this.connected = false; }
    sendMove(from, to, promotion) { /* stub */ }
    onOpponentMove(callback) { /* stub */ }
    offerDraw() { /* stub */ }
    resign() { /* stub */ }
  }

  /* ================================================================
     6. BABYLON.JS 3D SCENE
     ================================================================ */

  let engine3d, scene, camera;
  let boardMeshes = [];
  let pieceMeshes = {}; // { 'r0c0': mesh }
  let highlightMeshes = [];
  let lastMoveHighlights = [];
  let checkHighlight = null;
  let selectedSquare = null;

  function initBabylon(canvas) {
    engine3d = new BABYLON.Engine(canvas, true, {
      powerPreference: 'high-performance',
      adaptToDeviceRatio: true,
      antialias: true
    });

    scene = new BABYLON.Scene(engine3d);
    scene.clearColor = new BABYLON.Color4(0.11, 0.11, 0.18, 1);
    scene.ambientColor = new BABYLON.Color3(0.1, 0.1, 0.15);

    // Camera — adapt to viewport aspect ratio
    const aspect = canvas.width / canvas.height;
    const isPortrait = aspect < 0.7;
    // Portrait: more top-down angle (higher beta) + moderate zoom to fit board width
    const camRadius = isPortrait ? 23 : 22;
    const camBeta = isPortrait ? Math.PI / 2.8 : Math.PI / 3.5; // More overhead on portrait
    camera = new BABYLON.ArcRotateCamera('cam', Math.PI / 4, camBeta, camRadius, new BABYLON.Vector3(3.5, 0, 3.5), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = isPortrait ? 12 : 10;
    camera.upperRadiusLimit = 35;
    camera.lowerBetaLimit = Math.PI / 6;
    camera.upperBetaLimit = Math.PI / 2.2;
    camera.wheelPrecision = 20;
    camera.panningSensibility = 200;
    camera.pinchPrecision = 40;

    // Lighting
    const hemiLight = new BABYLON.HemisphericLight('hemi', new BABYLON.Vector3(0, 1, 0), scene);
    hemiLight.intensity = 0.45;
    hemiLight.diffuse = new BABYLON.Color3(0.9, 0.85, 0.8);

    const dirLight = new BABYLON.DirectionalLight('dir', new BABYLON.Vector3(-1, -2, -1), scene);
    dirLight.position = new BABYLON.Vector3(8, 15, 8);
    dirLight.intensity = 0.8;
    dirLight.diffuse = new BABYLON.Color3(1, 0.95, 0.88);

    // Shadows (on capable devices)
    let shadowGen = null;
    try {
      if (!detectLowPerf()) {
        shadowGen = new BABYLON.ShadowGenerator(1024, dirLight);
        shadowGen.useBlurExponentialShadowMap = true;
        shadowGen.blurKernel = 16;
      }
    } catch (e) { /* no shadows */ }

    // Build board
    buildBoard(scene, shadowGen);

    // Render loop
    engine3d.runRenderLoop(() => scene.render());
    const resizeHandler = () => engine3d.resize();
    window.addEventListener('resize', resizeHandler);
    // Clean up on page unload (Astro SPA navigation)
    window.addEventListener('beforeunload', () => {
      window.removeEventListener('resize', resizeHandler);
      scene.dispose();
      engine3d.dispose();
    });

    return { engine: engine3d, scene, camera, shadowGen };
  }

  function detectLowPerf() {
    if (navigator.deviceMemory !== undefined && navigator.deviceMemory < 4) return true;
    if (navigator.hardwareConcurrency !== undefined && navigator.hardwareConcurrency < 4) return true;
    return /iPhone OS (9|10|11|12)_/.test(navigator.userAgent) || /Android [4-7]\./.test(navigator.userAgent);
  }

  function buildBoard(scene, shadowGen) {
    // Base
    const base = BABYLON.MeshBuilder.CreateBox('boardBase', { width: 9, height: 0.5, depth: 9 }, scene);
    base.position = new BABYLON.Vector3(3.5, -0.3, 3.5);
    const baseMat = new BABYLON.PBRMaterial('baseMat', scene);
    const frameTheme = BOARD_THEMES[currentTheme] || BOARD_THEMES.classic;
    baseMat.albedoColor = _hexToColor3(frameTheme.frame);
    baseMat.metallic = 0.05;
    baseMat.roughness = 0.85;
    base.material = baseMat;
    base.receiveShadows = true;

    // Squares
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const sq = BABYLON.MeshBuilder.CreatePlane('sq_' + r + '_' + c, { size: 1 }, scene);
        sq.rotation.x = Math.PI / 2;
        sq.position = new BABYLON.Vector3(c, 0.01, r);

        const mat = new BABYLON.PBRMaterial('sqMat_' + r + '_' + c, scene);
        mat.albedoColor = (r + c) % 2 === 0 ? COL_DARK_SQ.clone() : COL_LIGHT_SQ.clone();
        mat.metallic = 0;
        mat.roughness = 0.8;
        sq.material = mat;
        sq.receiveShadows = true;

        // Store metadata for picking
        sq.metadata = { type: 'square', row: r, col: c };

        boardMeshes.push(sq);
      }
    }

    // Rank/file labels (text on board edge)
    for (let i = 0; i < 8; i++) {
      _createLabel(FILE_NAMES[i], new BABYLON.Vector3(i, -0.04, -0.7), scene);
      _createLabel(RANK_NAMES[i], new BABYLON.Vector3(-0.7, -0.04, i), scene);
    }

    // Ground plane for environment
    const ground = BABYLON.MeshBuilder.CreateGround('ground', { width: 40, height: 40 }, scene);
    ground.position.y = -0.55;
    const groundMat = new BABYLON.PBRMaterial('groundMat', scene);
    groundMat.albedoColor = new BABYLON.Color3(0.08, 0.08, 0.12);
    groundMat.metallic = 0;
    groundMat.roughness = 1;
    ground.material = groundMat;
    ground.receiveShadows = true;
  }

  function _createLabel(text, position, scene) {
    const plane = BABYLON.MeshBuilder.CreatePlane('label_' + text, { size: 0.4 }, scene);
    plane.rotation.x = Math.PI / 2;
    plane.position = position;

    const tex = new BABYLON.DynamicTexture('dtex_' + text, { width: 64, height: 64 }, scene);
    const ctx2d = tex.getContext();
    ctx2d.fillStyle = 'transparent';
    ctx2d.fillRect(0, 0, 64, 64);
    ctx2d.font = 'bold 36px Arial';
    ctx2d.fillStyle = '#8A8099';
    ctx2d.textAlign = 'center';
    ctx2d.textBaseline = 'middle';
    ctx2d.fillText(text, 32, 32);
    tex.update();
    tex.hasAlpha = true;

    const mat = new BABYLON.StandardMaterial('labelMat_' + text, scene);
    mat.diffuseTexture = tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = new BABYLON.Color3(0.5, 0.5, 0.5);
    mat.disableLighting = true;
    plane.material = mat;
  }

  /* ================================================================
     7. PIECE MESH CREATION
     ================================================================ */

  const pieceMasters = {};

  function createPieceMasters(scene, shadowGen) {
    const types = ['p', 'r', 'n', 'b', 'q', 'k'];
    const colors = [WHITE, BLACK];

    for (const color of colors) {
      for (const type of types) {
        const key = color + type;
        const mesh = _buildPieceMesh(type, color, scene);
        mesh.isVisible = false;
        mesh.metadata = { type: 'pieceMaster' };
        pieceMasters[key] = mesh;

        if (shadowGen) {
          shadowGen.addShadowCaster(mesh);
        }
      }
    }
  }

  function _buildPieceMesh(type, color, scene) {
    const mat = new BABYLON.PBRMaterial('pmat_' + color + type, scene);
    mat.albedoColor = color === WHITE ? COL_WHITE_PIECE.clone() : COL_BLACK_PIECE.clone();
    mat.metallic = 0.1;
    mat.roughness = 0.65;
    if (color === BLACK) {
      mat.metallic = 0.15;
      mat.roughness = 0.55;
    }

    let mesh;

    if (currentSkin === 'minimal') {
      mesh = _createMinimalPieceMesh(type, scene);
    } else {
      switch (type) {
        case 'p': mesh = _createPawnMesh(scene); break;
        case 'r': mesh = _createRookMesh(scene); break;
        case 'n': mesh = _createKnightMesh(scene); break;
        case 'b': mesh = _createBishopMesh(scene); break;
        case 'q': mesh = _createQueenMesh(scene); break;
        case 'k': mesh = _createKingMesh(scene); break;
      }
    }

    mesh.material = mat;
    mesh.name = 'master_' + color + type;

    // Royal skin: scale 1.2x Y and add gold torus ring at base
    if (currentSkin === 'royal') {
      mesh.scaling.y = 1.2;
      const ring = BABYLON.MeshBuilder.CreateTorus('royalRing_' + color + type, { diameter: 0.55, thickness: 0.04, tessellation: 20 }, scene);
      ring.position.y = 0.02;
      const goldMat = new BABYLON.PBRMaterial('goldTrim_' + color + type, scene);
      goldMat.albedoColor = new BABYLON.Color3(0.83, 0.69, 0.22);
      goldMat.metallic = 0.8;
      goldMat.roughness = 0.2;
      ring.material = goldMat;
      ring.parent = mesh;
    }

    return mesh;
  }

  function _createMinimalPieceMesh(type, scene) {
    // Minimal skin: clean geometric shapes, each piece has a unique top
    const parts = [];

    // All pieces share a flat base disc
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.1, diameter: 0.5, tessellation: 20 }, scene);
    base.position.y = 0.05;
    parts.push(base);

    switch (type) {
      case 'p': {
        // Pawn: short cylinder + small sphere
        const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.3, diameter: 0.28, tessellation: 16 }, scene);
        body.position.y = 0.25;
        const head = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.24, segments: 12 }, scene);
        head.position.y = 0.48;
        parts.push(body, head);
        break;
      }
      case 'r': {
        // Rook: thick cylinder + flat wide disc on top (battlement)
        const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.5, diameter: 0.34, tessellation: 16 }, scene);
        body.position.y = 0.35;
        const top = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.08, diameter: 0.42, tessellation: 8 }, scene);
        top.position.y = 0.64;
        parts.push(body, top);
        break;
      }
      case 'n': {
        // Knight: cylinder + angled flat box (L-shape head)
        const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.4, diameter: 0.3, tessellation: 16 }, scene);
        body.position.y = 0.3;
        const head = BABYLON.MeshBuilder.CreateBox('', { width: 0.18, height: 0.28, depth: 0.32 }, scene);
        head.position.y = 0.6;
        head.position.z = 0.06;
        head.rotation.x = -0.2;
        parts.push(body, head);
        break;
      }
      case 'b': {
        // Bishop: tapered cylinder + pointed cone tip
        const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.5, diameterTop: 0.18, diameterBottom: 0.3, tessellation: 16 }, scene);
        body.position.y = 0.35;
        const tip = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.2, diameterTop: 0, diameterBottom: 0.16, tessellation: 12 }, scene);
        tip.position.y = 0.7;
        parts.push(body, tip);
        break;
      }
      case 'q': {
        // Queen: tall tapered + torus ring + small sphere
        const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.55, diameterTop: 0.2, diameterBottom: 0.32, tessellation: 16 }, scene);
        body.position.y = 0.38;
        const crown = BABYLON.MeshBuilder.CreateTorus('', { diameter: 0.24, thickness: 0.04, tessellation: 16 }, scene);
        crown.position.y = 0.72;
        const orb = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.12, segments: 10 }, scene);
        orb.position.y = 0.82;
        parts.push(body, crown, orb);
        break;
      }
      case 'k': {
        // King: tallest tapered + cross on top
        const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.6, diameterTop: 0.22, diameterBottom: 0.34, tessellation: 16 }, scene);
        body.position.y = 0.4;
        const crossV = BABYLON.MeshBuilder.CreateBox('', { width: 0.08, height: 0.25, depth: 0.08 }, scene);
        crossV.position.y = 0.83;
        const crossH = BABYLON.MeshBuilder.CreateBox('', { width: 0.2, height: 0.08, depth: 0.08 }, scene);
        crossH.position.y = 0.88;
        parts.push(body, crossV, crossH);
        break;
      }
    }

    return BABYLON.Mesh.MergeMeshes(parts, true, true, undefined, false, true);
  }

  function _createPawnMesh(scene) {
    // Short piece: wide base, narrow stem, ball head
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.15, diameter: 0.55, tessellation: 16 }, scene);
    base.position.y = 0.075;
    const collar = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.08, diameterTop: 0.3, diameterBottom: 0.45, tessellation: 16 }, scene);
    collar.position.y = 0.19;
    const stem = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.25, diameterTop: 0.2, diameterBottom: 0.28, tessellation: 12 }, scene);
    stem.position.y = 0.36;
    const head = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.28, segments: 14 }, scene);
    head.position.y = 0.56;
    return BABYLON.Mesh.MergeMeshes([base, collar, stem, head], true, true, undefined, false, true);
  }

  function _createRookMesh(scene) {
    // Castle tower: wide base, thick body, flat crenellated top
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.15, diameter: 0.6, tessellation: 16 }, scene);
    base.position.y = 0.075;
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.55, diameterTop: 0.4, diameterBottom: 0.45, tessellation: 16 }, scene);
    body.position.y = 0.42;
    const rim = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.08, diameter: 0.5, tessellation: 16 }, scene);
    rim.position.y = 0.74;
    const top = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.12, diameter: 0.46, tessellation: 8 }, scene); // 8-sided = more angular
    top.position.y = 0.84;
    return BABYLON.Mesh.MergeMeshes([base, body, rim, top], true, true, undefined, false, true);
  }

  function _createKnightMesh(scene) {
    // Horse head: base, angled neck, distinctive angular head
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.15, diameter: 0.55, tessellation: 16 }, scene);
    base.position.y = 0.075;
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.45, diameterTop: 0.25, diameterBottom: 0.4, tessellation: 12 }, scene);
    body.position.y = 0.35;
    // Angled horse head
    const neck = BABYLON.MeshBuilder.CreateBox('', { width: 0.22, height: 0.4, depth: 0.3 }, scene);
    neck.position.y = 0.72;
    neck.position.z = 0.06;
    neck.rotation.x = -0.25;
    // Muzzle
    const muzzle = BABYLON.MeshBuilder.CreateBox('', { width: 0.16, height: 0.15, depth: 0.22 }, scene);
    muzzle.position.y = 0.78;
    muzzle.position.z = 0.2;
    muzzle.rotation.x = -0.1;
    return BABYLON.Mesh.MergeMeshes([base, body, neck, muzzle], true, true, undefined, false, true);
  }

  function _createBishopMesh(scene) {
    // Tall tapered piece with pointed mitre top
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.15, diameter: 0.55, tessellation: 16 }, scene);
    base.position.y = 0.075;
    const collar = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.08, diameterTop: 0.32, diameterBottom: 0.45, tessellation: 16 }, scene);
    collar.position.y = 0.19;
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.55, diameterTop: 0.15, diameterBottom: 0.3, tessellation: 16 }, scene);
    body.position.y = 0.52;
    // Mitre (pointed bishop hat)
    const mitre = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.22, diameterTop: 0.0, diameterBottom: 0.18, tessellation: 12 }, scene);
    mitre.position.y = 0.91;
    const ball = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.1, segments: 8 }, scene);
    ball.position.y = 1.05;
    return BABYLON.Mesh.MergeMeshes([base, collar, body, mitre, ball], true, true, undefined, false, true);
  }

  function _createQueenMesh(scene) {
    // Tall elegant piece with crown ring and orb
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.15, diameter: 0.6, tessellation: 16 }, scene);
    base.position.y = 0.075;
    const collar = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.08, diameterTop: 0.38, diameterBottom: 0.5, tessellation: 16 }, scene);
    collar.position.y = 0.19;
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.6, diameterTop: 0.2, diameterBottom: 0.36, tessellation: 16 }, scene);
    body.position.y = 0.53;
    const rim = BABYLON.MeshBuilder.CreateTorus('', { diameter: 0.28, thickness: 0.05, tessellation: 20 }, scene);
    rim.position.y = 0.9;
    const crown = BABYLON.MeshBuilder.CreateTorus('', { diameter: 0.22, thickness: 0.04, tessellation: 16 }, scene);
    crown.position.y = 0.98;
    const orb = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.14, segments: 10 }, scene);
    orb.position.y = 1.08;
    return BABYLON.Mesh.MergeMeshes([base, collar, body, rim, crown, orb], true, true, undefined, false, true);
  }

  function _createKingMesh(scene) {
    // Tallest piece with prominent cross on top
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.15, diameter: 0.6, tessellation: 16 }, scene);
    base.position.y = 0.075;
    const collar = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.08, diameterTop: 0.4, diameterBottom: 0.5, tessellation: 16 }, scene);
    collar.position.y = 0.19;
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.65, diameterTop: 0.22, diameterBottom: 0.38, tessellation: 16 }, scene);
    body.position.y = 0.56;
    const rim = BABYLON.MeshBuilder.CreateTorus('', { diameter: 0.3, thickness: 0.05, tessellation: 20 }, scene);
    rim.position.y = 0.95;
    // Prominent cross
    const crossV = BABYLON.MeshBuilder.CreateBox('', { width: 0.1, height: 0.32, depth: 0.1 }, scene);
    crossV.position.y = 1.18;
    const crossH = BABYLON.MeshBuilder.CreateBox('', { width: 0.26, height: 0.1, depth: 0.1 }, scene);
    crossH.position.y = 1.24;
    return BABYLON.Mesh.MergeMeshes([base, collar, body, rim, crossV, crossH], true, true, undefined, false, true);
  }

  function placePiecesFromBoard(chessEngine, scene, shadowGen) {
    // Clear existing pieces
    for (const key of Object.keys(pieceMeshes)) {
      if (pieceMeshes[key]) pieceMeshes[key].dispose();
    }
    pieceMeshes = {};

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = chessEngine.getPieceAt(r, c);
        if (!piece) continue;
        const meshKey = 'r' + r + 'c' + c;
        const masterKey = piece.color + piece.type;
        const master = pieceMasters[masterKey];
        if (!master) continue;

        const instance = master.createInstance('piece_' + meshKey);
        instance.position = new BABYLON.Vector3(c, 0.15, r);
        instance.metadata = { type: 'piece', row: r, col: c, pieceType: piece.type, pieceColor: piece.color };
        instance.isPickable = true;
        pieceMeshes[meshKey] = instance;

        if (shadowGen) shadowGen.addShadowCaster(instance);
      }
    }
  }

  // --- Move animation ---
  function animatePieceMove(fromRow, fromCol, toRow, toCol, callback) {
    const key = 'r' + fromRow + 'c' + fromCol;
    const mesh = pieceMeshes[key];
    if (!mesh) { if (callback) callback(); return; }

    const startPos = mesh.position.clone();
    const endPos = new BABYLON.Vector3(toCol, 0.15, toRow);
    const dist = BABYLON.Vector3.Distance(startPos, endPos);
    const peakH = 0.15 + dist * 0.15;

    // Dispose captured piece mesh at destination
    const destKey = 'r' + toRow + 'c' + toCol;
    if (pieceMeshes[destKey]) {
      pieceMeshes[destKey].dispose();
      delete pieceMeshes[destKey];
    }

    // Update key mapping
    delete pieceMeshes[key];
    pieceMeshes[destKey] = mesh;

    // Check for reduced motion
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      mesh.position = endPos;
      if (callback) callback();
      return;
    }

    // Create trail behind the moving piece using Babylon TrailMesh
    let trail = null;
    try {
      trail = new BABYLON.TrailMesh('moveTrail', mesh, scene, 0.12, 20, true);
      const trailMat = new BABYLON.StandardMaterial('trailMat', scene);
      trailMat.emissiveColor = COL_GOLD ? COL_GOLD.clone() : new BABYLON.Color3(0.79, 0.66, 0.30);
      trailMat.alpha = 0.4;
      trailMat.disableLighting = true;
      trailMat.backFaceCulling = false;
      trail.material = trailMat;
    } catch (e) { /* TrailMesh may not be available in older Babylon versions */ }

    const duration = 36; // frames (~600ms at 60fps)
    let frame = 0;

    const observer = scene.onBeforeRenderObservable.add(() => {
      frame++;
      const t = Math.min(frame / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      mesh.position.x = startPos.x + (endPos.x - startPos.x) * eased;
      mesh.position.z = startPos.z + (endPos.z - startPos.z) * eased;
      mesh.position.y = startPos.y + (endPos.y - startPos.y) * eased + Math.sin(eased * Math.PI) * peakH;

      // Fade trail out near the end
      if (trail && trail.material && t > 0.6) {
        trail.material.alpha = 0.4 * (1 - (t - 0.6) / 0.4);
      }

      if (t >= 1) {
        mesh.position = endPos;
        scene.onBeforeRenderObservable.remove(observer);
        // Dispose trail after a short delay for smooth fadeout
        if (trail) setTimeout(() => { try { trail.dispose(); } catch (e) {} }, 200);
        if (callback) callback();
      }
    });
  }

  // --- Highlights ---
  function clearHighlights() {
    for (const m of highlightMeshes) m.dispose();
    highlightMeshes = [];
  }

  function showLegalMoveHighlights(moves) {
    clearHighlights();
    const isMobile = window.innerWidth < 768;
    // Larger dots on mobile for easier tapping
    const moveRadius = isMobile ? 0.22 : 0.16;
    const captureRadius = isMobile ? 0.48 : 0.42;

    for (const move of moves) {
      const r = move.to[0], c = move.to[1];
      const isCapture = move.capture;

      const disc = BABYLON.MeshBuilder.CreateDisc('highlight', {
        radius: isCapture ? captureRadius : moveRadius,
        tessellation: 24
      }, scene);
      disc.rotation.x = Math.PI / 2;
      disc.position = new BABYLON.Vector3(c, 0.025, r);

      const mat = new BABYLON.StandardMaterial('hlMat', scene);
      if (isCapture) {
        mat.diffuseColor = COL_RED.clone();
        mat.alpha = 0.45;
      } else {
        mat.diffuseColor = COL_EMERALD.clone();
        mat.alpha = 0.55;
      }
      mat.disableLighting = true;
      disc.material = mat;
      disc.isPickable = false;
      highlightMeshes.push(disc);
    }
  }

  function showSelectedSquare(row, col) {
    const ring = BABYLON.MeshBuilder.CreateTorus('selRing', { diameter: 0.9, thickness: 0.06, tessellation: 24 }, scene);
    ring.rotation.x = Math.PI / 2;
    ring.position = new BABYLON.Vector3(col, 0.03, row);
    const mat = new BABYLON.StandardMaterial('selMat', scene);
    mat.diffuseColor = COL_GOLD.clone();
    mat.emissiveColor = COL_GOLD.clone();
    mat.alpha = 0.8;
    mat.disableLighting = true;
    ring.material = mat;
    ring.isPickable = false;
    highlightMeshes.push(ring);
  }

  // Last move highlight — destination square + gold glow ring on piece
  function showLastMove(fromRow, fromCol, toRow, toCol) {
    // Clear previous
    for (const m of lastMoveHighlights) {
      try { m.dispose(); } catch (e) {}
    }
    lastMoveHighlights = [];

    if (!scene) return;

    // Highlight ONLY the destination square (where the piece landed)
    const sq = BABYLON.MeshBuilder.CreatePlane('lastMove', { size: 0.98 }, scene);
    sq.rotation.x = Math.PI / 2;
    sq.position = new BABYLON.Vector3(toCol, 0.025, toRow);
    const sqMat = new BABYLON.StandardMaterial('lmMat', scene);
    sqMat.diffuseColor = new BABYLON.Color3(0.25, 0.5, 0.9);
    sqMat.emissiveColor = new BABYLON.Color3(0.2, 0.4, 0.8);
    sqMat.alpha = 0.5;
    sqMat.disableLighting = true;
    sqMat.zOffset = -2;
    sq.material = sqMat;
    sq.isPickable = false;
    lastMoveHighlights.push(sq);

    // Gold glow ring around the moved piece
    const ring = BABYLON.MeshBuilder.CreateTorus('lastMoveRing', {
      diameter: 0.7, thickness: 0.05, tessellation: 24
    }, scene);
    ring.rotation.x = Math.PI / 2;
    ring.position = new BABYLON.Vector3(toCol, 0.03, toRow);
    const ringMat = new BABYLON.StandardMaterial('lmRingMat', scene);
    const goldCol = COL_GOLD || new BABYLON.Color3(0.79, 0.66, 0.30);
    ringMat.diffuseColor = goldCol.clone();
    ringMat.emissiveColor = goldCol.clone();
    ringMat.alpha = 0.7;
    ringMat.disableLighting = true;
    ring.material = ringMat;
    ring.isPickable = false;
    lastMoveHighlights.push(ring);
  }

  function showCheckHighlight(row, col) {
    clearCheckHighlight();
    const ring = BABYLON.MeshBuilder.CreateTorus('checkRing', { diameter: 0.85, thickness: 0.07, tessellation: 24 }, scene);
    ring.rotation.x = Math.PI / 2;
    ring.position = new BABYLON.Vector3(col, 0.035, row);
    const mat = new BABYLON.StandardMaterial('checkMat', scene);
    mat.diffuseColor = COL_RED.clone();
    mat.emissiveColor = COL_RED.clone();
    mat.alpha = 0.8;
    mat.disableLighting = true;
    ring.material = mat;
    ring.isPickable = false;
    checkHighlight = ring;
  }

  function clearCheckHighlight() {
    if (checkHighlight) { checkHighlight.dispose(); checkHighlight = null; }
  }

  // Capture flash effect at a board position
  function showCaptureEffect(row, col, pieceType) {
    if (!scene) return;

    // Color intensity based on piece value
    const intensity = { p: 0.5, n: 0.7, b: 0.7, r: 0.85, q: 1.0 }[pieceType] || 0.5;
    const color = pieceType === 'q'
      ? new BABYLON.Color3(1.0, 0.84, 0.0)    // Gold for queen
      : pieceType === 'r'
        ? new BABYLON.Color3(0.9, 0.4, 0.1)   // Orange for rook
        : new BABYLON.Color3(1.0, 1.0, 1.0);  // White for others

    // Expanding ring
    const ring = BABYLON.MeshBuilder.CreateTorus('captureRing', {
      diameter: 0.6, thickness: 0.08, tessellation: 24
    }, scene);
    ring.position = new BABYLON.Vector3(col, 0.05, row);
    ring.isPickable = false;

    const mat = new BABYLON.StandardMaterial('captureMat', scene);
    mat.emissiveColor = color;
    mat.alpha = intensity;
    mat.disableLighting = true;
    ring.material = mat;

    // Animate: expand + fade out
    let frame = 0;
    const duration = 30; // frames
    const observer = scene.onBeforeRenderObservable.add(() => {
      frame++;
      const t = frame / duration;
      const scale = 1 + t * 2.5;
      ring.scaling = new BABYLON.Vector3(scale, 1, scale);
      mat.alpha = intensity * (1 - t);
      if (frame >= duration) {
        scene.onBeforeRenderObservable.remove(observer);
        ring.dispose();
        mat.dispose();
      }
    });

    // For queen/rook, add a second burst ring
    if (pieceType === 'q' || pieceType === 'r') {
      setTimeout(() => showCaptureRipple(row, col, color, intensity * 0.6), 100);
    }
  }

  function showCaptureRipple(row, col, color, intensity) {
    if (!scene) return;
    const ring = BABYLON.MeshBuilder.CreateTorus('ripple', {
      diameter: 0.4, thickness: 0.05, tessellation: 20
    }, scene);
    ring.position = new BABYLON.Vector3(col, 0.05, row);
    ring.isPickable = false;
    const mat = new BABYLON.StandardMaterial('rippleMat', scene);
    mat.emissiveColor = color;
    mat.alpha = intensity;
    mat.disableLighting = true;
    ring.material = mat;

    let frame = 0;
    const observer = scene.onBeforeRenderObservable.add(() => {
      frame++;
      const t = frame / 25;
      ring.scaling = new BABYLON.Vector3(1 + t * 3, 1, 1 + t * 3);
      mat.alpha = intensity * (1 - t);
      if (frame >= 25) {
        scene.onBeforeRenderObservable.remove(observer);
        ring.dispose();
        mat.dispose();
      }
    });
  }

  // Diff two board states to detect captures and moves
  let mpPreviousFen = null;

  function mpDetectChanges(newFen) {
    if (!mpPreviousFen || !newFen || mpPreviousFen === newFen) {
      mpPreviousFen = newFen;
      return null;
    }

    const oldEngine = new ChessEngine();
    oldEngine.loadFEN(mpPreviousFen);
    const newEngine = new ChessEngine();
    newEngine.loadFEN(newFen);
    const changes = { captured: null, movedFrom: null, movedTo: null, movedPiece: null, isCheck: false, isCastle: false };

    // Find squares that changed
    const emptied = []; // Had a piece, now empty or different
    const filled = [];  // Was empty, now has a piece (or replaced)

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const oldP = oldEngine.board[r][c];
        const newP = newEngine.board[r][c];

        const oldKey = oldP ? oldP.color + oldP.type : null;
        const newKey = newP ? newP.color + newP.type : null;

        if (oldKey !== newKey) {
          if (oldP && !newP) emptied.push({ r, c, piece: oldP });
          else if (!oldP && newP) filled.push({ r, c, piece: newP });
          else if (oldP && newP) {
            // Piece replaced (capture or promotion)
            emptied.push({ r, c, piece: oldP });
            filled.push({ r, c, piece: newP });
          }
        }
      }
    }

    // Determine from→to by matching emptied piece to filled location
    // Normal move: 1 emptied + 1 filled (same piece type/color)
    // Capture: 1 emptied (moved piece) + 1 emptied (captured) + 1 filled (moved piece at capture square)
    // Castle: 2 emptied + 2 filled
    if (emptied.length >= 2 && filled.length >= 2) {
      changes.isCastle = true;
    }

    for (const f of filled) {
      const match = emptied.find(e => e.piece.color === f.piece.color && e.piece.type === f.piece.type);
      if (match) {
        changes.movedFrom = { row: match.r, col: match.c };
        changes.movedTo = { row: f.r, col: f.c };
        changes.movedPiece = f.piece;
        break;
      }
    }

    // Detect capture: an opponent piece disappeared
    for (const e of emptied) {
      if (changes.movedPiece && e.piece.color !== changes.movedPiece.color) {
        changes.captured = { row: e.r, col: e.c, type: e.piece.type, color: e.piece.color };
      }
    }

    changes.isCheck = newEngine.isCheck();
    mpPreviousFen = newFen;
    return changes;
  }

  // Babylon.js move animation for multiplayer state updates
  function mpAnimateMove(fromRow, fromCol, toRow, toCol, callback) {
    const key = 'r' + fromRow + 'c' + fromCol;
    const mesh = pieceMeshes[key];
    console.log('[Chess3D] mpAnimateMove', key, mesh ? 'found' : 'NOT FOUND', Object.keys(pieceMeshes).length, 'meshes');
    if (!mesh) { if (callback) callback(); return; }

    const startPos = mesh.position.clone();
    const endPos = new BABYLON.Vector3(toCol, 0.15, toRow);
    const dist = BABYLON.Vector3.Distance(startPos, endPos);
    const peakH = 0.15 + dist * 0.12;

    // Update mesh key mapping
    const destKey = 'r' + toRow + 'c' + toCol;
    if (pieceMeshes[destKey] && pieceMeshes[destKey] !== mesh) {
      pieceMeshes[destKey].dispose();
    }
    delete pieceMeshes[key];
    pieceMeshes[destKey] = mesh;

    // Use Babylon animation system for smooth arc
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion) {
      mesh.position = endPos;
      if (callback) callback();
      return;
    }

    // Trail behind the moving piece
    let trail = null;
    try {
      trail = new BABYLON.TrailMesh('mpTrail', mesh, scene, 0.12, 20, true);
      const trailMat = new BABYLON.StandardMaterial('mpTrailMat', scene);
      trailMat.emissiveColor = COL_GOLD ? COL_GOLD.clone() : new BABYLON.Color3(0.79, 0.66, 0.30);
      trailMat.alpha = 0.4;
      trailMat.disableLighting = true;
      trailMat.backFaceCulling = false;
      trail.material = trailMat;
    } catch (e) { /* TrailMesh may not be available */ }

    const fps = 30;
    const frames = 24; // ~800ms

    // Position X animation
    const animX = new BABYLON.Animation('moveX', 'position.x', fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animX.setKeys([{ frame: 0, value: startPos.x }, { frame: frames, value: endPos.x }]);

    // Position Z animation
    const animZ = new BABYLON.Animation('moveZ', 'position.z', fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animZ.setKeys([{ frame: 0, value: startPos.z }, { frame: frames, value: endPos.z }]);

    // Arc Y animation (rise then fall)
    const animY = new BABYLON.Animation('moveY', 'position.y', fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animY.setKeys([
      { frame: 0, value: startPos.y },
      { frame: Math.floor(frames / 2), value: peakH },
      { frame: frames, value: endPos.y },
    ]);

    // Landing bounce — scale pulse
    const animScale = new BABYLON.Animation('bounce', 'scaling.y', fps, BABYLON.Animation.ANIMATIONTYPE_FLOAT, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT);
    animScale.setKeys([
      { frame: frames, value: 1.0 },
      { frame: frames + 4, value: 1.15 },
      { frame: frames + 8, value: 0.92 },
      { frame: frames + 12, value: 1.0 },
    ]);

    // Ease
    const ease = new BABYLON.CubicEase();
    ease.setEasingMode(BABYLON.EasingFunction.EASINGMODE_EASEINOUT);
    animX.setEasingFunction(ease);
    animZ.setEasingFunction(ease);

    mesh.animations = [animX, animZ, animY, animScale];
    scene.beginAnimation(mesh, 0, frames + 12, false, 1, () => {
      mesh.position = endPos;
      mesh.scaling = new BABYLON.Vector3(1, 1, 1);
      // Dispose trail after animation
      if (trail) setTimeout(() => { try { trail.dispose(); } catch (e) {} }, 200);
      if (callback) callback();
    });
  }

  // 3D captured pieces displayed on table sides
  let capturedMeshes3D = [];

  function placeCapturedPieces3D(engine) {
    // Dispose old captured meshes
    for (const m of capturedMeshes3D) { try { m.dispose(); } catch (e) {} }
    capturedMeshes3D = [];

    if (!scene || !pieceMasters) return;

    // Detect captured pieces by comparing current board to starting material
    // This works in both AI mode (moveHistory) and multiplayer (FEN only)
    const startingPieces = { w: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 }, b: { p: 8, r: 2, n: 2, b: 2, q: 1, k: 1 } };
    const currentPieces = { w: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 }, b: { p: 0, r: 0, n: 0, b: 0, q: 0, k: 0 } };

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (p) currentPieces[p.color][p.type]++;
      }
    }

    const captured = { w: [], b: [] };
    for (const color of [WHITE, BLACK]) {
      for (const type of ['q', 'r', 'b', 'n', 'p']) {
        const diff = (startingPieces[color][type] || 0) - (currentPieces[color][type] || 0);
        for (let i = 0; i < diff; i++) captured[color].push(type);
      }
    }

    // Place white's captured pieces (pieces that white lost) on the left side
    // Place black's captured pieces (pieces that black lost) on the right side
    const pieceOrder = ['q', 'r', 'r', 'b', 'b', 'n', 'n', 'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'];

    // Sort by value (most valuable first)
    const sortByValue = (a, b) => (PIECE_VALUES[b] || 0) - (PIECE_VALUES[a] || 0);

    // White pieces captured — displayed above the board (behind black's side)
    const whiteCaptured = captured.w.sort(sortByValue);
    whiteCaptured.forEach((type, i) => {
      const masterKey = WHITE + type;
      if (!pieceMasters[masterKey]) return;
      const mesh = pieceMasters[masterKey].createInstance('cap_w_' + i);
      const col = i % 8;
      const row = Math.floor(i / 8);
      mesh.position = new BABYLON.Vector3(col * 0.65 + 1.2, 0.1, 8.5 + row * 0.7);
      mesh.scaling = new BABYLON.Vector3(0.5, 0.5, 0.5);
      mesh.isPickable = false;
      capturedMeshes3D.push(mesh);
    });

    // Black pieces captured — displayed below the board (behind white's side)
    const blackCaptured = captured.b.sort(sortByValue);
    blackCaptured.forEach((type, i) => {
      const masterKey = BLACK + type;
      if (!pieceMasters[masterKey]) return;
      const mesh = pieceMasters[masterKey].createInstance('cap_b_' + i);
      const col = i % 8;
      const row = Math.floor(i / 8);
      mesh.position = new BABYLON.Vector3(col * 0.65 + 1.2, 0.1, -1.2 - row * 0.7);
      mesh.scaling = new BABYLON.Vector3(0.6, 0.6, 0.6);
      mesh.isPickable = false;
      capturedMeshes3D.push(mesh);
    });
  }

  function resetCamera(forBlack) {
    // White views from behind rank 1 (alpha ~225°), Black from behind rank 8 (alpha ~45°)
    const targetAlpha = forBlack ? Math.PI / 4 : Math.PI / 4 + Math.PI;
    const aspect = window.innerWidth / window.innerHeight;
    const isPortrait = aspect < 0.7;
    const targetBeta = isPortrait ? Math.PI / 3 : Math.PI / 3.5;
    const targetRadius = isPortrait ? 20 : 22;

    BABYLON.Animation.CreateAndStartAnimation('camAlpha', camera, 'alpha', 30, 20,
      camera.alpha, targetAlpha, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
      new BABYLON.CubicEase());
    BABYLON.Animation.CreateAndStartAnimation('camBeta', camera, 'beta', 30, 20,
      camera.beta, targetBeta, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
      new BABYLON.CubicEase());
    BABYLON.Animation.CreateAndStartAnimation('camRadius', camera, 'radius', 30, 20,
      camera.radius, targetRadius, BABYLON.Animation.ANIMATIONLOOPMODE_CONSTANT,
      new BABYLON.CubicEase());
  }

  /* ================================================================
     8. GAME CONTROLLER
     ================================================================ */
  let chessEngine, chessAI, elo, sound, multiplayer;
  let currentUser = null;
  let gameActive = false;
  let playerColor = WHITE;
  let aiDifficulty = 'medium';
  let gameStartTime = 0;
  let moveCount = 0;
  let isAnimating = false;
  let promotionResolve = null;
  let babylonSetup = null;

  // Multiplayer state
  let gameMode = 'ai'; // 'ai' or 'multiplayer'
  let mpSessionId = null;
  let mpIsHost = false;
  let mpLobby = null;
  let mpOpponentName = 'Opponent';
  let mpOpponentUid = null;
  let mpRematchSessionId = null; // Session created by opponent for rematch
  let mpTurnStartTime = 0;
  let mpTurnTimerInterval = null;
  let mpGameTimerInterval = null;
  let _mpQuickMatchTimeout = null;
  const MP_TURN_TIMEOUT = 120; // 2 min per turn (matches game-registry turnTimeoutSec)

  // DOM refs
  const $ = (id) => document.getElementById(id);

  function initGame() {
    initColors(); // Must init after Babylon.js is loaded

    chessEngine = new ChessEngine();
    chessAI = new ChessAI(chessEngine);
    elo = new EloSystem();
    sound = new SoundManager();
    multiplayer = new MultiplayerManager();

    // Expose shared state for theme/skin/puzzle modules
    window._chess3d = {
      get scene() { return scene; },
      get boardMeshes() { return boardMeshes; },
      get elo() { return elo; },
      get chessEngine() { return chessEngine; },
      setColors(light, dark) { COL_LIGHT_SQ = light; COL_DARK_SQ = dark; },
      rebuildPieces() {
        if (scene && babylonSetup) {
          for (const key of Object.keys(pieceMasters)) {
            if (pieceMasters[key]) { pieceMasters[key].dispose(); delete pieceMasters[key]; }
          }
          createPieceMasters(scene, babylonSetup.shadowGen);
          placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);
        }
      },
    };

    // Init Babylon
    const canvas = $('renderCanvas');
    babylonSetup = initBabylon(canvas);
    canvas.setAttribute('tabindex', '0'); // Override Babylon's positive tabindex
    createPieceMasters(scene, babylonSetup.shadowGen);
    placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);

    // Auth integration
    const authCheck = setInterval(() => {
      if (window.authManager?.isInitialized) {
        clearInterval(authCheck);
        window.authManager.onAuthStateChanged(user => {
          currentUser = user;
          // Try to load cloud state
          if (user && window.apiClient) {
            window.apiClient.getGameState(GAME_ID).then(state => {
              const eloVal = state?.additionalData?.elo || state?.elo;
            if (eloVal) {
                elo.rating = eloVal;
                elo._saveStats();
                updateMenuDisplay();
              }
            }).catch(() => {});
          }
        });
      }
    }, 100);

    // Header integration
    if (window.gameHeader) {
      window.gameHeader.init({
        title: 'Chess 3D',
        icon: '\u265f\ufe0f',
        gameId: GAME_ID,
        buttons: ['sound', 'leaderboard', 'auth'],
        onSound: () => {
          const on = sound.toggle();
          return on;
        },
        onSignIn: async (user) => {
          currentUser = user;
          try {
            const state = await window.apiClient?.getGameState(GAME_ID);
            if (state?.elo) {
              elo.rating = state.elo;
              elo._saveStats();
            }
          } catch (e) {}
          updateMenuDisplay();
        },
        onSignOut: () => {
          currentUser = null;
          updateMenuDisplay();
        }
      });
    }

    // Setup UI
    setupMenuUI();
    setupGameUI();
    setupPointerEvents();
    updateMenuDisplay();

    // Show menu initially
    showOverlay('mainMenuOverlay');

    // Handle deep links: ?join=CODE or ?session=ID
    if (window.multiplayerClient) {
      const params = new URLSearchParams(window.location.search);
      const joinCode = params.get('join');
      const sessionId = params.get('session');

      if (joinCode || sessionId) {
        // Wait for auth before joining
        const deepLinkCheck = setInterval(async () => {
          if (!currentUser) return; // Still waiting for auth
          clearInterval(deepLinkCheck);

          gameMode = 'multiplayer';
          hideOverlay('mainMenuOverlay');

          try {
            if (joinCode) {
              showOverlay('mpJoiningOverlay');
              $('mpJoiningStatus').textContent = 'Joining via invite link...';
              const session = await window.multiplayerClient.joinByCode(joinCode);
              mpSessionId = session.sessionId;
              mpIsHost = false;
              await mpJoinAndPlay(session.sessionId);
            } else if (sessionId) {
              showOverlay('mpJoiningOverlay');
              $('mpJoiningStatus').textContent = 'Joining session...';
              await mpJoinAndPlay(sessionId);
            }
          } catch (err) {
            showOverlay('mainMenuOverlay');
            { const m = mpParseError(err, 'join'); if (m) mpShowError(m); }
          }

          // Clean URL without reloading
          window.history.replaceState({}, '', window.location.pathname);
        }, 500);

        // Timeout after 15s if auth never resolves
        setTimeout(() => clearInterval(deepLinkCheck), 15000);
      }
    }
  }

  function setupMenuUI() {
    // Difficulty buttons
    const diffBtns = document.querySelectorAll('.chess3d-diff-btn');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        diffBtns.forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        aiDifficulty = btn.dataset.diff;
        localStorage.setItem('chess3d-difficulty', aiDifficulty);
        sound.play('click');
      });
    });

    // Color buttons
    const colorBtns = document.querySelectorAll('.chess3d-color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => { b.classList.remove('selected'); b.setAttribute('aria-checked', 'false'); });
        btn.classList.add('selected');
        btn.setAttribute('aria-checked', 'true');
        sound.play('click');
      });
    });

    // Play AI button
    $('playAIBtn').addEventListener('click', () => {
      sound.play('click');
      gameMode = 'ai';
      const colorChoice = document.querySelector('.chess3d-color-btn.selected')?.dataset.color || 'white';
      playerColor = colorChoice === 'random' ? (Math.random() < 0.5 ? WHITE : BLACK) : (colorChoice === 'white' ? WHITE : BLACK);
      startNewGame();
    });

    // Settings (Customize) button
    $('settingsBtn')?.addEventListener('click', () => {
      sound.play('click');
      hideOverlay('mainMenuOverlay');
      showOverlay('settingsOverlay');
    });
    $('settingsBackBtn')?.addEventListener('click', () => {
      sound.play('click');
      hideOverlay('settingsOverlay');
      showOverlay('mainMenuOverlay');
    });

    // Play vs Friend button — multiplayer
    const friendBtn = $('playFriendBtn');
    if (friendBtn && window.multiplayerClient) {
      friendBtn.disabled = false;
      friendBtn.classList.remove('chess3d-btn-disabled');
      const badge = friendBtn.querySelector('.chess3d-coming-soon');
      if (badge) badge.remove();
      friendBtn.textContent = 'Play vs Friend';

      friendBtn.addEventListener('click', async () => {
        if (!currentUser) { window.authNudge?.show(); return; }
        sound.play('click');
        gameMode = 'multiplayer';
        hideOverlay('mainMenuOverlay');
        showOverlay('mpLobbyOverlay');
      });
    }

    // Multiplayer lobby buttons
    if ($('mpQuickMatchBtn')) {
      $('mpQuickMatchBtn').addEventListener('click', async () => {
        if (!currentUser) { window.authNudge?.show(); return; }
        sound.play('click');

        // Cancel any stale matchmaking entry first
        await window.multiplayerClient.cancelMatchmaking().catch(() => {});

        window.multiplayerUI?.showMatchmaking('Chess 3D', async () => {
          mpStopPolling();
          await window.multiplayerClient.cancelMatchmaking().catch(() => {});
        });

        // Register WS push callback for instant match notification
        window.multiplayerClient.onMatchFound(async (sessionId) => {
          mpStopPolling();
          window.multiplayerUI?.hideMatchmaking();
          await mpJoinAndPlay(sessionId);
        });

        try {
          const result = await window.multiplayerClient.findMatch('chess-3d');
          if (result.matchedSessionId) {
            window.multiplayerUI?.hideMatchmaking();
            await mpJoinAndPlay(result.matchedSessionId);
          } else {
            // Fallback: poll REST in case WS push fails (e.g. WS blocked by firewall)
            mpPollForMatch();
          }
        } catch (err) {
          window.multiplayerUI?.hideMatchmaking();
          { const m = mpParseError(err, 'matchmaking'); if (m) mpShowError(m); }
        }
      });
    }

    if ($('mpCreatePrivateBtn')) {
      $('mpCreatePrivateBtn').addEventListener('click', async () => {
        if (!currentUser) { window.authNudge?.show(); return; }
        sound.play('click');
        try {
          const colorChoice = document.querySelector('.chess3d-color-btn.selected')?.dataset.color || 'random';
          const session = await window.multiplayerClient.createSession('chess-3d', {
            mode: 'private',
            maxPlayers: 2,
            gameConfig: { colorPreference: colorChoice },
          });
          mpSessionId = session.sessionId;
          mpIsHost = true;
          mpShowWaitingRoom(session);
        } catch (err) {
          { const m = mpParseError(err, 'create'); if (m) mpShowError(m); }
        }
      });
    }

    if ($('mpJoinCodeBtn')) {
      $('mpJoinCodeBtn').addEventListener('click', async () => {
        if (!currentUser) { window.authNudge?.show(); return; }
        sound.play('click');
        const code = prompt('Enter join code:');
        if (!code) return;

        // Show joining state
        hideOverlay('mpLobbyOverlay');
        showOverlay('mpJoiningOverlay');
        $('mpJoiningStatus').textContent = 'Connecting...';

        try {
          const session = await window.multiplayerClient.joinByCode(code);
          mpSessionId = session.sessionId;
          mpIsHost = false;

          $('mpJoiningStatus').textContent = 'Joined! Waiting for host to start...';
          $('mpJoiningIcon').textContent = '✓';
          $('mpJoiningIcon').style.color = 'var(--c3d-emerald)';
          sound.play('click');
          srAnnounce('Joined game lobby. Waiting for host to start the game.');

          await mpJoinAndPlay(session.sessionId);
        } catch (err) {
          hideOverlay('mpJoiningOverlay');
          showOverlay('mpLobbyOverlay');
          sound.play('error');
          { const m = mpParseError(err, 'join'); if (m) mpShowError(m); }
        }
      });
    }

    if ($('mpBackBtn')) {
      $('mpBackBtn').addEventListener('click', () => {
        sound.play('click');
        hideOverlay('mpLobbyOverlay');
        showOverlay('mainMenuOverlay');
      });
    }

    // --- Board Theme buttons ---
    document.querySelectorAll('.chess3d-theme-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const theme = btn.dataset.theme;
        if (theme) {
          applyBoardTheme(theme);
          sound.play('click');
        }
      });
    });
    // Highlight current theme
    const curThemeBtn = document.querySelector(`.chess3d-theme-btn[data-theme="${currentTheme}"]`);
    if (curThemeBtn) curThemeBtn.classList.add('selected');

    // --- Piece Skin buttons ---
    document.querySelectorAll('.chess3d-skin-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const skinName = btn.dataset.skin;
        if (!skinName) return;
        if (!isSkinUnlocked(skinName)) {
          const skin = PIECE_SKINS[skinName];
          // Show unlock tooltip
          const tooltip = btn.querySelector('.chess3d-skin-lock-tip');
          if (tooltip) {
            tooltip.textContent = skin.unlock.text;
            tooltip.style.display = 'block';
            setTimeout(() => { tooltip.style.display = ''; }, 2500);
          }
          sound.play('error');
          return;
        }
        if (applySkin(skinName)) sound.play('click');
      });
    });
    // Highlight current skin & mark locked skins
    const curSkinBtn = document.querySelector(`.chess3d-skin-btn[data-skin="${currentSkin}"]`);
    if (curSkinBtn) curSkinBtn.classList.add('selected');

    // --- Daily Puzzle button ---
    const puzzleBtn = $('dailyPuzzleBtn');
    if (puzzleBtn) {
      puzzleBtn.addEventListener('click', () => {
        sound.play('click');
        const idx = getDailyPuzzleIndex();
        startPuzzle(idx);
      });

      // Show solved badge if today's puzzle is done
      const todayIdx = getDailyPuzzleIndex();
      if (getPuzzleSolvedSet().has(todayIdx)) {
        const badge = puzzleBtn.querySelector('.chess3d-puzzle-badge');
        if (badge) badge.textContent = 'Solved';
      }
    }

    // --- Puzzle hint button ---
    const hintBtn = $('puzzleHintBtn');
    if (hintBtn) {
      hintBtn.addEventListener('click', () => {
        if (!_pz.puzzleMode || _pz.puzzleSolved) return;
        const puzzle = DAILY_PUZZLES[_pz.puzzleIndex];
        if (!puzzle) return;
        const expectedMove = puzzle.solution[_pz.puzzleMoveIndex];
        if (!expectedMove) return;

        // Highlight the "from" square of the expected move
        const fCol = expectedMove.charCodeAt(0) - 97;
        const fRow = parseInt(expectedMove[1]) - 1;
        clearHighlights();
        showSelectedSquare(fRow, fCol);
        sound.play('click');
      });
    }

    // --- Puzzle back to menu button ---
    const puzzleMenuBtn = $('puzzleBackBtn');
    if (puzzleMenuBtn) {
      puzzleMenuBtn.addEventListener('click', () => {
        gameActive = false;
        _pz.puzzleMode = false;
        $('gameHud').style.display = 'none';
        const puzzleOvl = $('puzzleOverlay');
        if (puzzleOvl) puzzleOvl.style.display = 'none';
        showOverlay('mainMenuOverlay');
        updateMenuDisplay();
        sound.play('click');
      });
    }

    // Restore saved difficulty
    const saved = localStorage.getItem('chess3d-difficulty');
    if (saved) {
      diffBtns.forEach(b => b.classList.remove('selected'));
      const match = document.querySelector(`.chess3d-diff-btn[data-diff="${saved}"]`);
      if (match) { match.classList.add('selected'); aiDifficulty = saved; }
    }
  }

  function setupGameUI() {
    // HUD buttons
    $('undoBtn').addEventListener('click', handleUndo);
    $('flipBtn').addEventListener('click', () => { resetCamera(camera.alpha > Math.PI); sound.play('click'); });
    $('resetCamBtn').addEventListener('click', () => { resetCamera(playerColor === BLACK); sound.play('click'); });
    $('resignBtn').addEventListener('click', () => { showOverlay('resignOverlay'); sound.play('click'); });

    // Mobile move history drawer toggle
    $('mobileMovesToggle')?.addEventListener('click', () => {
      const panel = $('mobileMovesPanel');
      if (panel) {
        panel.classList.toggle('expanded');
        sound.play('click');
      }
    });

    // Draw offer button (multiplayer only)
    $('drawOfferBtn')?.addEventListener('click', () => {
      if (gameMode !== 'multiplayer' || !window.multiplayerClient) return;
      window.multiplayerClient.submitMove('draw-offer', {});
      sound.play('click');
      $('drawOfferBtn').disabled = true;
      $('drawOfferBtn').textContent = 'Offered';
      setTimeout(() => { $('drawOfferBtn').disabled = false; $('drawOfferBtn').textContent = '\u00BD'; }, 5000);
    });

    // Draw accept/decline
    $('drawAcceptBtn')?.addEventListener('click', () => {
      window.multiplayerClient?.submitMove('draw-accept', {});
      hideOverlay('drawOfferOverlay');
      sound.play('click');
    });
    $('drawDeclineBtn')?.addEventListener('click', () => {
      window.multiplayerClient?.submitMove('draw-decline', {});
      hideOverlay('drawOfferOverlay');
      sound.play('click');
    });

    // Resign dialog
    $('resignConfirmBtn').addEventListener('click', () => {
      hideOverlay('resignOverlay');
      if (gameMode === 'multiplayer' && window.multiplayerClient) {
        window.multiplayerClient.forfeit();
        // Server handles the result via onGameFinished
      } else {
        endGame(playerColor === WHITE ? 'black' : 'white', 'Resignation');
      }
    });
    $('resignCancelBtn').addEventListener('click', () => { hideOverlay('resignOverlay'); sound.play('click'); });

    // Promotion dialog
    document.querySelectorAll('.chess3d-promo-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (promotionResolve) {
          promotionResolve(btn.dataset.piece);
          promotionResolve = null;
        }
        hideOverlay('promotionOverlay');
        sound.play('promotion');
      });
    });

    // Game over buttons (AI mode only — MP overrides via .onclick in mpRegisterListeners)
    $('rematchBtn').addEventListener('click', () => {
      if (gameMode === 'multiplayer') return; // MP handler takes over via .onclick
      hideOverlay('gameOverOverlay');
      startNewGame();
    });
    $('menuBtn').addEventListener('click', () => {
      hideOverlay('gameOverOverlay');
      showOverlay('mainMenuOverlay');
      updateMenuDisplay();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (!gameActive) return;
      if (promotionResolve) return; // Block keys during promotion dialog
      if (e.key === 'z' || e.key === 'Z') handleUndo();
      if (e.key === 'f' || e.key === 'F') { resetCamera(camera.alpha > Math.PI); }
      if (e.key === 'r' || e.key === 'R') { resetCamera(playerColor === BLACK); }
      if (e.key === 'Escape') { showOverlay('resignOverlay'); }
    });
  }

  function setupPointerEvents() {
    const canvas = $('renderCanvas');
    let pointerDownPos = null;
    let pointerDownTime = 0;

    canvas.addEventListener('pointerdown', (e) => {
      pointerDownPos = { x: e.clientX, y: e.clientY };
      pointerDownTime = Date.now();
    });

    canvas.addEventListener('pointerup', (e) => {
      if (!gameActive || isAnimating) return;
      if (!pointerDownPos) return;

      const dx = e.clientX - pointerDownPos.x;
      const dy = e.clientY - pointerDownPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const elapsed = Date.now() - pointerDownTime;

      // If moved too much, it was a camera drag, not a tap
      if (dist > 10 || elapsed > 300) {
        pointerDownPos = null;
        return;
      }
      pointerDownPos = null;

      // Pick
      const pickResult = scene.pick(e.clientX, e.clientY);
      if (!pickResult.hit) {
        deselectPiece();
        return;
      }

      const mesh = pickResult.pickedMesh;
      const meta = mesh?.metadata;

      if (!meta) {
        // Check parent (for instances)
        if (mesh.sourceMesh?.metadata) {
          handlePiecePick(mesh);
          return;
        }
        deselectPiece();
        return;
      }

      if (meta.type === 'piece') {
        handlePiecePick(mesh);
      } else if (meta.type === 'square') {
        handleSquarePick(meta.row, meta.col);
      } else {
        deselectPiece();
      }
    });
  }

  function handlePiecePick(mesh) {
    // Find the piece data from our pieceMeshes map
    let row, col, pColor;
    for (const [key, m] of Object.entries(pieceMeshes)) {
      if (m === mesh) {
        const match = key.match(/r(\d+)c(\d+)/);
        if (!match) continue;
        row = parseInt(match[1]);
        col = parseInt(match[2]);
        const piece = chessEngine.getPieceAt(row, col);
        if (piece) pColor = piece.color;
        break;
      }
    }

    if (row === undefined) return;

    // If it's not our turn or not our piece
    if (chessEngine.getTurn() !== playerColor) return;
    if (pColor !== playerColor) {
      // Try to capture if we have a selected piece
      if (selectedSquare) {
        handleSquarePick(row, col);
      }
      return;
    }

    // Select this piece
    selectPiece(row, col);
  }

  function handleSquarePick(row, col) {
    if (!selectedSquare) return;

    const from = selectedSquare;
    const legal = chessEngine.getLegalMoves(from.row, from.col);
    const targetMove = legal.find(m => m.to[0] === row && m.to[1] === col);

    if (!targetMove) {
      // Check if clicking on own piece to reselect
      const piece = chessEngine.getPieceAt(row, col);
      if (piece && piece.color === playerColor) {
        selectPiece(row, col);
      } else {
        deselectPiece();
      }
      return;
    }

    // Handle promotion
    if (targetMove.promotion) {
      executePromotion(from.row, from.col, row, col);
    } else {
      executePlayerMove(from.row, from.col, row, col, null);
    }
  }

  function selectPiece(row, col) {
    selectedSquare = { row, col };
    clearHighlights();
    showSelectedSquare(row, col);
    const legal = chessEngine.getLegalMoves(row, col);
    showLegalMoveHighlights(legal);
    sound.play('click');
  }

  function deselectPiece() {
    selectedSquare = null;
    clearHighlights();
  }

  async function executePromotion(fromRow, fromCol, toRow, toCol) {
    isAnimating = true; // Block all input during promotion

    // Show promotion dialog
    // Update icons based on player color
    const btns = document.querySelectorAll('.chess3d-promo-btn');
    const isWhite = playerColor === WHITE;
    btns[0].innerHTML = isWhite ? '\u2655' : '\u265B'; // Queen
    btns[1].innerHTML = isWhite ? '\u2656' : '\u265C'; // Rook
    btns[2].innerHTML = isWhite ? '\u2657' : '\u265D'; // Bishop
    btns[3].innerHTML = isWhite ? '\u2658' : '\u265E'; // Knight

    showOverlay('promotionOverlay');

    const promotionPiece = await new Promise(resolve => { promotionResolve = resolve; });
    isAnimating = false;
    executePlayerMove(fromRow, fromCol, toRow, toCol, promotionPiece);
  }

  function executePlayerMove(fromRow, fromCol, toRow, toCol, promotion) {
    deselectPiece();
    isAnimating = true;

    // In puzzle mode, delegate to puzzle handler
    if (_pz.puzzleMode) {
      handlePuzzleMove(fromRow, fromCol, toRow, toCol, promotion);
      return;
    }

    // In multiplayer mode, send move to server instead of applying locally
    if (gameMode === 'multiplayer' && window.multiplayerClient) {
      window.multiplayerClient.submitMove('chess-move', {
        from: [fromRow, fromCol],
        to: [toRow, toCol],
        promotion: promotion || undefined,
      });
      sound.play('move');
      // Server will broadcast new state via onGameState — UI updates there
      return;
    }

    const result = chessEngine.makeMove(fromRow, fromCol, toRow, toCol, promotion);
    if (!result) {
      isAnimating = false;
      sound.play('error');
      return;
    }

    moveCount++;

    // Play sound
    if (result.castle) sound.play('castle');
    else if (result.capture) sound.play('capture');
    else sound.play('move');

    // Animate piece
    animatePieceMove(fromRow, fromCol, toRow, toCol, () => {
      // Handle promotion mesh swap
      if (result.promotion) {
        const destKey = 'r' + toRow + 'c' + toCol;
        if (pieceMeshes[destKey]) pieceMeshes[destKey].dispose();
        const masterKey = playerColor + result.promotion;
        const instance = pieceMasters[masterKey].createInstance('piece_' + destKey);
        instance.position = new BABYLON.Vector3(toCol, 0.15, toRow);
        instance.metadata = { type: 'piece', row: toRow, col: toCol, pieceType: result.promotion, pieceColor: playerColor };
        instance.isPickable = true;
        pieceMeshes[destKey] = instance;
      }

      // Handle castling rook animation (animatePieceMove handles key mapping internally)
      if (result.castle) {
        const rank = fromRow;
        if (result.castle === 'K') {
          animatePieceMove(rank, 7, rank, 5, null);
        } else {
          animatePieceMove(rank, 0, rank, 3, null);
        }
      }

      // Handle en passant capture (remove captured pawn mesh)
      if (result.enPassant) {
        const capturedRow = fromRow;
        const capturedCol = toCol;
        const capturedKey = 'r' + capturedRow + 'c' + capturedCol;
        if (pieceMeshes[capturedKey]) {
          pieceMeshes[capturedKey].dispose();
          delete pieceMeshes[capturedKey];
        }
      }

      showLastMove(fromRow, fromCol, toRow, toCol);
      clearCheckHighlight();

      updateMoveHistory();
      updateCapturedPieces();
      placeCapturedPieces3D(chessEngine);

      isAnimating = false;

      // Announce move for screen readers
      const san = chessEngine.sanHistory;
      if (san.length > 0) srAnnounce('Your move: ' + san[san.length - 1]);

      // Check game end
      if (checkGameEnd()) return;

      // Check indicator
      if (chessEngine.isCheck()) {
        const king = chessEngine._findKing(chessEngine.getTurn());
        if (king) showCheckHighlight(king[0], king[1]);
        sound.play('check');
        srAnnounce('Check!');
      }

      updateTurnIndicator();

      // AI turn
      if (chessEngine.getTurn() !== playerColor) {
        scheduleAIMove();
      }
    });
  }

  function scheduleAIMove() {
    $('thinkingIndicator').style.display = '';
    isAnimating = true; // Block input immediately while AI thinks

    // Use setTimeout to not block the UI
    setTimeout(() => {
      const move = chessAI.findBestMove(aiDifficulty);
      $('thinkingIndicator').style.display = 'none';

      if (!move || !gameActive) { isAnimating = false; return; }
      const fromRow = move.from[0], fromCol = move.from[1];
      const toRow = move.to[0], toCol = move.to[1];

      // AI always promotes to queen unless it chose otherwise
      const promotion = move.promotion || null;

      const result = chessEngine.makeMove(fromRow, fromCol, toRow, toCol, promotion);
      if (!result) { isAnimating = false; return; }

      moveCount++;

      if (result.castle) sound.play('castle');
      else if (result.capture) sound.play('capture');
      else sound.play('move');

      animatePieceMove(fromRow, fromCol, toRow, toCol, () => {
        // Handle AI promotion mesh swap
        if (result.promotion) {
          const destKey = 'r' + toRow + 'c' + toCol;
          if (pieceMeshes[destKey]) pieceMeshes[destKey].dispose();
          const aiColor = playerColor === WHITE ? BLACK : WHITE;
          const masterKey = aiColor + result.promotion;
          const instance = pieceMasters[masterKey].createInstance('piece_' + destKey);
          instance.position = new BABYLON.Vector3(toCol, 0.15, toRow);
          instance.metadata = { type: 'piece', row: toRow, col: toCol, pieceType: result.promotion, pieceColor: aiColor };
          instance.isPickable = true;
          pieceMeshes[destKey] = instance;
        }

        if (result.castle) {
          const rank = fromRow;
          if (result.castle === 'K') {
            animatePieceMove(rank, 7, rank, 5, null);
          } else {
            animatePieceMove(rank, 0, rank, 3, null);
          }
        }

        if (result.enPassant) {
          const capturedRow = fromRow;
          const capturedCol = toCol;
          const capturedKey = 'r' + capturedRow + 'c' + capturedCol;
          if (pieceMeshes[capturedKey]) { pieceMeshes[capturedKey].dispose(); delete pieceMeshes[capturedKey]; }
        }

        showLastMove(fromRow, fromCol, toRow, toCol);
        clearCheckHighlight();

        updateMoveHistory();
        updateCapturedPieces();
      placeCapturedPieces3D(chessEngine);

        isAnimating = false;

        // Announce AI move for screen readers
        const san = chessEngine.sanHistory;
        if (san.length > 0) srAnnounce('Opponent move: ' + san[san.length - 1]);

        if (checkGameEnd()) return;

        if (chessEngine.isCheck()) {
          const king = chessEngine._findKing(chessEngine.getTurn());
          if (king) showCheckHighlight(king[0], king[1]);
          sound.play('check');
          srAnnounce('Check!');
        }

        updateTurnIndicator();
      });
    }, 50 + Math.random() * 200); // Small delay to feel natural
  }

  function checkGameEnd() {
    if (chessEngine.isCheckmate()) {
      const winner = chessEngine.getTurn() === WHITE ? 'black' : 'white';
      const isPlayerWin = (winner === 'white' && playerColor === WHITE) || (winner === 'black' && playerColor === BLACK);
      srAnnounce('Checkmate! ' + winner + ' wins.');
      sound.play('checkmate');

      // Show dramatic checkmate splash before game over
      showEndSplash(
        isPlayerWin ? 'CHECKMATE!' : 'CHECKMATED',
        isPlayerWin ? 'You win!' : 'You lose',
        isPlayerWin ? 'var(--c3d-gold)' : 'var(--c3d-red)',
        () => endGame(winner, 'Checkmate')
      );
      return true;
    }
    if (chessEngine.isDraw()) {
      const reason = chessEngine.getDrawReason();
      srAnnounce('Game drawn: ' + reason);

      showEndSplash('DRAW', reason, 'var(--c3d-text-dim)', () => endGame('draw', reason));
      return true;
    }
    return false;
  }

  function showEndSplash(title, subtitle, color, callback) {
    const splash = $('endSplash');
    const titleEl = $('endSplashTitle');
    const subEl = $('endSplashSub');
    if (!splash || !titleEl) {
      // Fallback if elements don't exist
      setTimeout(callback, 400);
      return;
    }

    titleEl.textContent = title;
    titleEl.style.color = color;
    subEl.textContent = subtitle || '';
    splash.style.display = 'flex';
    splash.style.opacity = '0';

    // Fade in
    requestAnimationFrame(() => {
      splash.style.transition = 'opacity 0.4s ease';
      splash.style.opacity = '1';
    });

    // Hold for 2.5 seconds, then fade out and show game over
    setTimeout(() => {
      splash.style.transition = 'opacity 0.5s ease';
      splash.style.opacity = '0';
      setTimeout(() => {
        splash.style.display = 'none';
        callback();
      }, 500);
    }, 2500);
  }

  function handleUndo() {
    if (!gameActive || isAnimating || _pz.puzzleMode) return;
    if (chessEngine.getTurn() !== playerColor) return;

    // Undo AI move + player move (only if both exist)
    const history = chessEngine.getHistory ? chessEngine.getHistory() : [];
    if (history.length < 2) return;

    const aiUndo = chessEngine.undoMove();
    if (!aiUndo) return;
    const playerUndo = chessEngine.undoMove();
    if (!playerUndo) {
      // Re-apply AI move if player undo failed
      chessEngine.makeMove(aiUndo.from[0], aiUndo.from[1], aiUndo.to[0], aiUndo.to[1]);
      return;
    }

    moveCount = Math.max(0, moveCount - 2);
    sound.play('click');

    // Rebuild pieces
    placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);
    clearHighlights();
    for (const m of lastMoveHighlights) { try { m.dispose(); } catch(e) {} }
    lastMoveHighlights = [];
    clearCheckHighlight();

    updateMoveHistory();
    updateCapturedPieces();
    updateTurnIndicator();
  }

  /* ================================================================
     9a. MULTIPLAYER FUNCTIONS
     ================================================================ */

  let mpErrorTimer = null;

  function mpShowError(message) {
    const el = $('mpErrorMsg');
    if (el) {
      el.textContent = message;
      el.style.display = 'block';
      if (mpErrorTimer) clearTimeout(mpErrorTimer);
      mpErrorTimer = setTimeout(() => { el.style.display = 'none'; }, 15000);
    } else {
      alert(message);
    }
    sound.play('error');
  }

  function mpShowErrorWithCountdown(baseMsg, expiresInMs) {
    const el = $('mpErrorMsg');
    if (!el) { alert(baseMsg); return; }
    sound.play('error');
    el.style.display = 'block';

    if (mpErrorTimer) clearTimeout(mpErrorTimer);
    const endTime = Date.now() + expiresInMs;

    function tick() {
      const remaining = Math.max(0, endTime - Date.now());
      if (remaining <= 0) {
        el.innerHTML = baseMsg + ' <strong style="color:var(--c3d-emerald);">Ready now! Try again.</strong>';
        return;
      }
      const min = Math.floor(remaining / 60000);
      const sec = Math.floor((remaining % 60000) / 1000);
      const timeStr = min > 0 ? min + 'm ' + sec + 's' : sec + 's';
      el.innerHTML = baseMsg + ' <strong>Expires in ' + timeStr + '</strong>';
      mpErrorTimer = setTimeout(tick, 1000);
    }
    tick();
  }

  // Parse Firestore timestamp (can be ISO string, Date, or {_seconds, _nanoseconds})
  function mpParseTimestamp(ts) {
    if (!ts) return 0;
    if (typeof ts === 'string') return new Date(ts).getTime();
    if (ts._seconds) return ts._seconds * 1000;
    if (ts.seconds) return ts.seconds * 1000;
    if (ts instanceof Date) return ts.getTime();
    return new Date(ts).getTime() || 0;
  }

  async function mpHandleSessionLimit(context) {
    // Fetch active sessions to find earliest expiry
    try {
      const sessions = await window.multiplayerClient.getActiveSessions();
      if (sessions && sessions.length > 0) {
        // Find the session that will expire soonest
        // waiting = 5 min idle, playing = 30 min max
        let earliestExpiry = Infinity;
        for (const s of sessions) {
          const activityTime = mpParseTimestamp(s.lastActivityAt);
          if (!activityTime) continue;

          let expiresAt;
          if (s.status === 'waiting') {
            expiresAt = activityTime + 5 * 60 * 1000; // 5 min idle
          } else if (s.status === 'playing' || s.status === 'starting') {
            const startTime = mpParseTimestamp(s.startedAt) || activityTime;
            expiresAt = startTime + 30 * 60 * 1000; // 30 min max
          } else {
            continue;
          }
          if (expiresAt < earliestExpiry) earliestExpiry = expiresAt;
        }
        if (earliestExpiry < Infinity) {
          const remaining = earliestExpiry - Date.now();
          console.log('[Chess3D] Session limit — earliest expiry in', Math.round(remaining / 1000), 's');
          if (remaining > 0) {
            mpShowErrorWithCountdown(
              'Session limit reached (3 max).',
              remaining
            );
            return;
          } else {
            // Already expired — tell user to try again now
            mpShowError('Session limit reached but oldest session has expired. Try again now!');
            return;
          }
        }
      }
    } catch (e) {
      console.error('[Chess3D] Failed to fetch sessions for countdown:', e);
    }

    mpShowError('Session limit reached (3 max). Your oldest session will expire within 5 minutes. Try again shortly.');
  }

  function mpParseError(err, context) {
    const msg = err?.message || '';

    // 409 Conflict — already in queue or session
    if (msg.includes('409') || msg.includes('Conflict') || msg.includes('concurrent')) {
      if (msg.includes('matchmaking') || context === 'matchmaking') {
        return 'You already have an active matchmaking request. Please wait for it to expire (2 min) or try again shortly.';
      }
      // Session limit — show countdown
      mpHandleSessionLimit(context);
      return null; // Handled by countdown, don't show static error
    }

    // 401/403 — auth issues
    if (msg.includes('401') || msg.includes('Unauthorized')) return 'Please sign in to play multiplayer.';
    if (msg.includes('403') || msg.includes('Forbidden')) return 'Your account cannot access multiplayer yet. Try signing out and back in.';

    // 404 — endpoint not found (server not deployed)
    if (msg.includes('404') || msg.includes('Not Found')) return 'Multiplayer server is not available yet. It may still be deploying.';

    // 429 — rate limited
    if (msg.includes('429') || msg.includes('Too Many')) return 'Too many requests. Please wait a moment and try again.';

    // Network/timeout
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) return 'Network error. Check your internet connection and try again.';
    if (msg.includes('timeout')) return 'Server is taking too long to respond. It may be waking up — try again in 30 seconds.';

    // Generic fallback
    return 'Something went wrong. Please try again. (' + (msg.slice(0, 60)) + ')';
  }

  function mpShowWaitingRoom(session) {
    hideOverlay('mpLobbyOverlay');
    showOverlay('mpWaitingOverlay');

    const codeEl = $('mpJoinCode');
    if (codeEl && session.joinCode) {
      codeEl.textContent = session.joinCode;
    }

    // Build invite URL for sharing
    const inviteUrl = window.location.origin + '/games/chess-3d/?join=' + (session.joinCode || '');
    const inviteLinkEl = $('mpInviteLink');
    if (inviteLinkEl) inviteLinkEl.textContent = inviteUrl;

    // Copy code button
    $('mpCopyCodeBtn')?.addEventListener('click', () => {
      navigator.clipboard?.writeText(session.joinCode || '');
      $('mpCopyCodeBtn').textContent = 'Copied!';
      setTimeout(() => { $('mpCopyCodeBtn').textContent = 'Copy Code'; }, 2000);
      sound.play('click');
    });

    // Share link button
    $('mpShareLinkBtn')?.addEventListener('click', () => {
      if (navigator.share) {
        navigator.share({
          title: 'Chess 3D — Play with me!',
          text: 'Join my Chess 3D game on Weekly Arcade!',
          url: inviteUrl,
        }).catch(() => {});
      } else {
        navigator.clipboard?.writeText(inviteUrl);
        $('mpShareLinkBtn').textContent = 'Link Copied!';
        setTimeout(() => { $('mpShareLinkBtn').textContent = 'Share Link'; }, 2000);
      }
      sound.play('click');
    });

    $('mpWaitingCancelBtn')?.addEventListener('click', async () => {
      sound.play('click');
      try { await window.multiplayerClient.leaveSession(mpSessionId); } catch (e) {}
      hideOverlay('mpWaitingOverlay');
      showOverlay('mainMenuOverlay');
      mpCleanup(true); // Full leave — cancel waiting room
    });

    // Connect WebSocket and listen for opponent
    window.multiplayerClient.connect(mpSessionId).then(() => {
      mpRegisterListeners();
    }).catch(() => {
      mpShowError('Could not connect to game server. It may not be deployed yet.');
    });
  }

  async function mpJoinAndPlay(sessionId) {
    mpSessionId = sessionId;
    hideOverlay('mpLobbyOverlay');
    hideOverlay('mpWaitingOverlay');

    // Show joining overlay if not already showing
    if (!$('mpJoiningOverlay')?.classList.contains('chess3d-visible')) {
      showOverlay('mpJoiningOverlay');
      $('mpJoiningStatus').textContent = 'Connecting...';
      $('mpJoiningIcon').textContent = '⏳';
      $('mpJoiningIcon').style.color = 'var(--c3d-gold)';
    }

    try {
      const session = await window.multiplayerClient.getSession(sessionId);

      // Reject stale/finished sessions — don't join dead games
      if (session.status === 'finished' || session.status === 'abandoned') {
        throw new Error('Session is no longer active');
      }

      mpIsHost = session.hostUid === currentUser?.uid;

      $('mpJoiningStatus').textContent = 'Connected! Joining lobby...';

      // Register listeners BEFORE connect — prevents race where server sends
      // game:state before listeners are attached (iOS timing issue)
      mpRegisterListeners();
      await window.multiplayerClient.connect(sessionId);

      // Update joining overlay to show success
      $('mpJoiningIcon').textContent = '✓';
      $('mpJoiningIcon').style.color = 'var(--c3d-emerald)';
      $('mpJoiningStatus').textContent = mpIsHost
        ? 'Waiting for opponent to join...'
        : 'Joined! Waiting for host to start...';
      sound.play('click');
      srAnnounce(mpIsHost ? 'Lobby created. Waiting for opponent.' : 'Joined the game lobby.');

      // Signal ready
      window.multiplayerClient.signalReady();

      // For quick-match: if game doesn't start within 30s, opponent likely ghosted
      if (session.mode === 'quick-match') {
        _mpQuickMatchTimeout = setTimeout(() => {
          if (!gameActive && gameMode === 'multiplayer') {
            console.warn('[Chess3D] Quick match opponent did not connect — returning to lobby');
            mpCleanup(true);
            hideOverlay('mpJoiningOverlay');
            showOverlay('mpLobbyOverlay');
            mpShowError('Opponent did not connect. Try searching again.');
          }
        }, 30000);
      }
    } catch (err) {
      console.error('[Chess3D] MP join error:', err);
      hideOverlay('mpJoiningOverlay');
      showOverlay('mpLobbyOverlay');
      sound.play('error');
      mpShowError('Could not connect to the game server.');
    }
  }

  function mpRegisterListeners() {
    window.multiplayerClient.onPlayerJoined(async (player) => {
      sound.play('click');
      srAnnounce('Opponent joined the game!');

      // Update joining overlay
      $('mpJoiningIcon').textContent = '♟️';
      $('mpJoiningIcon').style.color = '';
      $('mpJoiningStatus').textContent = 'Opponent joined! Starting game...';

      // If we're host, start the game
      if (mpIsHost) {
        try {
          // For quick-match, the API already called startGame — skip REST call
          // to avoid 400 "Session is not in waiting state" on iOS
          const session = await window.multiplayerClient.getSession(mpSessionId);
          if (session?.status === 'waiting') {
            await window.multiplayerClient.startGame(mpSessionId);
          }
          // Signal ready via WebSocket so Realtime server runs tryStartGame
          window.multiplayerClient.signalReady();
          // Retry every 2s in case of race condition with Firestore status
          let retries = 0;
          const retryInterval = setInterval(() => {
            if (gameActive || retries >= 5) { clearInterval(retryInterval); return; }
            retries++;
            window.multiplayerClient.signalReady();
          }, 2000);
        } catch (e) {
          console.error('[Chess3D] Start game error:', e);
          // Don't show error UI — server-side tryStartGame may still succeed
          // Just signal ready as a fallback
          window.multiplayerClient.signalReady();
        }
      }
    });

    window.multiplayerClient.onGameState((data) => {
      const state = data.state;
      const turnUid = data.turnUid;

      // Determine our color from server state
      if (state.colorMap && currentUser?.uid) {
        const myColor = state.colorMap[currentUser.uid];
        if (myColor) playerColor = myColor;
      }

      // Load FEN into local engine for display
      chessEngine.reset();
      if (state.fen) chessEngine.loadFEN(state.fen);
      chessEngine.sanHistory = state.moveHistory || [];

      // Transition from waiting/lobby/joining to game
      hideOverlay('mpWaitingOverlay');
      hideOverlay('mpLobbyOverlay');
      hideOverlay('mpJoiningOverlay');
      if (!gameActive) {
        gameActive = true;
        gameStartTime = Date.now();

        // Cancel ghost-match timeout — opponent connected and game is starting
        if (_mpQuickMatchTimeout) {
          clearTimeout(_mpQuickMatchTimeout);
          _mpQuickMatchTimeout = null;
        }

        // Persist session ID immediately for rejoin (iOS may kill page without beforeunload)
        if (mpSessionId) {
          localStorage.setItem('chess3d-rejoin-session', mpSessionId);
        }
        moveCount = (state.moveHistory || []).length;
        $('gameHud').style.display = '';
        $('undoBtn').style.display = 'none'; // No undo in multiplayer
        $('drawOfferBtn').style.display = ''; // Show draw offer in multiplayer

        // Fetch opponent name + UID from session data
        window.multiplayerClient.getSession(mpSessionId).then(session => {
          if (session?.players) {
            for (const [uid, player] of Object.entries(session.players)) {
              if (uid !== currentUser?.uid) {
                mpOpponentUid = uid;
                mpOpponentName = player.displayName || 'Opponent';
                $('topName').textContent = mpOpponentName;
              }
            }
          }
        }).catch(() => {});

        $('topName').textContent = mpOpponentName;
        $('bottomName').textContent = currentUser?.displayName || 'You';
        $('topElo').textContent = '';
        $('bottomElo').textContent = '';

        // Show turn timers in multiplayer
        $('topTimer').style.display = '';
        $('bottomTimer').style.display = '';
        $('gameClock').style.display = '';

        // Start game clock
        mpStartGameClock();

        resetCamera(playerColor === BLACK);
      }

      // Detect captures and moves by diffing FEN
      const changes = mpDetectChanges(state.fen);

      clearHighlights();
      for (const m of lastMoveHighlights) { try { m.dispose(); } catch(e) {} }
      lastMoveHighlights = [];
      clearCheckHighlight();

      // Animate the move if we detected from→to, otherwise just rebuild
      if (changes) {
        console.log('[Chess3D] MP changes:', JSON.stringify({ from: changes.movedFrom, to: changes.movedTo, captured: changes.captured?.type, castle: changes.isCastle }));
      } else {
        console.log('[Chess3D] MP no changes detected (initial state or same FEN)');
      }
      if (changes?.movedFrom && changes?.movedTo) {
        // Animate the piece from old position to new
        mpAnimateMove(changes.movedFrom.row, changes.movedFrom.col, changes.movedTo.row, changes.movedTo.col, () => {
          // After animation: show last move highlight
          showLastMove(changes.movedFrom.row, changes.movedFrom.col, changes.movedTo.row, changes.movedTo.col);

          // Check indicator after animation completes
          if (changes.isCheck || chessEngine.isCheck()) {
            const king = chessEngine._findKing(chessEngine.getTurn());
            if (king) showCheckHighlight(king[0], king[1]);
            sound.play('check');
          }
        });

        // Play sound immediately (don't wait for animation)
        if (changes.captured) {
          const ct = changes.captured.type;
          const soundType = 'capture-' + ({ p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' }[ct] || 'pawn');
          sound.play(soundType);
          showCaptureEffect(changes.captured.row, changes.captured.col, ct);
          srAnnounce((ct === 'q' ? 'Queen' : ct === 'r' ? 'Rook' : ct === 'b' ? 'Bishop' : ct === 'n' ? 'Knight' : 'Pawn') + ' captured!');
        } else if (changes.isCastle) {
          sound.play('castle');
        } else {
          sound.play('move');
        }
      } else {
        // No move detected (initial state or complex change) — full rebuild
        placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);
      }

      // Update captured pieces display + move history
      placeCapturedPieces3D(chessEngine);
      if (state.moveHistory && state.moveHistory.length > 0) {
        updateMoveHistory();
        updateCapturedPieces();
        placeCapturedPieces3D(chessEngine);
      }

      // Check indicator (if not already shown by animation callback)
      if (!changes?.movedFrom && (changes?.isCheck || chessEngine.isCheck())) {
        const king = chessEngine._findKing(chessEngine.getTurn());
        if (king) showCheckHighlight(king[0], king[1]);
        sound.play('check');
      }

      // Draw offer detection
      if (state.drawOffer && state.drawOffer !== currentUser?.uid) {
        // Opponent offered a draw — show the dialog
        $('drawOfferText').textContent = mpOpponentName + ' offers a draw.';
        showOverlay('drawOfferOverlay');
        sound.play('click');
        srAnnounce(mpOpponentName + ' has offered a draw.');
      }

      // Turn indicator + timer
      const isMyTurn = turnUid === currentUser?.uid;
      $('turnText').textContent = isMyTurn ? 'Your turn' : mpOpponentName + '\'s turn...';
      isAnimating = !isMyTurn; // Block input when not our turn

      // Reset turn timer on each state update
      if (gameMode === 'multiplayer') {
        mpTurnStartTime = Date.now();
        mpStartTurnTimer(isMyTurn);
      }
    });

    window.multiplayerClient.onGameFinished(({ results }) => {
      gameActive = false;
      stopAmbientMusic();
      mpStopTimers();
      // Game ended normally — clear rejoin session (no longer active)
      localStorage.removeItem('chess3d-rejoin-session');
      const myResult = results?.[currentUser?.uid];
      if (myResult?.outcome === 'win') { sound.play('checkmate'); }
      else if (myResult?.outcome === 'loss') { sound.play('loss'); }
      else { sound.play('draw'); }

      // Get move count from engine history (updated from server FEN)
      const mpMoves = chessEngine.sanHistory?.length || chessEngine.getHistory?.()?.length || moveCount;
      const gameTimeMs = Date.now() - gameStartTime;

      const isWin = myResult?.outcome === 'win';
      const isLoss = myResult?.outcome === 'loss';

      // Show dramatic splash first, then game over
      showEndSplash(
        isWin ? 'CHECKMATE!' : isLoss ? 'CHECKMATED' : 'DRAW',
        isWin ? 'You win!' : isLoss ? 'You lose' : 'Game drawn',
        isWin ? 'var(--c3d-gold)' : isLoss ? 'var(--c3d-red)' : 'var(--c3d-text-dim)',
        () => {
          $('gameOverTitle').textContent = isWin ? 'You Win!' : isLoss ? 'You Lose' : 'Draw';
          $('gameOverReason').textContent = '';
          $('gameOverElo').textContent = '';
          $('gameOverStats').textContent = mpMoves + ' moves \u00b7 ' + formatTime(gameTimeMs);

          // Near-miss tease
          const tease = getNearMissTease(elo.rating, myResult?.outcome || 'loss', mpMoves);
          const teaseEl = $('gameOverTease');
          if (teaseEl) {
            teaseEl.textContent = tease || '';
            teaseEl.style.display = tease ? '' : 'none';
          }

          // Reset rematch button for MP mode
          $('rematchBtn').disabled = false;
          $('rematchBtn').textContent = 'Rematch';

          showOverlay('gameOverOverlay');
        }
      );

      // On rematch/menu, clean up MP
      $('rematchBtn').onclick = async () => {
        if (!mpOpponentUid || !currentUser) {
          // Fallback to AI game if no opponent info
          hideOverlay('gameOverOverlay');
          mpCleanup(true);
          startNewGame();
          return;
        }

        const btn = $('rematchBtn');
        btn.disabled = true;
        btn.textContent = 'Creating rematch...';

        try {
          // Clean up old session (full leave) but stay in MP mode
          const oldSessionId = mpSessionId;
          mpStopTimers();
          mpStopPolling();
          try { window.multiplayerClient?.disconnect(); } catch (e) {}
          if (oldSessionId) {
            window.multiplayerClient?.leaveSession(oldSessionId).catch(() => {});
          }

          // Create a new private session for rematch
          const session = await window.multiplayerClient.createSession('chess-3d', {
            mode: 'private',
            maxPlayers: 2,
            gameConfig: { colorPreference: 'random' },
          });

          // Invite the opponent
          await window.multiplayerClient.inviteFriend(session.sessionId, mpOpponentUid);

          // Join the new session ourselves
          mpSessionId = session.sessionId;
          mpIsHost = true;
          mpRematchSessionId = null;
          gameMode = 'multiplayer';

          hideOverlay('gameOverOverlay');
          showOverlay('mpJoiningOverlay');
          $('mpJoiningStatus').textContent = 'Waiting for ' + mpOpponentName + ' to accept rematch...';
          $('mpJoiningIcon').textContent = '⏳';
          $('mpJoiningIcon').style.color = 'var(--c3d-gold)';

          await mpJoinAndPlay(session.sessionId);
        } catch (err) {
          console.error('[Chess3D] Rematch error:', err);
          btn.disabled = false;
          btn.textContent = 'Rematch';
          mpShowError('Could not create rematch. Try again.');
        }
      };

      // Listen for opponent's rematch invitation
      _pollForRematchInvitation();

      $('menuBtn').onclick = () => {
        gameMode = 'ai'; // Set before cleanup to prevent reconnect overlay
        hideOverlay('gameOverOverlay');
        showOverlay('mainMenuOverlay');
        mpCleanup(true); // Game is finished — full leave
        updateMenuDisplay();
      };
    });

    window.multiplayerClient.onMoveRejected(({ reason }) => {
      console.warn('[Chess3D] Move rejected:', reason);
      sound.play('error');
      isAnimating = false; // Re-enable input
    });

    window.multiplayerClient.onError(({ code }) => {
      if (code === 'DISCONNECTED' && gameMode === 'multiplayer' && gameActive) {
        window.multiplayerUI?.showDisconnectOverlay();
        mpPauseTimers();
      }
    });

    window.multiplayerClient.onReconnected(() => {
      window.multiplayerUI?.hideDisconnectOverlay();
      mpResumeTimers();
      srAnnounce('Reconnected to game server.');
    });

    // Turn timeout — server auto-moves or forfeits
    window.multiplayerClient.on('game:turn-timeout', ({ uid, action, count }) => {
      const isMe = uid === currentUser?.uid;
      if (action === 'forfeit') {
        srAnnounce(isMe ? 'You were AFK too long — forfeited!' : 'Opponent was AFK — you win!');
        sound.play(isMe ? 'loss' : 'win');
      } else if (action === 'auto-move') {
        if (isMe) {
          sound.play('timeout');
          srAnnounce('Time\'s up! A random move was made for you.');
          if (count >= 2) {
            sound.play('timeout-warning');
            $('turnText').textContent = 'Warning: 1 more timeout = forfeit!';
          }
        } else {
          sound.play('opponent-timeout');
          srAnnounce('Opponent timed out — random move played.');
        }
      }
    });

    // Player left — server tells us opponent disconnected
    window.multiplayerClient.onPlayerLeft(({ uid, reason }) => {
      if (uid !== currentUser?.uid && reason === 'disconnected') {
        $('turnText').textContent = mpOpponentName + ' disconnected — waiting 2 min...';
      }
    });
  }

  let mpPollTimer = null;
  let mpPollStartTime = 0;
  const MP_POLL_TIMEOUT = 120000; // 2 min max search time

  function mpPollForMatch() {
    mpStopPolling();
    mpPollStartTime = Date.now();

    mpPollTimer = setInterval(async () => {
      const elapsed = Date.now() - mpPollStartTime;

      try {
        const status = await window.multiplayerClient.getMatchmakingStatus();

        if (status?.status === 'matched' && status.sessionId) {
          mpStopPolling();
          window.multiplayerUI?.hideMatchmaking();
          await mpJoinAndPlay(status.sessionId);
          return;
        }

        if (status?.status === 'expired' || !status) {
          // Entry expired or gone — re-queue automatically
          if (elapsed < MP_POLL_TIMEOUT) {
            try {
              // Cancel first to clear any lingering entries before re-queuing
              await window.multiplayerClient.cancelMatchmaking().catch(() => {});
              const result = await window.multiplayerClient.findMatch('chess-3d');
              if (result.matchedSessionId) {
                mpStopPolling();
                window.multiplayerUI?.hideMatchmaking();
                await mpJoinAndPlay(result.matchedSessionId);
                return;
              }
              // Re-queued successfully, keep polling
            } catch (e) {
              console.warn('[Chess3D] Re-queue failed:', e.message || e);
              // Will retry next poll cycle
            }
          } else {
            // Time's up — give up
            mpStopPolling();
            window.multiplayerUI?.hideMatchmaking();
            showOverlay('mpLobbyOverlay');
            mpShowError('No opponents found after 2 minutes. Try again later.');
            return;
          }
        }

        // Update matchmaking UI with elapsed time
        if (window.multiplayerUI?.updateMatchmakingTime) {
          window.multiplayerUI.updateMatchmakingTime(Math.floor(elapsed / 1000));
        }

        // Timeout — give up after 2 min
        if (elapsed >= MP_POLL_TIMEOUT) {
          mpStopPolling();
          await window.multiplayerClient.cancelMatchmaking().catch(() => {});
          window.multiplayerUI?.hideMatchmaking();
          showOverlay('mpLobbyOverlay');
          mpShowError('No opponents found after 2 minutes. Try again later.');
        }
      } catch (e) { /* ignore polling errors */ }
    }, 3000); // Poll every 3s (cron matches every 5s)
  }

  function mpStopPolling() {
    if (mpPollTimer) { clearInterval(mpPollTimer); mpPollTimer = null; }
    if (_rematchPollTimer) { clearInterval(_rematchPollTimer); _rematchPollTimer = null; }
  }

  let _rematchPollTimer = null;

  /** Poll for a rematch invitation from the opponent while on game-over screen */
  function _pollForRematchInvitation() {
    if (_rematchPollTimer) clearInterval(_rematchPollTimer);

    _rematchPollTimer = setInterval(async () => {
      // Stop polling if we left the game-over screen
      if (!$('gameOverOverlay')?.classList.contains('chess3d-visible')) {
        clearInterval(_rematchPollTimer);
        _rematchPollTimer = null;
        return;
      }
      try {
        const invitations = await window.multiplayerClient?.getInvitations();
        if (!invitations?.length) return;

        // Find a chess-3d invitation from our opponent
        const rematchInvite = invitations.find(inv =>
          inv.fromUid === mpOpponentUid && inv.gameId === 'chess-3d' && inv.status === 'pending'
        );
        if (!rematchInvite) return;

        // Opponent created a rematch — auto-accept
        clearInterval(_rematchPollTimer);
        _rematchPollTimer = null;

        const btn = $('rematchBtn');
        btn.textContent = mpOpponentName + ' wants a rematch!';

        // Accept the invitation
        await window.multiplayerClient.respondToInvitation(rematchInvite.id, 'accept');

        // Clean up old session
        const oldSessionId = mpSessionId;
        mpStopTimers();
        try { window.multiplayerClient?.disconnect(); } catch (e) {}
        if (oldSessionId) {
          window.multiplayerClient?.leaveSession(oldSessionId).catch(() => {});
        }

        // Join the rematch session
        mpSessionId = rematchInvite.sessionId;
        mpIsHost = false;
        gameMode = 'multiplayer';

        hideOverlay('gameOverOverlay');
        showOverlay('mpJoiningOverlay');
        $('mpJoiningStatus').textContent = 'Joining rematch...';
        $('mpJoiningIcon').textContent = '♟️';
        $('mpJoiningIcon').style.color = 'var(--c3d-emerald)';
        sound.play('click');

        await mpJoinAndPlay(rematchInvite.sessionId);
      } catch (e) {
        console.warn('[Chess3D] Rematch poll error:', e);
      }
    }, 2000); // Poll every 2s
  }

  function mpFormatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function mpStartTurnTimer(isMyTurn) {
    if (mpTurnTimerInterval) clearInterval(mpTurnTimerInterval);

    const myTimer = $('bottomTimer');
    const oppTimer = $('topTimer');
    const activeTimer = isMyTurn ? myTimer : oppTimer;
    const inactiveTimer = isMyTurn ? oppTimer : myTimer;

    activeTimer.classList.add('active');
    activeTimer.classList.remove('warning');
    inactiveTimer.classList.remove('active', 'warning');

    mpTurnTimerInterval = setInterval(() => {
      if (!gameActive) { clearInterval(mpTurnTimerInterval); return; }
      const elapsed = (Date.now() - mpTurnStartTime) / 1000;
      const remaining = Math.max(0, MP_TURN_TIMEOUT - elapsed);

      activeTimer.textContent = mpFormatTime(remaining);
      inactiveTimer.textContent = '--:--';

      // Warning when < 30s
      if (remaining <= 30 && remaining > 0) {
        activeTimer.classList.add('warning');
      }

      if (remaining <= 0) {
        clearInterval(mpTurnTimerInterval);
        activeTimer.textContent = '0:00';
      }
    }, 500);
  }

  function mpStartGameClock() {
    if (mpGameTimerInterval) clearInterval(mpGameTimerInterval);
    const clockEl = $('gameClock');
    if (!clockEl) return;

    mpGameTimerInterval = setInterval(() => {
      if (!gameActive) { clearInterval(mpGameTimerInterval); return; }
      const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
      clockEl.textContent = mpFormatTime(elapsed);
    }, 1000);
  }

  function mpStopTimers() {
    if (mpTurnTimerInterval) { clearInterval(mpTurnTimerInterval); mpTurnTimerInterval = null; }
    if (mpGameTimerInterval) { clearInterval(mpGameTimerInterval); mpGameTimerInterval = null; }
  }

  // Track elapsed time at pause so we can resume accurately
  let mpPausedTurnElapsed = 0;
  let mpPausedGameElapsed = 0;
  let mpTimersPaused = false;

  function mpPauseTimers() {
    if (mpTimersPaused) return;
    mpTimersPaused = true;
    mpPausedTurnElapsed = (Date.now() - mpTurnStartTime) / 1000;
    mpPausedGameElapsed = (Date.now() - gameStartTime) / 1000;
    mpStopTimers();

    // Show paused state on timers
    const myTimer = $('bottomTimer');
    const oppTimer = $('topTimer');
    if (myTimer) myTimer.classList.add('warning');
    if (oppTimer) oppTimer.classList.add('warning');
    $('gameClock').textContent = mpFormatTime(mpPausedGameElapsed) + ' ⏸';
  }

  function mpResumeTimers() {
    if (!mpTimersPaused) return;
    mpTimersPaused = false;

    // Adjust start times to account for paused duration
    mpTurnStartTime = Date.now() - (mpPausedTurnElapsed * 1000);
    gameStartTime = Date.now() - (mpPausedGameElapsed * 1000);

    // Restart the timers
    const isMyTurn = chessEngine.getTurn() === playerColor;
    mpStartTurnTimer(isMyTurn);
    mpStartGameClock();
  }

  function mpCleanup(fullLeave) {
    const sid = mpSessionId;
    gameActive = false;
    gameMode = 'ai';
    mpSessionId = null;
    mpRematchSessionId = null;
    if (fullLeave) mpOpponentUid = null;
    if (_mpQuickMatchTimeout) { clearTimeout(_mpQuickMatchTimeout); _mpQuickMatchTimeout = null; }
    mpStopPolling();
    mpStopTimers();
    // Disconnect WebSocket — server gives 2 min reconnect window
    try { window.multiplayerClient?.disconnect(); } catch (e) {}
    // Only call leaveSession if fully leaving (not just going to menu to rejoin)
    if (fullLeave && sid) {
      window.multiplayerClient?.leaveSession(sid).catch(() => {});
    }
    // Save session ID for rejoin (unless fully leaving)
    if (!fullLeave && sid) {
      localStorage.setItem('chess3d-rejoin-session', sid);
    } else {
      localStorage.removeItem('chess3d-rejoin-session');
    }
    $('gameHud').style.display = 'none';
    $('undoBtn').style.display = '';
  }

  async function _checkRejoinableSession() {
    if (!currentUser || !window.multiplayerClient) return;

    const savedSid = localStorage.getItem('chess3d-rejoin-session');
    if (!savedSid) return;

    // Verify session is still active
    try {
      const session = await window.multiplayerClient.getSession(savedSid);
      if (session && (session.status === 'playing' || session.status === 'starting')) {
        // Auto-rejoin immediately — don't wait for user to click
        gameMode = 'multiplayer';
        mpSessionId = savedSid;

        // Restore opponent info from session data
        if (session.players) {
          for (const [uid, player] of Object.entries(session.players)) {
            if (uid !== currentUser?.uid) {
              mpOpponentUid = uid;
              mpOpponentName = player.displayName || 'Opponent';
            }
          }
        }

        hideOverlay('mainMenuOverlay');
        showOverlay('mpJoiningOverlay');
        $('mpJoiningStatus').textContent = 'Rejoining game...';
        $('mpJoiningIcon').textContent = '♟️';
        try {
          await mpJoinAndPlay(savedSid);
          // Don't remove localStorage here — game is active again.
          // onGameFinished or mpCleanup(true) will clear it when the game ends.
        } catch (e) {
          showOverlay('mainMenuOverlay');
          hideOverlay('mpJoiningOverlay');
          localStorage.removeItem('chess3d-rejoin-session');
        }
      } else {
        localStorage.removeItem('chess3d-rejoin-session');
      }
    } catch (e) {
      localStorage.removeItem('chess3d-rejoin-session');
    }
  }

  // On page close/refresh during active MP game — save session for rejoin
  window.addEventListener('beforeunload', () => {
    if (gameMode === 'multiplayer' && mpSessionId && gameActive) {
      // Save session ID so we can rejoin after refresh/navigation
      localStorage.setItem('chess3d-rejoin-session', mpSessionId);
      // Disconnect WebSocket — server gives 2 min reconnect window
      try { window.multiplayerClient?.disconnect(); } catch (e) {}
    }
  });

  /* ================================================================
     9b. PUZZLE MODE
     ================================================================ */

  function startPuzzle(idx) {
    const puzzle = DAILY_PUZZLES[idx];
    if (!puzzle) return;

    _pz.puzzleMode = true;
    _pz.puzzleIndex = idx;
    _pz.puzzleMoveIndex = 0;
    _pz.puzzleSolved = false;
    gameActive = true;
    gameMode = 'ai';

    chessEngine.reset();
    chessEngine.loadFEN(puzzle.fen);
    _pz.puzzleFenSnapshot = puzzle.fen;
    playerColor = chessEngine.getTurn();

    hideOverlay('mainMenuOverlay');
    hideOverlay('gameOverOverlay');

    placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);
    clearHighlights();
    for (const m of lastMoveHighlights) { try { m.dispose(); } catch(e) {} }
    lastMoveHighlights = [];
    clearCheckHighlight();
    isAnimating = false;
    selectedSquare = null;

    // Show puzzle HUD, hide normal HUD parts
    $('gameHud').style.display = '';
    $('undoBtn').style.display = 'none';
    $('drawOfferBtn').style.display = 'none';
    $('resignBtn').style.display = 'none';

    // Update player bars for puzzle
    $('topName').textContent = 'Puzzle';
    $('topElo').textContent = puzzle.difficulty;
    $('bottomName').textContent = 'You';
    $('bottomElo').textContent = '';
    $('moveList').innerHTML = '';
    $('topCaptured').innerHTML = '';
    $('bottomCaptured').innerHTML = '';
    $('topAdvantage').textContent = '';
    $('bottomAdvantage').textContent = '';

    // Show puzzle overlay
    const puzzleOvl = $('puzzleOverlay');
    if (puzzleOvl) {
      $('puzzleTitle').textContent = puzzle.title;
      $('puzzleDifficulty').textContent = puzzle.difficulty;
      $('puzzleDesc').textContent = puzzle.desc || '';
      $('puzzleMoveStatus').textContent = 'Find the winning move!';
      $('puzzleMoveStatus').className = 'chess3d-puzzle-status';
      puzzleOvl.style.display = 'flex';
    }

    $('turnText').textContent = 'Your turn — find the move!';
    resetCamera(playerColor === BLACK);
  }

  function handlePuzzleMove(fromRow, fromCol, toRow, toCol, promotion) {
    const puzzle = DAILY_PUZZLES[_pz.puzzleIndex];
    if (!puzzle || _pz.puzzleSolved) return;

    const expectedMove = puzzle.solution[_pz.puzzleMoveIndex];
    if (!expectedMove) return;

    // Convert move to algebraic notation for comparison
    const moveStr = FILE_NAMES[fromCol] + RANK_NAMES[fromRow] + FILE_NAMES[toCol] + RANK_NAMES[toRow] + (promotion || '');

    if (moveStr === expectedMove) {
      // Correct move
      const result = chessEngine.makeMove(fromRow, fromCol, toRow, toCol, promotion);
      if (!result) return;

      _pz.puzzleMoveIndex++;
      sound.play('move');

      animatePieceMove(fromRow, fromCol, toRow, toCol, () => {
        // Handle promotion mesh swap
        if (result.promotion) {
          const destKey = 'r' + toRow + 'c' + toCol;
          if (pieceMeshes[destKey]) pieceMeshes[destKey].dispose();
          const masterKey = playerColor + result.promotion;
          const instance = pieceMasters[masterKey].createInstance('piece_' + destKey);
          instance.position = new BABYLON.Vector3(toCol, 0.15, toRow);
          instance.metadata = { type: 'piece', row: toRow, col: toCol, pieceType: result.promotion, pieceColor: playerColor };
          instance.isPickable = true;
          pieceMeshes[destKey] = instance;
        }

        if (result.castle) {
          const rank = fromRow;
          if (result.castle === 'K') animatePieceMove(rank, 7, rank, 5, null);
          else animatePieceMove(rank, 0, rank, 3, null);
        }

        showLastMove(fromRow, fromCol, toRow, toCol);
        isAnimating = false;

        // Flash green
        showPuzzleFlash('correct');
        $('puzzleMoveStatus').textContent = 'Correct!';
        $('puzzleMoveStatus').className = 'chess3d-puzzle-status correct';

        // Check if puzzle is complete
        if (_pz.puzzleMoveIndex >= puzzle.solution.length) {
          _pz.puzzleSolved = true;
          markPuzzleSolved(_pz.puzzleIndex);
          sound.play('win');
          $('puzzleMoveStatus').textContent = 'Solved! Come back tomorrow for a new puzzle.';
          $('puzzleMoveStatus').className = 'chess3d-puzzle-status solved';
          $('turnText').textContent = 'Puzzle solved!';

          // Show a small celebration after a delay
          setTimeout(() => {
            gameActive = false;
            _pz.puzzleMode = false;
            $('gameOverTitle').textContent = 'Puzzle Solved!';
            $('gameOverReason').textContent = puzzle.title + ' — ' + puzzle.desc;
            $('gameOverElo').textContent = '';
            $('gameOverStats').textContent = 'Puzzles solved: ' + getPuzzleSolvedSet().size;
            showOverlay('gameOverOverlay');
          }, 1500);
          return;
        }

        // Play opponent's response move (next in solution) after a short delay
        if (_pz.puzzleMoveIndex < puzzle.solution.length) {
          setTimeout(() => {
            const oppMove = puzzle.solution[_pz.puzzleMoveIndex];
            if (!oppMove) return;
            const oFromCol = oppMove.charCodeAt(0) - 97;
            const oFromRow = parseInt(oppMove[1]) - 1;
            const oToCol = oppMove.charCodeAt(2) - 97;
            const oToRow = parseInt(oppMove[3]) - 1;
            const oPromo = oppMove[4] || null;

            const oppResult = chessEngine.makeMove(oFromRow, oFromCol, oToRow, oToCol, oPromo);
            if (oppResult) {
              _pz.puzzleMoveIndex++;
              sound.play('move');
              animatePieceMove(oFromRow, oFromCol, oToRow, oToCol, () => {
                showLastMove(oFromRow, oFromCol, oToRow, oToCol);
                isAnimating = false;

                if (_pz.puzzleMoveIndex >= puzzle.solution.length) {
                  _pz.puzzleSolved = true;
                  markPuzzleSolved(_pz.puzzleIndex);
                  sound.play('win');
                  $('puzzleMoveStatus').textContent = 'Solved! Come back tomorrow.';
                  $('puzzleMoveStatus').className = 'chess3d-puzzle-status solved';
                  $('turnText').textContent = 'Puzzle solved!';
                  setTimeout(() => {
                    gameActive = false;
                    _pz.puzzleMode = false;
                    $('gameOverTitle').textContent = 'Puzzle Solved!';
                    $('gameOverReason').textContent = puzzle.title + ' — ' + puzzle.desc;
                    $('gameOverElo').textContent = '';
                    $('gameOverStats').textContent = 'Puzzles solved: ' + getPuzzleSolvedSet().size;
                    showOverlay('gameOverOverlay');
                  }, 1500);
                } else {
                  $('puzzleMoveStatus').textContent = 'Your turn — find the next move!';
                  $('puzzleMoveStatus').className = 'chess3d-puzzle-status';
                  $('turnText').textContent = 'Your turn — find the move!';
                }
              });
            }
          }, 600);
        }
      });
    } else {
      // Wrong move — flash red, reset position
      sound.play('error');
      showPuzzleFlash('wrong');
      $('puzzleMoveStatus').textContent = 'Try again!';
      $('puzzleMoveStatus').className = 'chess3d-puzzle-status wrong';

      // Reset to puzzle position after a brief pause
      setTimeout(() => {
        chessEngine.reset();
        chessEngine.loadFEN(_pz.puzzleFenSnapshot);
        // Re-apply solved moves up to current position
        for (let i = 0; i < _pz.puzzleMoveIndex; i++) {
          const mv = DAILY_PUZZLES[_pz.puzzleIndex].solution[i];
          const fC = mv.charCodeAt(0) - 97, fR = parseInt(mv[1]) - 1;
          const tC = mv.charCodeAt(2) - 97, tR = parseInt(mv[3]) - 1;
          const pr = mv[4] || null;
          chessEngine.makeMove(fR, fC, tR, tC, pr);
        }
        placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);
        clearHighlights();
        for (const m of lastMoveHighlights) { try { m.dispose(); } catch(e) {} }
        lastMoveHighlights = [];
        isAnimating = false;
        $('puzzleMoveStatus').textContent = 'Find the winning move!';
        $('puzzleMoveStatus').className = 'chess3d-puzzle-status';
      }, 800);
    }
  }

  function showPuzzleFlash(type) {
    if (!scene) return;
    // Flash all board squares briefly
    const color = type === 'correct'
      ? new BABYLON.Color3(0.2, 0.8, 0.3)
      : new BABYLON.Color3(0.8, 0.2, 0.2);

    const origColors = [];
    for (const sq of boardMeshes) {
      if (sq.metadata?.type !== 'square') continue;
      origColors.push({ mesh: sq, color: sq.material.albedoColor.clone() });
      sq.material.albedoColor = BABYLON.Color3.Lerp(sq.material.albedoColor, color, 0.4);
    }

    setTimeout(() => {
      for (const { mesh, color } of origColors) {
        if (mesh.material) mesh.material.albedoColor = color;
      }
    }, 300);
  }

  /* ================================================================
     9c. GAME FLOW
     ================================================================ */

  function startNewGame() {
    chessEngine.reset();
    gameActive = true;
    gameStartTime = Date.now();
    moveCount = 0;

    // Clear captured pieces from board sides
    for (const m of capturedMeshes3D) { try { m.dispose(); } catch (e) {} }
    capturedMeshes3D = [];
    selectedSquare = null;
    isAnimating = false;
    _pz.puzzleMode = false;
    _pz.puzzleSolved = false;
    startAmbientMusic();

    // Hide puzzle overlay if visible
    const puzzleOvl = $('puzzleOverlay');
    if (puzzleOvl) puzzleOvl.style.display = 'none';

    // Restore HUD buttons hidden during puzzle mode
    $('undoBtn').style.display = '';
    $('resignBtn').style.display = '';

    hideOverlay('mainMenuOverlay');
    hideOverlay('gameOverOverlay');

    // Setup pieces
    placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);
    clearHighlights();
    for (const m of lastMoveHighlights) { try { m.dispose(); } catch(e) {} }
    lastMoveHighlights = [];
    clearCheckHighlight();

    // Show HUD
    $('gameHud').style.display = '';

    // Update player display
    const aiColor = playerColor === WHITE ? BLACK : WHITE;
    $('topName').textContent = 'AI (' + aiDifficulty.charAt(0).toUpperCase() + aiDifficulty.slice(1) + ')';
    $('topElo').textContent = 'ELO ' + AI_ELO[aiDifficulty];
    $('bottomName').textContent = currentUser?.displayName || 'You';
    $('bottomElo').textContent = 'ELO ' + elo.rating;

    // Clear move list, captured
    $('moveList').innerHTML = '';
    $('topCaptured').innerHTML = '';
    $('bottomCaptured').innerHTML = '';
    $('topAdvantage').textContent = '';
    $('bottomAdvantage').textContent = '';

    updateTurnIndicator();

    // Reset camera
    resetCamera(playerColor === BLACK);

    // If player is black, AI moves first
    if (playerColor === BLACK) {
      scheduleAIMove();
    }
  }

  function endGame(winner, reason) {
    gameActive = false;
    stopAmbientMusic();
    $('thinkingIndicator').style.display = 'none';

    const gameTimeMs = Date.now() - gameStartTime;
    let result, resultText, scoreResult;

    if (winner === 'draw') {
      result = 'draw';
      resultText = 'Draw';
      scoreResult = 0.5;
      sound.play('draw');
    } else if ((winner === 'white' && playerColor === WHITE) || (winner === 'black' && playerColor === BLACK)) {
      result = 'win';
      resultText = 'You Win!';
      scoreResult = 1;
      sound.play('win');
    } else {
      result = 'loss';
      resultText = 'You Lose';
      scoreResult = 0;
      sound.play('loss');
    }

    // Track beating Hard AI for Royal skin unlock
    if (result === 'win' && (aiDifficulty === 'hard' || aiDifficulty === 'expert')) {
      try {
        const stats = JSON.parse(localStorage.getItem('chess3d-stats') || '{}');
        stats.beatHard = true;
        localStorage.setItem('chess3d-stats', JSON.stringify(stats));
      } catch (e) {}
    }

    // Calculate ELO
    const eloResult = elo.calculateNewRating(AI_ELO[aiDifficulty], scoreResult);

    // Update game over screen
    $('gameOverTitle').textContent = resultText;
    $('gameOverReason').textContent = reason || '';

    const eloDiv = $('gameOverElo');
    const delta = eloResult.delta;
    if (delta > 0) {
      eloDiv.textContent = 'ELO ' + eloResult.newRating + ' (+' + delta + ')';
      eloDiv.className = 'chess3d-elo-change positive';
    } else if (delta < 0) {
      eloDiv.textContent = 'ELO ' + eloResult.newRating + ' (' + delta + ')';
      eloDiv.className = 'chess3d-elo-change negative';
    } else {
      eloDiv.textContent = 'ELO ' + eloResult.newRating + ' (0)';
      eloDiv.className = 'chess3d-elo-change neutral';
    }

    $('gameOverStats').textContent = moveCount + ' moves \u00b7 ' + formatTime(gameTimeMs);

    // Near-miss tease — show what's almost achieved
    const tease = getNearMissTease(eloResult.newRating, result, moveCount);
    const teaseEl = $('gameOverTease');
    if (teaseEl) {
      teaseEl.textContent = tease || '';
      teaseEl.style.display = tease ? '' : 'none';
    }

    showOverlay('gameOverOverlay');

    // Submit score
    submitScore(result, gameTimeMs, reason, eloResult.delta);
  }

  async function submitScore(result, gameTimeMs, terminationType, eloDelta) {
    if (!currentUser || !window.apiClient) return;
    // In multiplayer, the server submits scores — skip client submission
    if (gameMode === 'multiplayer') return;

    try {
      await window.apiClient.submitScore(GAME_ID, {
        score: elo.rating,
        timeMs: gameTimeMs,
        metadata: {
          result: result,
          opponent: 'ai',
          aiDifficulty: aiDifficulty,
          movesPlayed: moveCount,
          eloDelta: eloDelta,
          openingName: detectOpening(),
          terminationType: ({
            'Checkmate': 'checkmate', 'Resignation': 'resignation',
            'Stalemate': 'stalemate', 'Threefold repetition': 'draw',
            'Fivefold repetition': 'draw', 'Insufficient material': 'draw',
            '50-move rule': 'draw', '75-move rule': 'draw'
          })[terminationType] || 'draw'
        }
      });

      // Save cloud state (map to DTO: currentLevel=tier, gamesWon=wins)
      await window.apiClient.saveGameState(GAME_ID, {
        currentLevel: Math.max(1, Math.floor(elo.rating / 200)),
        currentStreak: Math.max(0, elo.streak),
        bestStreak: Math.max(0, elo.bestStreak),
        gamesPlayed: elo.gamesPlayed,
        gamesWon: elo.wins,
        additionalData: {
          elo: elo.rating,
          losses: elo.losses,
          draws: elo.draws,
        }
      });
    } catch (e) {
      console.warn('[Chess3D] Score submission failed:', e);
    }
  }

  function detectOpening() {
    const history = chessEngine.getHistory();
    if (history.length < 2) return 'Unknown';

    const first2 = history.slice(0, 4).join(' ');
    if (first2.includes('e4') && first2.includes('e5')) return 'Open Game';
    if (first2.includes('e4') && first2.includes('c5')) return 'Sicilian Defense';
    if (first2.includes('e4') && first2.includes('e6')) return 'French Defense';
    if (first2.includes('e4') && first2.includes('c6')) return 'Caro-Kann Defense';
    if (first2.includes('e4') && first2.includes('d5')) return 'Scandinavian Defense';
    if (first2.includes('d4') && first2.includes('d5')) return "Queen's Gambit";
    if (first2.includes('d4') && first2.includes('Nf6')) return 'Indian Defense';
    if (first2.includes('Nf3')) return 'Reti Opening';
    if (first2.includes('c4')) return 'English Opening';
    return 'Unknown';
  }

  /* ================================================================
     10. UI UPDATES
     ================================================================ */

  function updateMenuDisplay() {
    const tier = elo.getTier();
    $('menuEloBadge').textContent = tier.badge;
    $('menuEloBadge').style.color = tier.color;
    $('menuEloValue').textContent = 'ELO ' + elo.rating + ' (' + tier.name + ')';

    const stats = [];
    if (elo.gamesPlayed > 0) {
      stats.push(elo.wins + 'W / ' + elo.draws + 'D / ' + elo.losses + 'L');
      const winRate = elo.gamesPlayed > 0 ? Math.round((elo.wins / elo.gamesPlayed) * 100) : 0;
      stats.push(winRate + '% win rate');
    }
    $('menuStats').textContent = stats.join(' \u00b7 ') || 'No games played yet';

    // Check for active MP sessions to rejoin
    _checkRejoinableSession();

    // Update skin unlock indicators
    document.querySelectorAll('.chess3d-skin-btn').forEach(btn => {
      const skinName = btn.dataset.skin;
      if (skinName && !isSkinUnlocked(skinName)) {
        btn.classList.add('locked');
      } else {
        btn.classList.remove('locked');
      }
    });

    // Update daily puzzle badge
    const puzzleBtn = $('dailyPuzzleBtn');
    if (puzzleBtn) {
      const todayIdx = getDailyPuzzleIndex();
      const badge = puzzleBtn.querySelector('.chess3d-puzzle-badge');
      if (badge) badge.textContent = getPuzzleSolvedSet().has(todayIdx) ? 'Solved' : 'New';
    }
  }

  let _lastTurnWasMine = null;
  function updateTurnIndicator() {
    const isMyTurn = chessEngine.getTurn() === playerColor;
    $('turnText').textContent = isMyTurn ? 'Your turn' : 'AI thinking...';

    // Sound + visual pulse when turn changes to you
    if (_lastTurnWasMine !== null && isMyTurn !== _lastTurnWasMine) {
      if (isMyTurn) {
        sound.play('click');
      }
      // Flash the turn indicator
      const el = $('turnIndicator');
      if (el) {
        el.classList.add('chess3d-turn-flash');
        setTimeout(() => el.classList.remove('chess3d-turn-flash'), 600);
      }
      // Pulse the active player bar
      const bar = isMyTurn ? $('playerBottom') : $('playerTop');
      if (bar) {
        bar.classList.add('chess3d-bar-pulse');
        setTimeout(() => bar.classList.remove('chess3d-bar-pulse'), 600);
      }
    }
    _lastTurnWasMine = isMyTurn;
  }

  function updateMoveHistory() {
    const history = chessEngine.getHistory();

    // Update desktop move list
    const list = $('moveList');
    _renderMoveList(list, history);

    // Update mobile move list + collapsed preview
    const mobileList = $('mobileMoveList');
    if (mobileList) {
      _renderMoveList(mobileList, history);
      const countEl = $('mobileMovesCount');
      if (countEl) countEl.textContent = history.length;
      // Show last move in collapsed header for quick context
      const lastEl = $('mobileMovesLast');
      if (lastEl && history.length > 0) {
        const moveNum = Math.ceil(history.length / 2);
        const lastMove = history[history.length - 1];
        const isWhite = history.length % 2 === 1;
        lastEl.textContent = moveNum + '.' + (isWhite ? '' : '..') + lastMove;
      }
    }
  }

  function _renderMoveList(container, history) {
    if (!container) return;
    container.textContent = '';
    for (let i = 0; i < history.length; i += 2) {
      const row = document.createElement('div');
      row.className = 'chess3d-move-row';
      const num = document.createElement('span');
      num.className = 'chess3d-move-num';
      num.textContent = (Math.floor(i / 2) + 1) + '.';
      const white = document.createElement('span');
      white.className = 'chess3d-move-white';
      white.textContent = history[i];
      row.appendChild(num);
      row.appendChild(white);
      if (history[i + 1]) {
        const black = document.createElement('span');
        black.className = 'chess3d-move-black';
        black.textContent = history[i + 1];
        row.appendChild(black);
      }
      container.appendChild(row);
    }
    container.scrollTop = container.scrollHeight;
  }

  function updateCapturedPieces() {
    const captured = { w: [], b: [] };
    const history = chessEngine.moveHistory;

    for (const move of history) {
      if (move.captured) {
        captured[move.captured.color].push(move.captured.type);
      }
      if (move.undo?.enPassantCapture) {
        captured[move.undo.enPassantCapture.color].push('p');
      }
    }

    // Sort by value
    const sortOrder = { q: 0, r: 1, b: 2, n: 3, p: 4 };
    for (const color of [WHITE, BLACK]) {
      captured[color].sort((a, b) => sortOrder[a] - sortOrder[b]);
    }

    // Determine which display goes where based on player color
    const topColor = playerColor === WHITE ? BLACK : WHITE; // opponent is top
    const botColor = playerColor;

    // Pieces captured BY top player (opponent) = player's pieces that were captured
    $('topCaptured').innerHTML = captured[botColor].map(t => PIECE_UNICODE[botColor + t]).join('');
    $('bottomCaptured').innerHTML = captured[topColor].map(t => PIECE_UNICODE[topColor + t]).join('');

    // Material advantage
    let matDiff = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = chessEngine.getPieceAt(r, c);
        if (!p || p.type === 'k') continue;
        matDiff += (p.color === WHITE ? 1 : -1) * PIECE_VALUES[p.type];
      }
    }

    const playerAdv = playerColor === WHITE ? matDiff : -matDiff;
    if (playerAdv > 0) {
      $('bottomAdvantage').textContent = '+' + Math.round(playerAdv / 100);
      $('topAdvantage').textContent = '';
    } else if (playerAdv < 0) {
      $('topAdvantage').textContent = '+' + Math.round(-playerAdv / 100);
      $('bottomAdvantage').textContent = '';
    } else {
      $('topAdvantage').textContent = '';
      $('bottomAdvantage').textContent = '';
    }
  }

  function formatTime(ms) {
    const seconds = Math.floor(ms / 1000);
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return min + ':' + (sec < 10 ? '0' : '') + sec;
  }

  // Near-miss tease — motivate the player to try again
  function getNearMissTease(currentElo, result, moves) {
    const teases = [];

    // ELO tier proximity
    const tiers = [
      { name: 'Knight', elo: 1000 },
      { name: 'Bishop', elo: 1200 },
      { name: 'Rook', elo: 1400 },
      { name: 'Queen', elo: 1600 },
      { name: 'King', elo: 1800 },
      { name: 'Grandmaster', elo: 2000 },
    ];
    for (const tier of tiers) {
      const gap = tier.elo - currentElo;
      if (gap > 0 && gap <= 50) {
        teases.push('Only ' + gap + ' ELO from ' + tier.name + ' tier!');
        break;
      }
    }

    // Win streak proximity
    if (result === 'win' && elo.streak >= 2 && elo.streak < 3) {
      teases.push('1 more win for Hat Trick achievement!');
    } else if (result === 'win' && elo.streak >= 4 && elo.streak < 5) {
      teases.push('1 more win for Unstoppable achievement!');
    }

    // Quick mate proximity
    if (result === 'win' && moves <= 10 && moves > 7) {
      teases.push('Close! Win in 7 moves for Scholar\'s Mate achievement.');
    }

    // Loss encouragement
    if (result === 'loss') {
      teases.push('Try again — every game makes you better.');
    }

    return teases[0] || null; // Show the most relevant tease
  }

  // --- Ambient Music ---
  let ambientPlaying = false;
  let ambientNodes = [];

  function startAmbientMusic() {
    if (ambientPlaying || sound.muted) return;
    try { sound._ensureContext(); } catch (e) { return; }
    const ctx = sound.ctx;
    if (!ctx) return;

    ambientPlaying = true;

    // Root drone (A3 = 220Hz)
    const drone = ctx.createOscillator();
    const droneGain = ctx.createGain();
    drone.type = 'sine';
    drone.frequency.value = 220;
    droneGain.gain.value = 0.015;
    drone.connect(droneGain).connect(ctx.destination);
    drone.start();
    ambientNodes.push({ osc: drone, gain: droneGain });

    // Fifth (E4 = 330Hz)
    const fifth = ctx.createOscillator();
    const fifthGain = ctx.createGain();
    fifth.type = 'sine';
    fifth.frequency.value = 330;
    fifthGain.gain.value = 0.008;
    fifth.connect(fifthGain).connect(ctx.destination);
    fifth.start();
    ambientNodes.push({ osc: fifth, gain: fifthGain });

    // Slow LFO for subtle movement
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 2;
    lfo.connect(lfoGain).connect(drone.frequency);
    lfo.start();
    ambientNodes.push({ osc: lfo, gain: lfoGain });
  }

  function stopAmbientMusic() {
    if (!ambientPlaying) return;
    ambientPlaying = false;
    const ctx = sound.ctx;
    if (!ctx) return;
    for (const node of ambientNodes) {
      try {
        node.gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1);
        node.osc.stop(ctx.currentTime + 1.1);
      } catch (e) {}
    }
    ambientNodes = [];
  }

  // --- Overlay helpers ---
  function showOverlay(id) {
    const el = $(id);
    if (el) el.classList.add('chess3d-visible');
    // Detach camera controls so overlays can receive pointer events
    if (camera) camera.detachControl();
  }

  function hideOverlay(id) {
    const el = $(id);
    if (el) el.classList.remove('chess3d-visible');
    // Re-attach camera controls if no overlays are open
    const anyOpen = document.querySelector('.chess3d-overlay.chess3d-visible');
    if (!anyOpen && camera) camera.attachControl($('renderCanvas'), true);
  }

  // --- SR announce ---
  function srAnnounce(text) {
    const el = $('srAnnounce');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = text; });
  }

  /* ================================================================
     11. INIT
     ================================================================ */

  // Wait for Babylon.js to be ready
  if (typeof BABYLON !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initGame);
    } else {
      initGame();
    }
  } else {
    // Wait for Babylon.js CDN script
    window.addEventListener('load', () => {
      if (typeof BABYLON !== 'undefined') {
        initGame();
      } else {
        console.error('[Chess3D] Babylon.js not loaded');
      }
    });
  }

})();

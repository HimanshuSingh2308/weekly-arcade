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

  // Colors
  const COL_LIGHT_SQ = new BABYLON.Color3(0.94, 0.85, 0.71);   // #F0D9B5
  const COL_DARK_SQ = new BABYLON.Color3(0.36, 0.20, 0.09);    // #5C3317
  const COL_WHITE_PIECE = new BABYLON.Color3(0.96, 0.94, 0.91); // #F5F0E8
  const COL_BLACK_PIECE = new BABYLON.Color3(0.17, 0.17, 0.17); // #2C2C2C
  const COL_GOLD = new BABYLON.Color3(0.79, 0.66, 0.30);       // #C9A84C
  const COL_EMERALD = new BABYLON.Color3(0.24, 0.67, 0.38);    // #3DAA62
  const COL_RED = new BABYLON.Color3(0.75, 0.22, 0.17);        // #C0392B
  const COL_BLUE = new BABYLON.Color3(0.20, 0.40, 0.70);

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
                    !this.board[rank][5] && !this.board[rank][6] &&
                    !this._isSquareAttackedBy(rank, 4, opp) &&
                    !this._isSquareAttackedBy(rank, 5, opp) &&
                    !this._isSquareAttackedBy(rank, 6, opp)) {
                  moves.push({ from: [r, c], to: [rank, 6], castle: 'K' });
                }
                // Queenside
                const castleQ = color === WHITE ? 'Q' : 'q';
                if (this.castling[castleQ] &&
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

  // Opening book (Expert only)
  const OPENING_BOOK = {
    'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': [
      { from: [1,4], to: [3,4], w: 40 }, // e4
      { from: [1,3], to: [3,3], w: 35 }, // d4
      { from: [0,6], to: [2,5], w: 15 }, // Nf3
      { from: [1,2], to: [3,2], w: 10 }, // c4
    ],
    // After 1.e4
    'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1': [
      { from: [6,4], to: [4,4], w: 35 }, // e5
      { from: [6,2], to: [4,2], w: 30 }, // c5 (Sicilian)
      { from: [6,4], to: [5,4], w: 15 }, // e6 (French)
      { from: [6,2], to: [5,2], w: 10 }, // c6 (Caro-Kann)
      { from: [6,3], to: [4,3], w: 10 }, // d5 (Scandinavian)
    ],
    // After 1.d4
    'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1': [
      { from: [6,3], to: [4,3], w: 40 }, // d5
      { from: [7,6], to: [5,5], w: 30 }, // Nf6 (Indian)
      { from: [6,4], to: [5,4], w: 15 }, // e6
      { from: [6,5], to: [4,5], w: 10 }, // f5 (Dutch)
    ],
    // After 1.e4 e5
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': [
      { from: [0,6], to: [2,5], w: 50 }, // Nf3
      { from: [1,5], to: [3,5], w: 20 }, // f4 (King's Gambit)
      { from: [0,5], to: [3,2], w: 15 }, // Bc4
    ],
    // After 1.e4 e5 2.Nf3
    'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2': [
      { from: [7,1], to: [5,2], w: 50 }, // Nc6
      { from: [7,6], to: [5,5], w: 25 }, // Nf6 (Petrov)
      { from: [6,3], to: [5,3], w: 15 }, // d6 (Philidor)
    ],
    // After 1.e4 c5 (Sicilian)
    'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2': [
      { from: [0,6], to: [2,5], w: 60 }, // Nf3 (Open Sicilian)
      { from: [1,2], to: [2,2], w: 20 }, // c3 (Alapin)
      { from: [1,3], to: [3,3], w: 10 }, // d4
    ],
    // After 1.d4 d5
    'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2': [
      { from: [1,2], to: [3,2], w: 45 }, // c4 (Queen's Gambit)
      { from: [0,6], to: [2,5], w: 30 }, // Nf3
      { from: [0,1], to: [2,2], w: 15 }, // Nc3
    ],
    // After 1.d4 Nf6
    'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2': [
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

      // Opening book check for expert
      if (difficulty === 'expert') {
        const fen = this.engine.getFEN();
        const bookMoves = OPENING_BOOK[fen];
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
      let alpha = -Infinity;
      const beta = Infinity;

      for (const move of ordered) {
        const undo = this.engine._applyMoveRaw(move);
        const score = -this._alphaBeta(depth - 1, -beta, -alpha, startTime, timeLimit);
        this.engine._undoMoveRaw(undo);

        if (score > bestScore) {
          bestScore = score;
          bestMove = move;
        }
        if (score > alpha) alpha = score;

        // Time check
        if (Date.now() - startTime > timeLimit) break;
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
      this.rating = parseInt(localStorage.getItem('chess3d-elo')) || 1200;
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
      if (this.gamesPlayed < 20) return 40;
      if (this.rating < 1000) return 40;
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
    }

    _ensureContext() {
      if (!this.ctx) {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    }

    toggle() {
      this.muted = !this.muted;
      localStorage.setItem('chess3d-mute', this.muted.toString());
      return !this.muted;
    }

    play(type) {
      if (this.muted) return;
      try { this._ensureContext(); } catch (e) { return; }

      switch (type) {
        case 'move': this._playTone(300, 0.08, 'triangle', 0.25); break;
        case 'capture': this._playNoise(0.15, 600, 0.35); break;
        case 'check': this._playChime([880, 1100], 0.3, 0.3); break;
        case 'checkmate': this._playChime([440, 554, 659], 0.5, 0.4); break;
        case 'castle': this._playTone(280, 0.06, 'triangle', 0.2); setTimeout(() => this._playTone(320, 0.06, 'triangle', 0.2), 80); break;
        case 'promotion': this._playChime([523, 659, 784, 1047], 0.12, 0.25); break;
        case 'win': this._playChime([440, 554, 659, 880], 0.4, 0.4); break;
        case 'loss': this._playChime([440, 370, 330], 0.4, 0.35); break;
        case 'draw': this._playChime([440, 494, 554], 0.5, 0.3); break;
        case 'click': this._playTone(800, 0.02, 'sine', 0.15); break;
        case 'error': this._playTone(150, 0.15, 'square', 0.2); break;
      }
    }

    _playTone(freq, duration, type, vol) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.value = vol * this.volume;
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain).connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration + 0.01);
    }

    _playNoise(duration, filterFreq, vol) {
      const bufferSize = this.ctx.sampleRate * duration;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const source = this.ctx.createBufferSource();
      source.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = filterFreq;
      const gain = this.ctx.createGain();
      gain.gain.value = vol * this.volume;
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      source.connect(filter).connect(gain).connect(this.ctx.destination);
      source.start();
      source.stop(this.ctx.currentTime + duration + 0.01);
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

    // Camera
    camera = new BABYLON.ArcRotateCamera('cam', Math.PI / 4, Math.PI / 3.5, 22, new BABYLON.Vector3(3.5, 0, 3.5), scene);
    camera.attachControl(canvas, true);
    camera.lowerRadiusLimit = 10;
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
    baseMat.albedoColor = new BABYLON.Color3(0.22, 0.13, 0.06);
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
    switch (type) {
      case 'p': mesh = _createPawnMesh(scene); break;
      case 'r': mesh = _createRookMesh(scene); break;
      case 'n': mesh = _createKnightMesh(scene); break;
      case 'b': mesh = _createBishopMesh(scene); break;
      case 'q': mesh = _createQueenMesh(scene); break;
      case 'k': mesh = _createKingMesh(scene); break;
    }
    mesh.material = mat;
    mesh.name = 'master_' + color + type;
    return mesh;
  }

  function _createPawnMesh(scene) {
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.3, diameter: 0.5, tessellation: 16 }, scene);
    const stem = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.35, diameter: 0.22, tessellation: 12 }, scene);
    stem.position.y = 0.32;
    const head = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.3, segments: 12 }, scene);
    head.position.y = 0.56;
    const merged = BABYLON.Mesh.MergeMeshes([base, stem, head], true, true, undefined, false, true);
    merged.scaling.y = 1;
    return merged;
  }

  function _createRookMesh(scene) {
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.3, diameter: 0.55, tessellation: 16 }, scene);
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.55, diameter: 0.38, tessellation: 16 }, scene);
    body.position.y = 0.4;
    const top = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.12, diameter: 0.48, tessellation: 16 }, scene);
    top.position.y = 0.73;
    const merged = BABYLON.Mesh.MergeMeshes([base, body, top], true, true, undefined, false, true);
    return merged;
  }

  function _createKnightMesh(scene) {
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.3, diameter: 0.55, tessellation: 16 }, scene);
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.5, diameter: 0.3, tessellation: 12 }, scene);
    body.position.y = 0.38;
    const head = BABYLON.MeshBuilder.CreateBox('', { width: 0.2, height: 0.35, depth: 0.4 }, scene);
    head.position.y = 0.72;
    head.position.z = 0.08;
    head.rotation.x = -0.3;
    const merged = BABYLON.Mesh.MergeMeshes([base, body, head], true, true, undefined, false, true);
    return merged;
  }

  function _createBishopMesh(scene) {
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.3, diameter: 0.55, tessellation: 16 }, scene);
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.6, diameterTop: 0.18, diameterBottom: 0.35, tessellation: 16 }, scene);
    body.position.y = 0.45;
    const tip = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.15, segments: 10 }, scene);
    tip.position.y = 0.85;
    const merged = BABYLON.Mesh.MergeMeshes([base, body, tip], true, true, undefined, false, true);
    return merged;
  }

  function _createQueenMesh(scene) {
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.3, diameter: 0.6, tessellation: 16 }, scene);
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.65, diameterTop: 0.22, diameterBottom: 0.4, tessellation: 16 }, scene);
    body.position.y = 0.47;
    const crown = BABYLON.MeshBuilder.CreateTorus('', { diameter: 0.3, thickness: 0.06, tessellation: 16 }, scene);
    crown.position.y = 0.88;
    const tip = BABYLON.MeshBuilder.CreateSphere('', { diameter: 0.18, segments: 10 }, scene);
    tip.position.y = 0.98;
    const merged = BABYLON.Mesh.MergeMeshes([base, body, crown, tip], true, true, undefined, false, true);
    return merged;
  }

  function _createKingMesh(scene) {
    const base = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.3, diameter: 0.6, tessellation: 16 }, scene);
    const body = BABYLON.MeshBuilder.CreateCylinder('', { height: 0.7, diameterTop: 0.25, diameterBottom: 0.42, tessellation: 16 }, scene);
    body.position.y = 0.50;
    // Cross
    const crossV = BABYLON.MeshBuilder.CreateBox('', { width: 0.08, height: 0.28, depth: 0.08 }, scene);
    crossV.position.y = 1.03;
    const crossH = BABYLON.MeshBuilder.CreateBox('', { width: 0.22, height: 0.08, depth: 0.08 }, scene);
    crossH.position.y = 1.08;
    const merged = BABYLON.Mesh.MergeMeshes([base, body, crossV, crossH], true, true, undefined, false, true);
    return merged;
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

    const duration = 20; // frames (~333ms at 60fps)
    let frame = 0;

    const observer = scene.onBeforeRenderObservable.add(() => {
      frame++;
      const t = Math.min(frame / duration, 1);
      const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

      mesh.position.x = startPos.x + (endPos.x - startPos.x) * eased;
      mesh.position.z = startPos.z + (endPos.z - startPos.z) * eased;
      mesh.position.y = startPos.y + (endPos.y - startPos.y) * eased + Math.sin(eased * Math.PI) * peakH;

      if (t >= 1) {
        mesh.position = endPos;
        scene.onBeforeRenderObservable.remove(observer);
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
    for (const move of moves) {
      const r = move.to[0], c = move.to[1];
      const isCapture = move.capture;

      const disc = BABYLON.MeshBuilder.CreateDisc('highlight', {
        radius: isCapture ? 0.42 : 0.16,
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

  function showLastMove(fromRow, fromCol, toRow, toCol) {
    for (const m of lastMoveHighlights) m.dispose();
    lastMoveHighlights = [];

    for (const [r, c] of [[fromRow, fromCol], [toRow, toCol]]) {
      const sq = BABYLON.MeshBuilder.CreatePlane('lastMove', { size: 0.95 }, scene);
      sq.rotation.x = Math.PI / 2;
      sq.position = new BABYLON.Vector3(c, 0.015, r);
      const mat = new BABYLON.StandardMaterial('lmMat', scene);
      mat.diffuseColor = COL_BLUE.clone();
      mat.alpha = 0.25;
      mat.disableLighting = true;
      sq.material = mat;
      sq.isPickable = false;
      lastMoveHighlights.push(sq);
    }
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

  function resetCamera(forBlack) {
    const targetAlpha = forBlack ? Math.PI / 4 + Math.PI : Math.PI / 4;
    const targetBeta = Math.PI / 3.5;
    const targetRadius = 22;

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

  // DOM refs
  const $ = (id) => document.getElementById(id);

  function initGame() {
    chessEngine = new ChessEngine();
    chessAI = new ChessAI(chessEngine);
    elo = new EloSystem();
    sound = new SoundManager();
    multiplayer = new MultiplayerManager();

    // Init Babylon
    const canvas = $('renderCanvas');
    babylonSetup = initBabylon(canvas);
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
              if (state?.elo) {
                elo.rating = state.elo;
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
  }

  function setupMenuUI() {
    // Difficulty buttons
    const diffBtns = document.querySelectorAll('.chess3d-diff-btn');
    diffBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        diffBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        aiDifficulty = btn.dataset.diff;
        localStorage.setItem('chess3d-difficulty', aiDifficulty);
        sound.play('click');
      });
    });

    // Color buttons
    const colorBtns = document.querySelectorAll('.chess3d-color-btn');
    colorBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        colorBtns.forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        sound.play('click');
      });
    });

    // Play AI button
    $('playAIBtn').addEventListener('click', () => {
      sound.play('click');
      const colorChoice = document.querySelector('.chess3d-color-btn.selected')?.dataset.color || 'white';
      playerColor = colorChoice === 'random' ? (Math.random() < 0.5 ? WHITE : BLACK) : (colorChoice === 'white' ? WHITE : BLACK);
      startNewGame();
    });

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

    // Resign dialog
    $('resignConfirmBtn').addEventListener('click', () => {
      hideOverlay('resignOverlay');
      endGame(playerColor === WHITE ? 'black' : 'white', 'Resignation');
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

    // Game over buttons
    $('rematchBtn').addEventListener('click', () => {
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
    executePlayerMove(fromRow, fromCol, toRow, toCol, promotionPiece);
  }

  function executePlayerMove(fromRow, fromCol, toRow, toCol, promotion) {
    deselectPiece();
    isAnimating = true;

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

      // Handle castling rook animation
      if (result.castle) {
        const rank = fromRow;
        if (result.castle === 'K') {
          animatePieceMove(rank, 7, rank, 5, null);
          // Update the piece mesh mapping for rook
          const rookKey = 'r' + rank + 'c7';
          const newKey = 'r' + rank + 'c5';
          if (pieceMeshes[rookKey]) {
            pieceMeshes[newKey] = pieceMeshes[rookKey];
            delete pieceMeshes[rookKey];
          }
        } else {
          animatePieceMove(rank, 0, rank, 3, null);
          const rookKey = 'r' + rank + 'c0';
          const newKey = 'r' + rank + 'c3';
          if (pieceMeshes[rookKey]) {
            pieceMeshes[newKey] = pieceMeshes[rookKey];
            delete pieceMeshes[rookKey];
          }
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

    // Use setTimeout to not block the UI
    setTimeout(() => {
      const move = chessAI.findBestMove(aiDifficulty);
      $('thinkingIndicator').style.display = 'none';

      if (!move || !gameActive) return;

      isAnimating = true;
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
            const rookKey = 'r' + rank + 'c7';
            const newKey = 'r' + rank + 'c5';
            if (pieceMeshes[rookKey]) { pieceMeshes[newKey] = pieceMeshes[rookKey]; delete pieceMeshes[rookKey]; }
          } else {
            animatePieceMove(rank, 0, rank, 3, null);
            const rookKey = 'r' + rank + 'c0';
            const newKey = 'r' + rank + 'c3';
            if (pieceMeshes[rookKey]) { pieceMeshes[newKey] = pieceMeshes[rookKey]; delete pieceMeshes[rookKey]; }
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
      sound.play('checkmate');
      srAnnounce('Checkmate! ' + winner + ' wins.');
      setTimeout(() => endGame(winner, 'Checkmate'), 400);
      return true;
    }
    if (chessEngine.isDraw()) {
      const reason = chessEngine.getDrawReason();
      sound.play('draw');
      srAnnounce('Game drawn: ' + reason);
      setTimeout(() => endGame('draw', reason), 400);
      return true;
    }
    return false;
  }

  function handleUndo() {
    if (!gameActive || isAnimating) return;
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
    for (const m of lastMoveHighlights) m.dispose();
    lastMoveHighlights = [];
    clearCheckHighlight();

    updateMoveHistory();
    updateCapturedPieces();
    updateTurnIndicator();
  }

  /* ================================================================
     9. GAME FLOW
     ================================================================ */

  function startNewGame() {
    chessEngine.reset();
    gameActive = true;
    gameStartTime = Date.now();
    moveCount = 0;
    selectedSquare = null;
    isAnimating = false;

    hideOverlay('mainMenuOverlay');
    hideOverlay('gameOverOverlay');

    // Setup pieces
    placePiecesFromBoard(chessEngine, scene, babylonSetup.shadowGen);
    clearHighlights();
    for (const m of lastMoveHighlights) m.dispose();
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

    showOverlay('gameOverOverlay');

    // Submit score
    submitScore(result, gameTimeMs, reason, eloResult.delta);
  }

  async function submitScore(result, gameTimeMs, terminationType, eloDelta) {
    if (!currentUser || !window.apiClient) return;

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
          terminationType: (terminationType || 'unknown').toLowerCase().replace(/\s/g, '_')
        }
      });

      // Save cloud state
      await window.apiClient.saveGameState(GAME_ID, {
        elo: elo.rating,
        gamesPlayed: elo.gamesPlayed,
        wins: elo.wins,
        losses: elo.losses,
        draws: elo.draws,
        streak: elo.streak,
        bestStreak: elo.bestStreak
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
  }

  function updateTurnIndicator() {
    const isMyTurn = chessEngine.getTurn() === playerColor;
    $('turnText').textContent = isMyTurn ? 'Your turn' : 'AI thinking...';
  }

  function updateMoveHistory() {
    const history = chessEngine.getHistory();
    let html = '';
    for (let i = 0; i < history.length; i += 2) {
      const moveNum = Math.floor(i / 2) + 1;
      html += '<div class="chess3d-move-row">';
      html += '<span class="chess3d-move-num">' + moveNum + '.</span>';
      html += '<span class="chess3d-move-white">' + history[i] + '</span>';
      if (history[i + 1]) {
        html += '<span class="chess3d-move-black">' + history[i + 1] + '</span>';
      }
      html += '</div>';
    }
    $('moveList').innerHTML = html;

    // Auto-scroll to bottom
    const list = $('moveList');
    list.scrollTop = list.scrollHeight;
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

  // --- Overlay helpers ---
  function showOverlay(id) {
    const el = $(id);
    if (el) el.classList.add('chess3d-visible');
  }

  function hideOverlay(id) {
    const el = $(id);
    if (el) el.classList.remove('chess3d-visible');
  }

  // --- SR announce ---
  function srAnnounce(text) {
    const el = $('srAnnounce');
    if (el) el.textContent = text;
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

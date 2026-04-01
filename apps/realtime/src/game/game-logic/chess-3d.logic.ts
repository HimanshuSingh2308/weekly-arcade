import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { MultiplayerGameLogic, GameResult, GameMove } from '@weekly-arcade/shared';
import { GameLogicRegistry } from '../game-logic.registry';

// ─── Constants ──────────────────────────────────────────────────────
const WHITE = 'w';
const BLACK = 'b';
const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILE_NAMES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANK_NAMES = ['1', '2', '3', '4', '5', '6', '7', '8'];

// ─── Types ──────────────────────────────────────────────────────────
interface Piece {
  type: string; // p, r, n, b, q, k
  color: string; // w, b
}

interface ChessMove {
  from: [number, number];
  to: [number, number];
  capture?: boolean;
  castle?: 'K' | 'Q';
  enPassant?: boolean;
  promotion?: string;
}

interface UndoData {
  from: [number, number];
  to: [number, number];
  piece: Piece;
  captured: Piece | null;
  castle?: 'K' | 'Q';
  enPassant: [number, number] | null;
  enPassantCapture?: Piece | null;
  enPassantCapturePos?: [number, number];
  castling: Record<string, boolean>;
  halfMoveClock: number;
  fullMoveNumber: number;
  turn: string;
  promotion?: string;
}

interface ChessState {
  fen: string;
  players: string[];       // [whiteUid, blackUid]
  colorMap: Record<string, string>; // uid -> 'w' | 'b'
  moveHistory: string[];   // SAN notation
  result?: string;
  drawOffer?: string;      // UID of player who offered draw (null if none)
  drawAgreed?: boolean;    // true when both players agreed to draw
}

// ─── Chess Engine (Server-side) ─────────────────────────────────────
class ChessEngine {
  board: (Piece | null)[][];
  turn: string;
  castling: Record<string, boolean>;
  enPassant: [number, number] | null;
  halfMoveClock: number;
  fullMoveNumber: number;
  positionHistory: string[];

  constructor(fen?: string) {
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    this.turn = WHITE;
    this.castling = { K: true, Q: true, k: true, q: true };
    this.enPassant = null;
    this.halfMoveClock = 0;
    this.fullMoveNumber = 1;
    this.positionHistory = [];
    this.loadFEN(fen || STARTING_FEN);
  }

  loadFEN(fen: string): void {
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
    this.positionHistory = [this.positionKey()];
  }

  getFEN(): string {
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

  positionKey(): string {
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

  private inBounds(r: number, c: number): boolean {
    return r >= 0 && r < 8 && c >= 0 && c < 8;
  }

  private findKing(color: string): [number, number] | null {
    for (let r = 0; r < 8; r++)
      for (let c = 0; c < 8; c++)
        if (this.board[r][c]?.type === 'k' && this.board[r][c]?.color === color)
          return [r, c];
    return null;
  }

  private isSquareAttackedBy(row: number, col: number, byColor: string): boolean {
    const d = byColor === WHITE ? 1 : -1;

    // Pawn attacks
    if (this.inBounds(row - d, col - 1)) {
      const p = this.board[row - d][col - 1];
      if (p?.type === 'p' && p.color === byColor) return true;
    }
    if (this.inBounds(row - d, col + 1)) {
      const p = this.board[row - d][col + 1];
      if (p?.type === 'p' && p.color === byColor) return true;
    }

    // Knight
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = row + dr, nc = col + dc;
      if (this.inBounds(nr, nc) && this.board[nr][nc]?.type === 'n' && this.board[nr][nc]?.color === byColor)
        return true;
    }

    // King
    for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
      const nr = row + dr, nc = col + dc;
      if (this.inBounds(nr, nc) && this.board[nr][nc]?.type === 'k' && this.board[nr][nc]?.color === byColor)
        return true;
    }

    // Rook/Queen (straight)
    for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
      for (let i = 1; i < 8; i++) {
        const nr = row + dr * i, nc = col + dc * i;
        if (!this.inBounds(nr, nc)) break;
        const p = this.board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'r' || p.type === 'q')) return true;
          break;
        }
      }
    }

    // Bishop/Queen (diagonal)
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      for (let i = 1; i < 8; i++) {
        const nr = row + dr * i, nc = col + dc * i;
        if (!this.inBounds(nr, nc)) break;
        const p = this.board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'b' || p.type === 'q')) return true;
          break;
        }
      }
    }

    return false;
  }

  isCheck(color?: string): boolean {
    color = color || this.turn;
    const king = this.findKing(color);
    if (!king) return false;
    const opp = color === WHITE ? BLACK : WHITE;
    return this.isSquareAttackedBy(king[0], king[1], opp);
  }

  private generatePseudoMoves(color: string): ChessMove[] {
    const moves: ChessMove[] = [];
    const dir = color === WHITE ? 1 : -1;
    const startRank = color === WHITE ? 1 : 6;
    const promoRank = color === WHITE ? 7 : 0;

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = this.board[r][c];
        if (!piece || piece.color !== color) continue;

        switch (piece.type) {
          case 'p': {
            const nr = r + dir;
            if (this.inBounds(nr, c) && !this.board[nr][c]) {
              if (nr === promoRank) {
                for (const promo of ['q', 'r', 'b', 'n'])
                  moves.push({ from: [r, c], to: [nr, c], promotion: promo });
              } else {
                moves.push({ from: [r, c], to: [nr, c] });
              }
              if (r === startRank) {
                const nr2 = r + dir * 2;
                if (!this.board[nr2][c])
                  moves.push({ from: [r, c], to: [nr2, c] });
              }
            }
            for (const dc of [-1, 1]) {
              const nc = c + dc;
              if (!this.inBounds(nr, nc)) continue;
              const target = this.board[nr][nc];
              if (target && target.color !== color) {
                if (nr === promoRank) {
                  for (const promo of ['q', 'r', 'b', 'n'])
                    moves.push({ from: [r, c], to: [nr, nc], promotion: promo, capture: true });
                } else {
                  moves.push({ from: [r, c], to: [nr, nc], capture: true });
                }
              }
              if (this.enPassant && this.enPassant[0] === nr && this.enPassant[1] === nc) {
                moves.push({ from: [r, c], to: [nr, nc], enPassant: true, capture: true });
              }
            }
            break;
          }
          case 'n': {
            for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
              const nr = r + dr, nc = c + dc;
              if (!this.inBounds(nr, nc)) continue;
              const target = this.board[nr][nc];
              if (!target || target.color !== color)
                moves.push({ from: [r, c], to: [nr, nc], capture: !!target });
            }
            break;
          }
          case 'b':
            for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]])
              this.addSlidingMoves(r, c, dr, dc, color, moves);
            break;
          case 'r':
            for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]])
              this.addSlidingMoves(r, c, dr, dc, color, moves);
            break;
          case 'q':
            for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1],[0,1],[0,-1],[1,0],[-1,0]])
              this.addSlidingMoves(r, c, dr, dc, color, moves);
            break;
          case 'k': {
            for (const [dr, dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]) {
              const nr = r + dr, nc = c + dc;
              if (!this.inBounds(nr, nc)) continue;
              const target = this.board[nr][nc];
              if (!target || target.color !== color)
                moves.push({ from: [r, c], to: [nr, nc], capture: !!target });
            }
            const opp = color === WHITE ? BLACK : WHITE;
            const rank = color === WHITE ? 0 : 7;
            if (r === rank && c === 4) {
              const castleK = color === WHITE ? 'K' : 'k';
              if (this.castling[castleK] &&
                  this.board[rank][7]?.type === 'r' && this.board[rank][7]?.color === color &&
                  !this.board[rank][5] && !this.board[rank][6] &&
                  !this.isSquareAttackedBy(rank, 4, opp) &&
                  !this.isSquareAttackedBy(rank, 5, opp) &&
                  !this.isSquareAttackedBy(rank, 6, opp)) {
                moves.push({ from: [r, c], to: [rank, 6], castle: 'K' });
              }
              const castleQ = color === WHITE ? 'Q' : 'q';
              if (this.castling[castleQ] &&
                  this.board[rank][0]?.type === 'r' && this.board[rank][0]?.color === color &&
                  !this.board[rank][3] && !this.board[rank][2] && !this.board[rank][1] &&
                  !this.isSquareAttackedBy(rank, 4, opp) &&
                  !this.isSquareAttackedBy(rank, 3, opp) &&
                  !this.isSquareAttackedBy(rank, 2, opp)) {
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

  private addSlidingMoves(r: number, c: number, dr: number, dc: number, color: string, moves: ChessMove[]): void {
    for (let i = 1; i < 8; i++) {
      const nr = r + dr * i, nc = c + dc * i;
      if (!this.inBounds(nr, nc)) break;
      const target = this.board[nr][nc];
      if (target) {
        if (target.color !== color) moves.push({ from: [r, c], to: [nr, nc], capture: true });
        break;
      }
      moves.push({ from: [r, c], to: [nr, nc] });
    }
  }

  getLegalMoves(): ChessMove[] {
    const pseudo = this.generatePseudoMoves(this.turn);
    return pseudo.filter(move => {
      const undoData = this.applyMoveRaw(move);
      const movedColor = undoData.turn;
      const kPos = this.findKing(movedColor);
      const opp = movedColor === WHITE ? BLACK : WHITE;
      const inCheck = kPos ? this.isSquareAttackedBy(kPos[0], kPos[1], opp) : true;
      this.undoMoveRaw(undoData);
      return !inCheck;
    });
  }

  isLegalMove(fromRow: number, fromCol: number, toRow: number, toCol: number, promotion?: string): ChessMove | null {
    const legal = this.getLegalMoves().filter(m =>
      m.from[0] === fromRow && m.from[1] === fromCol
    );
    return legal.find(m =>
      m.to[0] === toRow && m.to[1] === toCol &&
      (!m.promotion || m.promotion === (promotion || 'q'))
    ) || null;
  }

  applyMoveRaw(move: ChessMove): UndoData {
    const undo: UndoData = {
      from: move.from,
      to: move.to,
      piece: this.board[move.from[0]][move.from[1]]!,
      captured: this.board[move.to[0]][move.to[1]],
      castle: move.castle,
      enPassant: this.enPassant,
      castling: { ...this.castling },
      halfMoveClock: this.halfMoveClock,
      fullMoveNumber: this.fullMoveNumber,
      turn: this.turn,
      promotion: move.promotion,
    };

    const piece = this.board[move.from[0]][move.from[1]]!;

    if (move.enPassant) {
      const capturedRow = move.from[0];
      undo.enPassantCapture = this.board[capturedRow][move.to[1]];
      undo.enPassantCapturePos = [capturedRow, move.to[1]];
      this.board[capturedRow][move.to[1]] = null;
    }

    this.board[move.to[0]][move.to[1]] = piece;
    this.board[move.from[0]][move.from[1]] = null;

    if (move.promotion) {
      this.board[move.to[0]][move.to[1]] = { type: move.promotion, color: piece.color };
    }

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
    if (move.to[0] === 0 && move.to[1] === 0) this.castling.Q = false;
    if (move.to[0] === 0 && move.to[1] === 7) this.castling.K = false;
    if (move.to[0] === 7 && move.to[1] === 0) this.castling.q = false;
    if (move.to[0] === 7 && move.to[1] === 7) this.castling.k = false;

    if (piece.type === 'p' && Math.abs(move.to[0] - move.from[0]) === 2) {
      this.enPassant = [(move.from[0] + move.to[0]) / 2, move.from[1]];
    } else {
      this.enPassant = null;
    }

    if (piece.type === 'p' || move.capture) {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    if (this.turn === BLACK) this.fullMoveNumber++;
    this.turn = this.turn === WHITE ? BLACK : WHITE;

    return undo;
  }

  undoMoveRaw(undo: UndoData): void {
    this.board[undo.from[0]][undo.from[1]] = undo.piece;
    this.board[undo.to[0]][undo.to[1]] = undo.captured;

    if (undo.enPassantCapturePos) {
      this.board[undo.enPassantCapturePos[0]][undo.enPassantCapturePos[1]] = undo.enPassantCapture!;
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

  makeMove(fromRow: number, fromCol: number, toRow: number, toCol: number, promotion?: string): ChessMove | null {
    const legalMove = this.isLegalMove(fromRow, fromCol, toRow, toCol, promotion);
    if (!legalMove) return null;

    this.applyMoveRaw(legalMove);
    this.positionHistory.push(this.positionKey());
    return legalMove;
  }

  generateSAN(move: ChessMove): string {
    if (move.castle === 'K') return 'O-O';
    if (move.castle === 'Q') return 'O-O-O';

    const piece = this.board[move.from[0]][move.from[1]];
    if (!piece) return '';
    let san = '';

    if (piece.type !== 'p') {
      san += piece.type.toUpperCase();
      const others = this.generatePseudoMoves(this.turn).filter(m =>
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

    san += FILE_NAMES[move.to[1]] + RANK_NAMES[move.to[0]];
    if (move.promotion) san += '=' + move.promotion.toUpperCase();

    return san;
  }

  isCheckmate(): boolean {
    return this.isCheck() && this.getLegalMoves().length === 0;
  }

  isStalemate(): boolean {
    return !this.isCheck() && this.getLegalMoves().length === 0;
  }

  isDraw(): boolean {
    return this.isStalemate() || this.isInsufficientMaterial() ||
           this.isThreefoldRepetition() || this.isFiftyMoveRule() ||
           this.isFivefoldRepetition() || this.is75MoveRule();
  }

  getDrawReason(): string | null {
    if (this.isStalemate()) return 'Stalemate';
    if (this.isInsufficientMaterial()) return 'Insufficient material';
    if (this.isFivefoldRepetition()) return 'Fivefold repetition';
    if (this.isThreefoldRepetition()) return 'Threefold repetition';
    if (this.is75MoveRule()) return '75-move rule';
    if (this.isFiftyMoveRule()) return '50-move rule';
    return null;
  }

  private isInsufficientMaterial(): boolean {
    const pieces: Record<string, { type: string; sq: [number, number] }[]> = { w: [], b: [] };
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type !== 'k') pieces[p.color].push({ type: p.type, sq: [r, c] });
      }
    }
    const wc = pieces.w.length, bc = pieces.b.length;
    if (wc === 0 && bc === 0) return true;
    if (wc === 0 && bc === 1 && (pieces.b[0].type === 'b' || pieces.b[0].type === 'n')) return true;
    if (bc === 0 && wc === 1 && (pieces.w[0].type === 'b' || pieces.w[0].type === 'n')) return true;
    if (wc === 1 && bc === 1 && pieces.w[0].type === 'b' && pieces.b[0].type === 'b') {
      const ws = pieces.w[0].sq, bs = pieces.b[0].sq;
      if ((ws[0] + ws[1]) % 2 === (bs[0] + bs[1]) % 2) return true;
    }
    return false;
  }

  private isThreefoldRepetition(): boolean {
    const current = this.positionKey();
    let count = 0;
    for (const pos of this.positionHistory) { if (pos === current) count++; }
    return count >= 3;
  }

  private isFivefoldRepetition(): boolean {
    const current = this.positionKey();
    let count = 0;
    for (const pos of this.positionHistory) { if (pos === current) count++; }
    return count >= 5;
  }

  private isFiftyMoveRule(): boolean { return this.halfMoveClock >= 100; }
  private is75MoveRule(): boolean { return this.halfMoveClock >= 150; }
}

// ─── Game Logic (MultiplayerGameLogic implementation) ────────────────

@Injectable()
export class Chess3dLogic implements MultiplayerGameLogic, OnModuleInit {
  readonly gameId = 'chess-3d';
  private readonly logger = new Logger(Chess3dLogic.name);

  constructor(private readonly registry: GameLogicRegistry) {}

  onModuleInit(): void {
    this.registry.register(this);
    this.logger.log('Chess 3D game logic registered');
  }

  createInitialState(
    players: string[],
    config: Record<string, unknown>,
  ): Record<string, unknown> {
    // Randomly assign colors or use config
    const colorPref = config.colorPreference as string | undefined;
    let whiteUid: string, blackUid: string;

    if (colorPref === 'white') {
      whiteUid = players[0]; // Host plays white
      blackUid = players[1];
    } else if (colorPref === 'black') {
      whiteUid = players[1];
      blackUid = players[0]; // Host plays black
    } else {
      // Random assignment
      if (Math.random() < 0.5) {
        whiteUid = players[0];
        blackUid = players[1];
      } else {
        whiteUid = players[1];
        blackUid = players[0];
      }
    }

    const state: ChessState = {
      fen: STARTING_FEN,
      players: [whiteUid, blackUid],
      colorMap: { [whiteUid]: WHITE, [blackUid]: BLACK },
      moveHistory: [],
    };

    return state as unknown as Record<string, unknown>;
  }

  applyMove(
    state: Record<string, unknown>,
    uid: string,
    moveType: string,
    moveData: Record<string, unknown>,
  ): Record<string, unknown> {
    const cs = state as unknown as ChessState;
    const engine = new ChessEngine(cs.fen);
    const playerColor = cs.colorMap[uid];

    if (!playerColor) {
      throw new Error('Player not in this game');
    }

    // Validate it's this player's turn
    if (engine.turn !== playerColor) {
      throw new Error('Not your turn');
    }

    if (moveType === 'chess-move') {
      const from = moveData.from as [number, number];
      const to = moveData.to as [number, number];
      const promotion = moveData.promotion as string | undefined;

      if (!from || !to || from.length !== 2 || to.length !== 2) {
        throw new Error('Invalid move format');
      }

      // Validate bounds
      for (const coord of [...from, ...to]) {
        if (typeof coord !== 'number' || coord < 0 || coord > 7) {
          throw new Error('Move coordinates out of bounds');
        }
      }

      // Generate SAN before applying (for move history)
      const legalMove = engine.isLegalMove(from[0], from[1], to[0], to[1], promotion);
      if (!legalMove) {
        throw new Error('Illegal move');
      }

      const san = engine.generateSAN(legalMove);
      const result = engine.makeMove(from[0], from[1], to[0], to[1], promotion);
      if (!result) {
        throw new Error('Move application failed');
      }

      // Add check/checkmate suffix
      let sanFinal = san;
      if (engine.isCheckmate()) sanFinal += '#';
      else if (engine.isCheck()) sanFinal += '+';

      const newState: ChessState = {
        ...cs,
        fen: engine.getFEN(),
        moveHistory: [...cs.moveHistory, sanFinal],
      };

      return newState as unknown as Record<string, unknown>;

    } else if (moveType === 'draw-offer') {
      // Player offers a draw — record the offer in state, don't change the board
      return {
        ...cs,
        drawOffer: uid,
      } as unknown as Record<string, unknown>;

    } else if (moveType === 'draw-accept') {
      // Accept a pending draw offer
      if (!cs.drawOffer || cs.drawOffer === uid) {
        throw new Error('No pending draw offer to accept');
      }
      // Mark game as drawn — checkGameOver will detect this
      return {
        ...cs,
        drawOffer: null,
        drawAgreed: true,
      } as unknown as Record<string, unknown>;

    } else if (moveType === 'draw-decline') {
      // Decline a pending draw offer
      return {
        ...cs,
        drawOffer: null,
      } as unknown as Record<string, unknown>;

    } else if (moveType === 'resign') {
      throw new Error('Use forfeit instead of resign move');

    } else {
      throw new Error(`Unknown move type: ${moveType}`);
    }
  }

  checkGameOver(state: Record<string, unknown>): GameResult | null {
    const cs = state as unknown as ChessState;
    const engine = new ChessEngine(cs.fen);
    const [whiteUid, blackUid] = cs.players;

    // Draw by mutual agreement
    if ((cs as any).drawAgreed) {
      return {
        players: {
          [whiteUid]: { score: 0.5, rank: 1, outcome: 'draw' },
          [blackUid]: { score: 0.5, rank: 1, outcome: 'draw' },
        },
        reason: 'completed',
      };
    }

    if (engine.isCheckmate()) {
      // The player whose turn it is has been checkmated (they lost)
      const loserColor = engine.turn;
      const winnerUid = loserColor === WHITE ? blackUid : whiteUid;
      const loserUid = loserColor === WHITE ? whiteUid : blackUid;

      return {
        players: {
          [winnerUid]: { score: 1, rank: 1, outcome: 'win' },
          [loserUid]: { score: 0, rank: 2, outcome: 'loss' },
        },
        reason: 'completed',
      };
    }

    if (engine.isDraw()) {
      return {
        players: {
          [whiteUid]: { score: 0.5, rank: 1, outcome: 'draw' },
          [blackUid]: { score: 0.5, rank: 1, outcome: 'draw' },
        },
        reason: 'completed',
      };
    }

    return null; // Game continues
  }

  getNextTurn(state: Record<string, unknown>): string | null {
    const cs = state as unknown as ChessState;
    const engine = new ChessEngine(cs.fen);
    // Return the UID of the player whose turn it is
    const currentColor = engine.turn;
    return cs.players[currentColor === WHITE ? 0 : 1];
  }

  suspicionScore(moves: GameMove[]): number {
    if (moves.length < 10) return 0;

    // Flag if average move time is suspiciously fast (< 1 second)
    let totalTime = 0;
    for (let i = 1; i < moves.length; i++) {
      const dt = new Date(moves[i].timestamp).getTime() - new Date(moves[i - 1].timestamp).getTime();
      totalTime += dt;
    }
    const avgMs = totalTime / (moves.length - 1);

    // Sub-500ms average = likely using an engine
    if (avgMs < 500) return 0.9;
    if (avgMs < 1000) return 0.5;
    if (avgMs < 2000) return 0.2;

    return 0;
  }
}

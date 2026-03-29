import { create } from 'zustand';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten';

export interface Position {
  x: number;
  y: number;
}

export interface Ghost {
  id: string;
  name: string;
  color: string;
  position: Position;
  direction: Direction;
  mode: GhostMode;
  scatterTarget: Position;
}

export interface GameState {
  // Player state
  playerPosition: Position;
  playerDirection: Direction;
  nextDirection: Direction | null;
  lives: number;
  score: number;
  highScore: number;
  
  // Game state
  level: number;
  pellets: boolean[][];
  powerPellets: Position[];
  powerPelletActive: boolean;
  powerPelletTimer: number;
  
  // Ghosts
  ghosts: Ghost[];
  
  // Game flow
  gameStatus: 'ready' | 'playing' | 'paused' | 'gameover' | 'levelcomplete' | 'dying';
  
  // Actions
  startGame: () => void;
  pauseGame: () => void;
  resumeGame: () => void;
  resetGame: () => void;
  setDirection: (direction: Direction) => void;
  movePlayer: () => void;
  moveGhosts: () => void;
  eatPellet: () => void;
  checkGhostCollision: () => void;
  activatePowerPellet: () => void;
  decrementPowerTimer: () => void;
  nextLevel: () => void;
  loseLife: () => void;
}

// Classic maze layout - 28x31 grid
// 0 = wall, 1 = empty path, 2 = pellet, 3 = power pellet, 4 = ghost house
export const MAZE_LAYOUT: number[][] = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,0,0,2,0,0,0,0,0,2,0,0,2,0,0,0,0,0,2,0,0,0,0,2,0],
  [0,3,0,0,0,0,2,0,0,0,0,0,2,0,0,2,0,0,0,0,0,2,0,0,0,0,3,0],
  [0,2,0,0,0,0,2,0,0,0,0,0,2,0,0,2,0,0,0,0,0,2,0,0,0,0,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,2,0],
  [0,2,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,2,0],
  [0,2,2,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,2,2,0],
  [0,0,0,0,0,0,2,0,0,0,0,0,1,0,0,1,0,0,0,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,0,0,0,1,0,0,1,0,0,0,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,1,1,1,1,1,1,1,1,1,1,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,1,0,0,0,4,4,0,0,0,1,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,1,0,4,4,4,4,4,4,0,1,0,0,2,0,0,0,0,0,0],
  [1,1,1,1,1,1,2,1,1,1,0,4,4,4,4,4,4,0,1,1,1,2,1,1,1,1,1,1],
  [0,0,0,0,0,0,2,0,0,1,0,4,4,4,4,4,4,0,1,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,1,1,1,1,1,1,1,1,1,1,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0],
  [0,0,0,0,0,0,2,0,0,1,0,0,0,0,0,0,0,0,1,0,0,2,0,0,0,0,0,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,0,0,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,2,0,0,0,0,2,0,0,0,0,0,2,0,0,2,0,0,0,0,0,2,0,0,0,0,2,0],
  [0,2,0,0,0,0,2,0,0,0,0,0,2,0,0,2,0,0,0,0,0,2,0,0,0,0,2,0],
  [0,3,2,2,0,0,2,2,2,2,2,2,2,1,1,2,2,2,2,2,2,2,0,0,2,2,3,0],
  [0,0,0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0,0,0],
  [0,0,0,2,0,0,2,0,0,2,0,0,0,0,0,0,0,0,2,0,0,2,0,0,2,0,0,0],
  [0,2,2,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,0,0,2,2,2,2,2,2,0],
  [0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0],
  [0,2,0,0,0,0,0,0,0,0,0,0,2,0,0,2,0,0,0,0,0,0,0,0,0,0,2,0],
  [0,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],
];

export const MAZE_WIDTH = 28;
export const MAZE_HEIGHT = 31;

// Ghost characters with pun names
const INITIAL_GHOSTS: Ghost[] = [
  {
    id: 'blinky',
    name: 'Blinky McBlinkface',
    color: '#FF0000',
    position: { x: 13, y: 11 },
    direction: 'left',
    mode: 'scatter',
    scatterTarget: { x: 25, y: 0 },
  },
  {
    id: 'pinky',
    name: 'Stinky Pinky',
    color: '#FFB8FF',
    position: { x: 13, y: 14 },
    direction: 'up',
    mode: 'scatter',
    scatterTarget: { x: 2, y: 0 },
  },
  {
    id: 'inky',
    name: 'Thinky Inky',
    color: '#00FFFF',
    position: { x: 11, y: 14 },
    direction: 'up',
    mode: 'scatter',
    scatterTarget: { x: 27, y: 30 },
  },
  {
    id: 'sue',
    name: 'Sue-shi Roll',
    color: '#FFB852',
    position: { x: 15, y: 14 },
    direction: 'up',
    mode: 'scatter',
    scatterTarget: { x: 0, y: 30 },
  },
];

const PLAYER_START: Position = { x: 13, y: 23 };

function initializePellets(): boolean[][] {
  const pellets: boolean[][] = [];
  for (let y = 0; y < MAZE_HEIGHT; y++) {
    pellets[y] = [];
    for (let x = 0; x < MAZE_WIDTH; x++) {
      pellets[y][x] = MAZE_LAYOUT[y][x] === 2;
    }
  }
  return pellets;
}

function initializePowerPellets(): Position[] {
  const powerPellets: Position[] = [];
  for (let y = 0; y < MAZE_HEIGHT; y++) {
    for (let x = 0; x < MAZE_WIDTH; x++) {
      if (MAZE_LAYOUT[y][x] === 3) {
        powerPellets.push({ x, y });
      }
    }
  }
  return powerPellets;
}

export const useGameStore = create<GameState>((set, get) => ({
  // Initial state
  playerPosition: { ...PLAYER_START },
  playerDirection: 'left',
  nextDirection: null,
  lives: 3,
  score: 0,
  highScore: 0,
  level: 1,
  pellets: initializePellets(),
  powerPellets: initializePowerPellets(),
  powerPelletActive: false,
  powerPelletTimer: 0,
  ghosts: INITIAL_GHOSTS.map(g => ({ ...g, position: { ...g.position } })),
  gameStatus: 'ready',

  startGame: () => {
    set({
      gameStatus: 'playing',
      playerPosition: { ...PLAYER_START },
      playerDirection: 'left',
      nextDirection: null,
    });
  },

  pauseGame: () => {
    set({ gameStatus: 'paused' });
  },

  resumeGame: () => {
    set({ gameStatus: 'playing' });
  },

  resetGame: () => {
    set({
      playerPosition: { ...PLAYER_START },
      playerDirection: 'left',
      nextDirection: null,
      lives: 3,
      score: 0,
      level: 1,
      pellets: initializePellets(),
      powerPellets: initializePowerPellets(),
      powerPelletActive: false,
      powerPelletTimer: 0,
      ghosts: INITIAL_GHOSTS.map(g => ({ ...g, position: { ...g.position }, mode: 'scatter' })),
      gameStatus: 'ready',
    });
  },

  setDirection: (direction: Direction) => {
    const { playerPosition, gameStatus } = get();
    if (gameStatus !== 'playing') return;
    
    const nextPos = getNextPosition(playerPosition, direction);
    if (canMoveTo(nextPos)) {
      set({ playerDirection: direction, nextDirection: null });
    } else {
      set({ nextDirection: direction });
    }
  },

  movePlayer: () => {
    const { playerPosition, playerDirection, nextDirection, gameStatus } = get();
    if (gameStatus !== 'playing') return;

    // Try next direction first if set
    if (nextDirection) {
      const nextPos = getNextPosition(playerPosition, nextDirection);
      if (canMoveTo(nextPos)) {
        set({ 
          playerDirection: nextDirection, 
          nextDirection: null,
          playerPosition: wrapPosition(nextPos),
        });
        return;
      }
    }

    // Otherwise continue in current direction
    const nextPos = getNextPosition(playerPosition, playerDirection);
    if (canMoveTo(nextPos)) {
      set({ playerPosition: wrapPosition(nextPos) });
    }
  },

  eatPellet: () => {
    const { playerPosition, pellets, powerPellets, score } = get();
    const { x, y } = playerPosition;
    
    // Check regular pellet
    if (pellets[y] && pellets[y][x]) {
      const newPellets = [...pellets];
      newPellets[y] = [...newPellets[y]];
      newPellets[y][x] = false;
      set({ pellets: newPellets, score: score + 10 });
      
      // Check if level complete
      const remainingPellets = newPellets.flat().filter(p => p).length;
      const remainingPower = get().powerPellets.length;
      if (remainingPellets === 0 && remainingPower === 0) {
        set({ gameStatus: 'levelcomplete' });
      }
    }
    
    // Check power pellet
    const powerIndex = powerPellets.findIndex(p => p.x === x && p.y === y);
    if (powerIndex !== -1) {
      const newPowerPellets = powerPellets.filter((_, i) => i !== powerIndex);
      set({ powerPellets: newPowerPellets, score: score + 50 });
      get().activatePowerPellet();
      
      // Check if level complete
      const remainingPellets = get().pellets.flat().filter(p => p).length;
      if (remainingPellets === 0 && newPowerPellets.length === 0) {
        set({ gameStatus: 'levelcomplete' });
      }
    }
  },

  activatePowerPellet: () => {
    const { ghosts } = get();
    const frightenedGhosts = ghosts.map(g => ({
      ...g,
      mode: g.mode !== 'eaten' ? 'frightened' as GhostMode : g.mode,
    }));
    set({ 
      powerPelletActive: true, 
      powerPelletTimer: 80, // ~8 seconds at 10fps
      ghosts: frightenedGhosts,
    });
  },

  decrementPowerTimer: () => {
    const { powerPelletTimer, ghosts } = get();
    if (powerPelletTimer > 0) {
      const newTimer = powerPelletTimer - 1;
      if (newTimer === 0) {
        const normalGhosts = ghosts.map(g => ({
          ...g,
          mode: g.mode === 'frightened' ? 'chase' as GhostMode : g.mode,
        }));
        set({ powerPelletActive: false, powerPelletTimer: 0, ghosts: normalGhosts });
      } else {
        set({ powerPelletTimer: newTimer });
      }
    }
  },

  moveGhosts: () => {
    const { ghosts, playerPosition, gameStatus } = get();
    if (gameStatus !== 'playing') return;

    const newGhosts = ghosts.map(ghost => {
      const directions: Direction[] = ['up', 'down', 'left', 'right'];
      const opposite: Record<Direction, Direction> = {
        up: 'down',
        down: 'up',
        left: 'right',
        right: 'left',
      };

      // Get valid directions (not walls, not opposite unless necessary)
      let validDirections = directions.filter(dir => {
        if (dir === opposite[ghost.direction]) return false;
        const nextPos = getNextPosition(ghost.position, dir);
        return canGhostMoveTo(nextPos);
      });

      if (validDirections.length === 0) {
        validDirections = directions.filter(dir => {
          const nextPos = getNextPosition(ghost.position, dir);
          return canGhostMoveTo(nextPos);
        });
      }

      if (validDirections.length === 0) return ghost;

      let targetDir: Direction;
      
      if (ghost.mode === 'frightened') {
        // Random movement when frightened
        targetDir = validDirections[Math.floor(Math.random() * validDirections.length)];
      } else if (ghost.mode === 'eaten') {
        // Return to ghost house
        const target = { x: 13, y: 14 };
        targetDir = getBestDirection(ghost.position, target, validDirections);
        
        // Check if reached ghost house
        if (ghost.position.x === target.x && ghost.position.y === target.y) {
          return { ...ghost, mode: 'scatter' as GhostMode };
        }
      } else {
        // Chase or scatter mode
        let target: Position;
        if (ghost.mode === 'chase') {
          target = playerPosition;
          // Different targeting for each ghost
          if (ghost.id === 'pinky') {
            // Target 4 tiles ahead of player
            target = { x: playerPosition.x + 4, y: playerPosition.y };
          } else if (ghost.id === 'inky') {
            // More complex targeting
            target = { x: playerPosition.x * 2 - 2, y: playerPosition.y };
          } else if (ghost.id === 'sue') {
            // Random scatter when close
            const dist = Math.abs(ghost.position.x - playerPosition.x) + Math.abs(ghost.position.y - playerPosition.y);
            if (dist < 8) {
              target = ghost.scatterTarget;
            }
          }
        } else {
          target = ghost.scatterTarget;
        }
        targetDir = getBestDirection(ghost.position, target, validDirections);
      }

      const newPos = wrapPosition(getNextPosition(ghost.position, targetDir));
      return { ...ghost, position: newPos, direction: targetDir };
    });

    set({ ghosts: newGhosts });
  },

  checkGhostCollision: () => {
    const { playerPosition, ghosts, score, powerPelletActive } = get();
    
    for (const ghost of ghosts) {
      const dx = Math.abs(playerPosition.x - ghost.position.x);
      const dy = Math.abs(playerPosition.y - ghost.position.y);
      
      if (dx < 1 && dy < 1) {
        if (ghost.mode === 'frightened') {
          // Eat ghost
          const newGhosts = ghosts.map(g => 
            g.id === ghost.id ? { ...g, mode: 'eaten' as GhostMode } : g
          );
          set({ ghosts: newGhosts, score: score + 200 });
        } else if (ghost.mode !== 'eaten') {
          // Player dies
          get().loseLife();
        }
        return;
      }
    }
  },

  loseLife: () => {
    const { lives, score, highScore } = get();
    const newHighScore = Math.max(score, highScore);
    
    if (lives <= 1) {
      set({ lives: 0, gameStatus: 'gameover', highScore: newHighScore });
    } else {
      set({ 
        lives: lives - 1, 
        gameStatus: 'dying',
        highScore: newHighScore,
      });
      // Reset positions after brief pause
      setTimeout(() => {
        const state = get();
        if (state.gameStatus === 'dying') {
          set({
            playerPosition: { ...PLAYER_START },
            playerDirection: 'left',
            ghosts: INITIAL_GHOSTS.map(g => ({ ...g, position: { ...g.position }, mode: 'scatter' })),
            powerPelletActive: false,
            powerPelletTimer: 0,
            gameStatus: 'playing',
          });
        }
      }, 1500);
    }
  },

  nextLevel: () => {
    const { level, score, highScore } = get();
    set({
      level: level + 1,
      pellets: initializePellets(),
      powerPellets: initializePowerPellets(),
      playerPosition: { ...PLAYER_START },
      playerDirection: 'left',
      ghosts: INITIAL_GHOSTS.map(g => ({ ...g, position: { ...g.position }, mode: 'scatter' })),
      powerPelletActive: false,
      powerPelletTimer: 0,
      gameStatus: 'playing',
      highScore: Math.max(score, highScore),
    });
  },
}));

// Helper functions
function getNextPosition(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'up': return { x: pos.x, y: pos.y - 1 };
    case 'down': return { x: pos.x, y: pos.y + 1 };
    case 'left': return { x: pos.x - 1, y: pos.y };
    case 'right': return { x: pos.x + 1, y: pos.y };
  }
}

function wrapPosition(pos: Position): Position {
  let { x, y } = pos;
  // Tunnel wrapping
  if (x < 0) x = MAZE_WIDTH - 1;
  if (x >= MAZE_WIDTH) x = 0;
  return { x, y };
}

function canMoveTo(pos: Position): boolean {
  const { x, y } = pos;
  // Allow tunnel
  if (y === 14 && (x < 0 || x >= MAZE_WIDTH)) return true;
  if (x < 0 || x >= MAZE_WIDTH || y < 0 || y >= MAZE_HEIGHT) return false;
  const cell = MAZE_LAYOUT[y][x];
  return cell !== 0 && cell !== 4;
}

function canGhostMoveTo(pos: Position): boolean {
  const { x, y } = pos;
  // Allow tunnel
  if (y === 14 && (x < 0 || x >= MAZE_WIDTH)) return true;
  if (x < 0 || x >= MAZE_WIDTH || y < 0 || y >= MAZE_HEIGHT) return false;
  const cell = MAZE_LAYOUT[y][x];
  return cell !== 0; // Ghosts can enter ghost house
}

function getBestDirection(from: Position, to: Position, validDirections: Direction[]): Direction {
  let bestDir = validDirections[0];
  let bestDist = Infinity;
  
  for (const dir of validDirections) {
    const nextPos = getNextPosition(from, dir);
    const dist = Math.pow(nextPos.x - to.x, 2) + Math.pow(nextPos.y - to.y, 2);
    if (dist < bestDist) {
      bestDist = dist;
      bestDir = dir;
    }
  }
  
  return bestDir;
}

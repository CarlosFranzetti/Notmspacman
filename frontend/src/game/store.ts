import { create } from 'zustand';

export type Direction = 'up' | 'down' | 'left' | 'right';
export type GhostMode = 'scatter' | 'chase' | 'frightened' | 'eaten';
export type FruitType = 'cherry' | 'strawberry' | 'orange' | 'pretzel' | 'apple' | 'pear' | 'banana';

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
  releaseTime: number; // When ghost leaves the house
}

export interface Fruit {
  type: FruitType;
  position: Position;
  points: number;
  active: boolean;
  expiresAt: number;
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
  pelletsEaten: number;
  
  // Fruit bonus
  fruit: Fruit | null;
  
  // Ghosts
  ghosts: Ghost[];
  ghostsEatenCombo: number; // For combo scoring
  
  // Game flow
  gameStatus: 'ready' | 'playing' | 'paused' | 'gameover' | 'levelcomplete' | 'dying';
  gameTime: number; // Time in current level
  
  // Sound enabled
  soundEnabled: boolean;
  
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
  spawnFruit: () => void;
  eatFruit: () => void;
  incrementGameTime: () => void;
  toggleSound: () => void;
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

// Fruit configuration by level
const FRUIT_CONFIG: Record<number, { type: FruitType; points: number }> = {
  1: { type: 'cherry', points: 100 },
  2: { type: 'strawberry', points: 300 },
  3: { type: 'orange', points: 500 },
  4: { type: 'orange', points: 500 },
  5: { type: 'pretzel', points: 700 },
  6: { type: 'pretzel', points: 700 },
  7: { type: 'apple', points: 1000 },
  8: { type: 'apple', points: 1000 },
  9: { type: 'pear', points: 2000 },
  10: { type: 'pear', points: 2000 },
  11: { type: 'banana', points: 5000 },
  12: { type: 'banana', points: 5000 },
};

// Ghost characters with pun names
const createInitialGhosts = (): Ghost[] => [
  {
    id: 'blinky',
    name: 'Blinky McBlinkface',
    color: '#FF0000',
    position: { x: 13, y: 11 },
    direction: 'left',
    mode: 'scatter',
    scatterTarget: { x: 25, y: 0 },
    releaseTime: 0, // Immediately active
  },
  {
    id: 'pinky',
    name: 'Stinky Pinky',
    color: '#FFB8FF',
    position: { x: 13, y: 14 },
    direction: 'up',
    mode: 'scatter',
    scatterTarget: { x: 2, y: 0 },
    releaseTime: 30, // Release after 3 seconds
  },
  {
    id: 'inky',
    name: 'Thinky Inky',
    color: '#00FFFF',
    position: { x: 11, y: 14 },
    direction: 'up',
    mode: 'scatter',
    scatterTarget: { x: 27, y: 30 },
    releaseTime: 60, // Release after 6 seconds
  },
  {
    id: 'sue',
    name: 'Sue-shi Roll',
    color: '#FFB852',
    position: { x: 15, y: 14 },
    direction: 'up',
    mode: 'scatter',
    scatterTarget: { x: 0, y: 30 },
    releaseTime: 90, // Release after 9 seconds
  },
];

const PLAYER_START: Position = { x: 13, y: 23 };
const FRUIT_POSITION: Position = { x: 13, y: 17 }; // Below ghost house

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

function countTotalPellets(): number {
  let count = 0;
  for (let y = 0; y < MAZE_HEIGHT; y++) {
    for (let x = 0; x < MAZE_WIDTH; x++) {
      if (MAZE_LAYOUT[y][x] === 2 || MAZE_LAYOUT[y][x] === 3) {
        count++;
      }
    }
  }
  return count;
}

const TOTAL_PELLETS = countTotalPellets();

export const useGameStore = create<GameState>(
  (set, get) => ({
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
      pelletsEaten: 0,
      fruit: null,
      ghosts: createInitialGhosts(),
      ghostsEatenCombo: 0,
      gameStatus: 'ready',
      gameTime: 0,
      soundEnabled: true,

      startGame: () => {
        set({
          gameStatus: 'playing',
          playerPosition: { ...PLAYER_START },
          playerDirection: 'left',
          nextDirection: null,
          gameTime: 0,
          ghostsEatenCombo: 0,
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
          pelletsEaten: 0,
          fruit: null,
          ghosts: createInitialGhosts(),
          ghostsEatenCombo: 0,
          gameStatus: 'ready',
          gameTime: 0,
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
        const { playerPosition, pellets, powerPellets, score, pelletsEaten } = get();
        const { x, y } = playerPosition;
        
        // Check regular pellet
        if (pellets[y] && pellets[y][x]) {
          const newPellets = [...pellets];
          newPellets[y] = [...newPellets[y]];
          newPellets[y][x] = false;
          const newPelletsEaten = pelletsEaten + 1;
          set({ pellets: newPellets, score: score + 10, pelletsEaten: newPelletsEaten });
          
          // Spawn fruit at certain pellet counts
          if (newPelletsEaten === 70 || newPelletsEaten === 170) {
            get().spawnFruit();
          }
          
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
          const newPelletsEaten = pelletsEaten + 1;
          set({ powerPellets: newPowerPellets, score: score + 50, pelletsEaten: newPelletsEaten });
          get().activatePowerPellet();
          
          // Check if level complete
          const remainingPellets = get().pellets.flat().filter(p => p).length;
          if (remainingPellets === 0 && newPowerPellets.length === 0) {
            set({ gameStatus: 'levelcomplete' });
          }
        }
        
        // Check fruit
        get().eatFruit();
      },

      spawnFruit: () => {
        const { level, fruit } = get();
        if (fruit && fruit.active) return; // Already has active fruit
        
        const config = FRUIT_CONFIG[Math.min(level, 12)] || FRUIT_CONFIG[12];
        set({
          fruit: {
            type: config.type,
            position: { ...FRUIT_POSITION },
            points: config.points,
            active: true,
            expiresAt: get().gameTime + 100, // Active for ~10 seconds
          }
        });
      },

      eatFruit: () => {
        const { playerPosition, fruit, score } = get();
        if (!fruit || !fruit.active) return;
        
        const dx = Math.abs(playerPosition.x - fruit.position.x);
        const dy = Math.abs(playerPosition.y - fruit.position.y);
        
        if (dx < 1 && dy < 1) {
          set({ 
            score: score + fruit.points,
            fruit: { ...fruit, active: false },
          });
        }
      },

      activatePowerPellet: () => {
        const { ghosts, level } = get();
        // Frightened time decreases with level
        const frightenedTime = Math.max(20, 80 - (level - 1) * 10);
        
        const frightenedGhosts = ghosts.map(g => ({
          ...g,
          mode: g.mode !== 'eaten' ? 'frightened' as GhostMode : g.mode,
          // Reverse direction when frightened
          direction: getOppositeDirection(g.direction),
        }));
        set({ 
          powerPelletActive: true, 
          powerPelletTimer: frightenedTime,
          ghosts: frightenedGhosts,
          ghostsEatenCombo: 0,
        });
      },

      decrementPowerTimer: () => {
        const { powerPelletTimer, ghosts, fruit, gameTime } = get();
        
        // Check fruit expiration
        if (fruit && fruit.active && gameTime >= fruit.expiresAt) {
          set({ fruit: { ...fruit, active: false } });
        }
        
        if (powerPelletTimer > 0) {
          const newTimer = powerPelletTimer - 1;
          if (newTimer === 0) {
            const normalGhosts = ghosts.map(g => ({
              ...g,
              mode: g.mode === 'frightened' ? 'chase' as GhostMode : g.mode,
            }));
            set({ powerPelletActive: false, powerPelletTimer: 0, ghosts: normalGhosts, ghostsEatenCombo: 0 });
          } else {
            set({ powerPelletTimer: newTimer });
          }
        }
      },

      moveGhosts: () => {
        const { ghosts, playerPosition, playerDirection, gameStatus, gameTime, level } = get();
        if (gameStatus !== 'playing') return;

        const newGhosts = ghosts.map(ghost => {
          // Check if ghost should be released
          if (ghost.mode === 'scatter' && gameTime < ghost.releaseTime) {
            // Ghost still in house, just wiggle
            return ghost;
          }
          
          const directions: Direction[] = ['up', 'down', 'left', 'right'];
          const opposite = getOppositeDirection(ghost.direction);

          // Get valid directions (not walls, not opposite unless necessary)
          let validDirections = directions.filter(dir => {
            if (dir === opposite) return false;
            const nextPos = getNextPosition(ghost.position, dir);
            return canGhostMoveTo(nextPos, ghost.mode === 'eaten');
          });

          if (validDirections.length === 0) {
            validDirections = directions.filter(dir => {
              const nextPos = getNextPosition(ghost.position, dir);
              return canGhostMoveTo(nextPos, ghost.mode === 'eaten');
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
            if (ghost.position.x === target.x && Math.abs(ghost.position.y - target.y) < 1) {
              return { ...ghost, mode: 'scatter' as GhostMode, position: { x: 13, y: 14 } };
            }
          } else {
            // Chase or scatter mode with improved AI
            let target: Position;
            if (ghost.mode === 'chase') {
              target = getGhostTarget(ghost, playerPosition, playerDirection, ghosts, level);
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
        const { playerPosition, ghosts, score, powerPelletActive, ghostsEatenCombo } = get();
        
        for (const ghost of ghosts) {
          const dx = Math.abs(playerPosition.x - ghost.position.x);
          const dy = Math.abs(playerPosition.y - ghost.position.y);
          
          if (dx < 0.8 && dy < 0.8) {
            if (ghost.mode === 'frightened') {
              // Eat ghost - combo scoring (200, 400, 800, 1600)
              const comboPoints = 200 * Math.pow(2, ghostsEatenCombo);
              const newGhosts = ghosts.map(g => 
                g.id === ghost.id ? { ...g, mode: 'eaten' as GhostMode } : g
              );
              set({ 
                ghosts: newGhosts, 
                score: score + comboPoints,
                ghostsEatenCombo: ghostsEatenCombo + 1,
              });
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
                ghosts: createInitialGhosts(),
                powerPelletActive: false,
                powerPelletTimer: 0,
                ghostsEatenCombo: 0,
                gameStatus: 'playing',
                gameTime: 0,
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
          pelletsEaten: 0,
          playerPosition: { ...PLAYER_START },
          playerDirection: 'left',
          ghosts: createInitialGhosts(),
          powerPelletActive: false,
          powerPelletTimer: 0,
          ghostsEatenCombo: 0,
          fruit: null,
          gameStatus: 'playing',
          highScore: Math.max(score, highScore),
          gameTime: 0,
        });
      },

      incrementGameTime: () => {
        set(state => ({ gameTime: state.gameTime + 1 }));
      },

      toggleSound: () => {
        set(state => ({ soundEnabled: !state.soundEnabled }));
      },
    })
);

// Helper functions
function getNextPosition(pos: Position, dir: Direction): Position {
  switch (dir) {
    case 'up': return { x: pos.x, y: pos.y - 1 };
    case 'down': return { x: pos.x, y: pos.y + 1 };
    case 'left': return { x: pos.x - 1, y: pos.y };
    case 'right': return { x: pos.x + 1, y: pos.y };
  }
}

function getOppositeDirection(dir: Direction): Direction {
  const opposite: Record<Direction, Direction> = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  };
  return opposite[dir];
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

function canGhostMoveTo(pos: Position, isEaten: boolean = false): boolean {
  const { x, y } = pos;
  // Allow tunnel
  if (y === 14 && (x < 0 || x >= MAZE_WIDTH)) return true;
  if (x < 0 || x >= MAZE_WIDTH || y < 0 || y >= MAZE_HEIGHT) return false;
  const cell = MAZE_LAYOUT[y][x];
  if (isEaten) return cell !== 0; // Eaten ghosts can enter ghost house
  return cell !== 0 && cell !== 4; // Normal ghosts avoid ghost house
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

// Improved ghost targeting - each ghost has unique behavior
function getGhostTarget(
  ghost: Ghost, 
  playerPos: Position, 
  playerDir: Direction,
  allGhosts: Ghost[],
  level: number
): Position {
  switch (ghost.id) {
    case 'blinky':
      // Blinky (Shadow) - directly targets player
      // Gets more aggressive at higher levels
      return playerPos;
      
    case 'pinky':
      // Pinky (Speedy) - targets 4 tiles ahead of player
      const offset = 4;
      let targetX = playerPos.x;
      let targetY = playerPos.y;
      switch (playerDir) {
        case 'up': 
          targetY -= offset; 
          targetX -= offset; // Original bug from arcade!
          break;
        case 'down': targetY += offset; break;
        case 'left': targetX -= offset; break;
        case 'right': targetX += offset; break;
      }
      return { x: targetX, y: targetY };
      
    case 'inky':
      // Inky (Bashful) - complex targeting using Blinky's position
      const blinky = allGhosts.find(g => g.id === 'blinky');
      if (!blinky) return playerPos;
      
      // Get position 2 tiles ahead of player
      let pivotX = playerPos.x;
      let pivotY = playerPos.y;
      switch (playerDir) {
        case 'up': pivotY -= 2; break;
        case 'down': pivotY += 2; break;
        case 'left': pivotX -= 2; break;
        case 'right': pivotX += 2; break;
      }
      
      // Double the vector from Blinky to pivot
      return {
        x: pivotX + (pivotX - blinky.position.x),
        y: pivotY + (pivotY - blinky.position.y),
      };
      
    case 'sue':
      // Sue/Clyde (Pokey) - targets player when far, scatters when close
      const distance = Math.sqrt(
        Math.pow(ghost.position.x - playerPos.x, 2) + 
        Math.pow(ghost.position.y - playerPos.y, 2)
      );
      // Threshold decreases with level (more aggressive)
      const threshold = Math.max(4, 8 - level);
      if (distance > threshold) {
        return playerPos;
      }
      return ghost.scatterTarget;
      
    default:
      return playerPos;
  }
}

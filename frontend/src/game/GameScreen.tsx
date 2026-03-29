import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useGameStore, MAZE_LAYOUT, MAZE_WIDTH, MAZE_HEIGHT, Direction, FruitType } from './store';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// COMPACT PLAYFIELD - larger cells for bigger characters
const CELL_SIZE = 16;
const GAME_WIDTH = CELL_SIZE * MAZE_WIDTH;
const GAME_HEIGHT = CELL_SIZE * MAZE_HEIGHT;

// Scale factor for characters (larger than cell)
const CHARACTER_SCALE = 1.3;
const CHARACTER_SIZE = CELL_SIZE * CHARACTER_SCALE;

// Colors - classic arcade palette
const COLORS = {
  background: '#000000',
  wall: '#2121DE',
  pellet: '#FFB897',
  powerPellet: '#FFB8FF',
  player: '#FFFF00',
  text: '#FFFFFF',
  frightened: '#2121DE',
  eaten: '#FFFFFF',
};

// Fruit colors
const FRUIT_COLORS: Record<FruitType, string> = {
  cherry: '#FF0000',
  strawberry: '#FF3366',
  orange: '#FFA500',
  pretzel: '#8B4513',
  apple: '#FF0000',
  pear: '#90EE90',
  banana: '#FFFF00',
};

// Frame rate and speed settings
const BASE_MOVE_INTERVAL = 180;
const GHOST_MOVE_DELAY = 40;

// Sound manager
class SoundManager {
  private static instance: SoundManager;
  private enabled: boolean = true;
  private chompToggle: boolean = false;

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public async playChomp() {
    if (!this.enabled) return;
    this.chompToggle = !this.chompToggle;
    // Visual feedback instead of actual sound for web compatibility
  }

  public async playPowerPellet() {
    if (!this.enabled) return;
  }

  public async playGhostEaten() {
    if (!this.enabled) return;
  }

  public async playDeath() {
    if (!this.enabled) return;
  }

  public async playLevelComplete() {
    if (!this.enabled) return;
  }

  public async playFruitEaten() {
    if (!this.enabled) return;
  }
}

const soundManager = SoundManager.getInstance();

export default function GameScreen() {
  const animationFrame = useRef<number | null>(null);
  const lastMoveTime = useRef<number>(0);
  const lastGhostMoveTime = useRef<number>(0);
  const lastAnimTime = useRef<number>(0);
  const modeTimer = useRef<NodeJS.Timeout | null>(null);
  
  const [mouthOpen, setMouthOpen] = useState(true);
  const [powerFlash, setPowerFlash] = useState(false);
  const [showPoints, setShowPoints] = useState<{x: number, y: number, points: number} | null>(null);

  const {
    playerPosition,
    playerDirection,
    lives,
    score,
    highScore,
    level,
    pellets,
    powerPellets,
    powerPelletActive,
    powerPelletTimer,
    fruit,
    ghosts,
    ghostsEatenCombo,
    gameStatus,
    gameTime,
    soundEnabled,
    startGame,
    pauseGame,
    resumeGame,
    resetGame,
    setDirection,
    movePlayer,
    moveGhosts,
    eatPellet,
    checkGhostCollision,
    decrementPowerTimer,
    nextLevel,
    incrementGameTime,
    toggleSound,
  } = useGameStore();

  // Calculate speed based on level
  const getMoveInterval = useCallback(() => {
    const speedMultiplier = Math.max(0.5, 1 - (level - 1) * 0.06);
    return BASE_MOVE_INTERVAL * speedMultiplier;
  }, [level]);

  // High frame rate game loop
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    let running = true;
    const moveInterval = getMoveInterval();
    const ghostMoveInterval = moveInterval + GHOST_MOVE_DELAY;

    const gameLoop = () => {
      if (!running) return;

      const now = Date.now();

      // Player movement
      if (now - lastMoveTime.current >= moveInterval) {
        movePlayer();
        eatPellet();
        checkGhostCollision();
        lastMoveTime.current = now;
      }

      // Ghost movement
      if (now - lastGhostMoveTime.current >= ghostMoveInterval) {
        moveGhosts();
        checkGhostCollision();
        decrementPowerTimer();
        incrementGameTime();
        lastGhostMoveTime.current = now;
      }

      // Animation updates
      if (now - lastAnimTime.current >= 80) {
        setMouthOpen(m => !m);
        if (powerPelletActive) {
          setPowerFlash(f => !f);
        }
        lastAnimTime.current = now;
      }

      animationFrame.current = requestAnimationFrame(gameLoop);
    };

    animationFrame.current = requestAnimationFrame(gameLoop);

    // Mode switching timer
    modeTimer.current = setInterval(() => {
      const { ghosts } = useGameStore.getState();
      const newGhosts = ghosts.map(g => ({
        ...g,
        mode: g.mode === 'scatter' ? 'chase' : 
              g.mode === 'chase' ? 'scatter' : 
              g.mode,
      }));
      useGameStore.setState({ ghosts: newGhosts });
    }, 7000);

    return () => {
      running = false;
      if (animationFrame.current) {
        cancelAnimationFrame(animationFrame.current);
      }
      if (modeTimer.current) {
        clearInterval(modeTimer.current);
      }
    };
  }, [gameStatus, level, powerPelletActive]);

  // Reset timers when game starts
  useEffect(() => {
    if (gameStatus === 'playing') {
      lastMoveTime.current = Date.now();
      lastGhostMoveTime.current = Date.now();
      lastAnimTime.current = Date.now();
    }
  }, [gameStatus]);

  // Update sound manager
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Handle swipe gestures
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, translationY } = event;
      
      if (Math.abs(translationX) > Math.abs(translationY)) {
        if (translationX > 15) {
          setDirection('right');
        } else if (translationX < -15) {
          setDirection('left');
        }
      } else {
        if (translationY > 15) {
          setDirection('down');
        } else if (translationY < -15) {
          setDirection('up');
        }
      }
    });

  const renderMaze = () => {
    const cells = [];
    
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        const cell = MAZE_LAYOUT[y][x];
        const hasPellet = pellets[y] && pellets[y][x];
        const hasPowerPellet = powerPellets.some(p => p.x === x && p.y === y);
        
        cells.push(
          <View
            key={`${x}-${y}`}
            style={[
              styles.cell,
              {
                left: x * CELL_SIZE,
                top: y * CELL_SIZE,
                width: CELL_SIZE,
                height: CELL_SIZE,
                backgroundColor: cell === 0 ? COLORS.wall : COLORS.background,
                borderRadius: cell === 0 ? 3 : 0,
              },
            ]}
          >
            {hasPellet && (
              <View style={styles.pellet} />
            )}
            {hasPowerPellet && (
              <View style={[
                styles.powerPellet, 
                powerFlash && styles.powerPelletFlash,
                { transform: [{ scale: powerFlash ? 0.7 : 1 }] }
              ]} />
            )}
          </View>
        );
      }
    }
    
    return cells;
  };

  const renderFruit = () => {
    if (!fruit || !fruit.active) return null;
    
    const offset = (CHARACTER_SIZE - CELL_SIZE) / 2;
    const fruitColor = FRUIT_COLORS[fruit.type];
    
    return (
      <View
        style={[
          styles.fruit,
          {
            left: fruit.position.x * CELL_SIZE - offset,
            top: fruit.position.y * CELL_SIZE - offset,
            width: CHARACTER_SIZE,
            height: CHARACTER_SIZE,
          },
        ]}
      >
        {fruit.type === 'cherry' && (
          <View style={styles.cherryContainer}>
            <View style={[styles.cherry, { backgroundColor: fruitColor }]} />
            <View style={[styles.cherry, { backgroundColor: fruitColor, marginLeft: -4 }]} />
            <View style={styles.cherryStem} />
          </View>
        )}
        {fruit.type === 'strawberry' && (
          <View style={[styles.strawberry, { backgroundColor: fruitColor }]}>
            <View style={styles.strawberryLeaf} />
            <View style={styles.strawberrySeed} />
            <View style={[styles.strawberrySeed, { left: '60%' }]} />
          </View>
        )}
        {fruit.type === 'orange' && (
          <View style={[styles.orange, { backgroundColor: fruitColor }]}>
            <View style={styles.orangeLeaf} />
          </View>
        )}
        {fruit.type === 'pretzel' && (
          <View style={[styles.pretzel, { borderColor: fruitColor }]} />
        )}
        {fruit.type === 'apple' && (
          <View style={[styles.apple, { backgroundColor: fruitColor }]}>
            <View style={styles.appleStem} />
            <View style={styles.appleLeaf} />
          </View>
        )}
        {fruit.type === 'pear' && (
          <View style={[styles.pear, { backgroundColor: fruitColor }]} />
        )}
        {fruit.type === 'banana' && (
          <View style={[styles.banana, { backgroundColor: fruitColor }]} />
        )}
      </View>
    );
  };

  const renderPlayer = () => {
    const rotation = {
      right: '0deg',
      left: '180deg',
      up: '-90deg',
      down: '90deg',
    }[playerDirection];

    const offset = (CHARACTER_SIZE - CELL_SIZE) / 2;

    return (
      <View
        style={[
          styles.player,
          {
            left: playerPosition.x * CELL_SIZE - offset,
            top: playerPosition.y * CELL_SIZE - offset,
            width: CHARACTER_SIZE,
            height: CHARACTER_SIZE,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        <View style={styles.pacmanBody}>
          {mouthOpen && <View style={styles.pacmanMouth} />}
          <View style={styles.pacmanBow} />
          <View style={styles.pacmanBeautyMark} />
        </View>
      </View>
    );
  };

  const renderGhosts = () => {
    const offset = (CHARACTER_SIZE - CELL_SIZE) / 2;
    
    return ghosts.map(ghost => {
      const isFrightened = ghost.mode === 'frightened';
      const isEaten = ghost.mode === 'eaten';
      const flashWhite = isFrightened && powerPelletTimer < 20 && powerFlash;
      
      return (
        <View
          key={ghost.id}
          style={[
            styles.ghost,
            {
              left: ghost.position.x * CELL_SIZE - offset,
              top: ghost.position.y * CELL_SIZE - offset,
              width: CHARACTER_SIZE,
              height: CHARACTER_SIZE,
            },
          ]}
        >
          {isEaten ? (
            <View style={styles.ghostEyesOnly}>
              <View style={styles.ghostEyeWhiteLarge}>
                <View style={styles.ghostEyePupilLarge} />
              </View>
              <View style={styles.ghostEyeWhiteLarge}>
                <View style={styles.ghostEyePupilLarge} />
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.ghostBody,
                { 
                  backgroundColor: isFrightened 
                    ? (flashWhite ? '#FFFFFF' : COLORS.frightened) 
                    : ghost.color 
                },
              ]}
            >
              <View style={styles.ghostEyes}>
                <View style={[styles.ghostEyeWhite, isFrightened && styles.frightenedEye]}>
                  {!isFrightened && <View style={styles.ghostEyePupil} />}
                </View>
                <View style={[styles.ghostEyeWhite, isFrightened && styles.frightenedEye]}>
                  {!isFrightened && <View style={styles.ghostEyePupil} />}
                </View>
              </View>
              {isFrightened && (
                <View style={styles.frightenedMouth}>
                  <View style={styles.frightenedTooth} />
                  <View style={styles.frightenedTooth} />
                  <View style={styles.frightenedTooth} />
                </View>
              )}
              <View style={styles.ghostSkirt}>
                <View style={[styles.ghostLeg, { backgroundColor: isFrightened ? (flashWhite ? '#FFFFFF' : COLORS.frightened) : ghost.color }]} />
                <View style={styles.ghostLegGap} />
                <View style={[styles.ghostLeg, { backgroundColor: isFrightened ? (flashWhite ? '#FFFFFF' : COLORS.frightened) : ghost.color }]} />
                <View style={styles.ghostLegGap} />
                <View style={[styles.ghostLeg, { backgroundColor: isFrightened ? (flashWhite ? '#FFFFFF' : COLORS.frightened) : ghost.color }]} />
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  const renderControls = () => (
    <View style={styles.controls}>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('up')}
          activeOpacity={0.7}
        >
          <Ionicons name="caret-up" size={36} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('left')}
          activeOpacity={0.7}
        >
          <Ionicons name="caret-back" size={36} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.controlSpacer} />
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('right')}
          activeOpacity={0.7}
        >
          <Ionicons name="caret-forward" size={36} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('down')}
          activeOpacity={0.7}
        >
          <Ionicons name="caret-down" size={36} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLives = () => {
    const lifeIcons = [];
    for (let i = 0; i < lives; i++) {
      lifeIcons.push(
        <View key={i} style={styles.lifeIcon}>
          <View style={styles.lifeIconBody}>
            <View style={styles.lifeIconMouth} />
            <View style={styles.lifeIconBow} />
          </View>
        </View>
      );
    }
    return <View style={styles.livesContainer}>{lifeIcons}</View>;
  };

  const renderOverlay = () => {
    if (gameStatus === 'ready') {
      return (
        <View style={styles.overlay}>
          <Text style={styles.titleText}>MS. NOT MR.</Text>
          <Text style={styles.titleTextBig}>PAC-MAN</Text>
          <Text style={styles.subtitleText}>The Arcade Classic with Pun-derful Names!</Text>
          <View style={styles.ghostIntro}>
            {ghosts.map(ghost => (
              <View key={ghost.id} style={styles.ghostIntroItem}>
                <View style={[styles.miniGhost, { backgroundColor: ghost.color }]}>
                  <View style={styles.miniGhostEyes}>
                    <View style={styles.miniGhostEye} />
                    <View style={styles.miniGhostEye} />
                  </View>
                </View>
                <Text style={styles.ghostName}>{ghost.name}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>START GAME</Text>
          </TouchableOpacity>
          <Text style={styles.instructionText}>Swipe or use arrows to move</Text>
          {highScore > 0 && (
            <Text style={styles.highScoreReadyText}>High Score: {highScore}</Text>
          )}
        </View>
      );
    }

    if (gameStatus === 'paused') {
      return (
        <View style={styles.overlay}>
          <Text style={styles.pausedText}>PAUSED</Text>
          <TouchableOpacity style={styles.startButton} onPress={resumeGame}>
            <Text style={styles.startButtonText}>RESUME</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButton} onPress={resetGame}>
            <Text style={styles.secondaryButtonText}>QUIT</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (gameStatus === 'gameover') {
      return (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>GAME OVER</Text>
          <Text style={styles.finalScoreText}>Score: {score}</Text>
          {score >= highScore && score > 0 && (
            <Text style={styles.newHighScoreText}>NEW HIGH SCORE!</Text>
          )}
          <Text style={styles.highScoreOverlayText}>High Score: {Math.max(score, highScore)}</Text>
          <TouchableOpacity style={styles.startButton} onPress={resetGame}>
            <Text style={styles.startButtonText}>PLAY AGAIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (gameStatus === 'levelcomplete') {
      return (
        <View style={styles.overlay}>
          <Text style={styles.levelCompleteText}>LEVEL {level}</Text>
          <Text style={styles.levelCompleteSubtext}>COMPLETE!</Text>
          <Text style={styles.finalScoreText}>Score: {score}</Text>
          <Text style={styles.bonusText}>Speed Up!</Text>
          <TouchableOpacity style={styles.startButton} onPress={nextLevel}>
            <Text style={styles.startButtonText}>NEXT LEVEL</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (gameStatus === 'dying') {
      return (
        <View style={styles.dyingOverlay}>
          <Text style={styles.dyingText}>OUCH!</Text>
        </View>
      );
    }

    return null;
  };

  // Combo points display
  const getComboPoints = () => {
    if (ghostsEatenCombo > 0 && powerPelletActive) {
      return 200 * Math.pow(2, ghostsEatenCombo - 1);
    }
    return null;
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score.toString().padStart(6, '0')}</Text>
        </View>
        <View style={styles.levelContainer}>
          <Text style={styles.levelLabel}>LEVEL</Text>
          <Text style={styles.levelValue}>{level}</Text>
        </View>
        <View style={styles.highScoreContainer}>
          <Text style={styles.scoreLabel}>HIGH</Text>
          <Text style={styles.highScoreValue}>{Math.max(score, highScore).toString().padStart(6, '0')}</Text>
        </View>
      </View>

      {/* Lives and Pause */}
      <View style={styles.infoBar}>
        {renderLives()}
        <View style={styles.infoBarRight}>
          {fruit && fruit.active && (
            <View style={[styles.fruitIndicator, { backgroundColor: FRUIT_COLORS[fruit.type] }]} />
          )}
          {gameStatus === 'playing' && (
            <TouchableOpacity onPress={pauseGame} style={styles.pauseButton}>
              <Ionicons name="pause-circle" size={32} color={COLORS.text} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Game Area */}
      <GestureDetector gesture={panGesture}>
        <View style={[styles.gameContainer, { width: GAME_WIDTH, height: GAME_HEIGHT }]}>
          {renderMaze()}
          {renderFruit()}
          {gameStatus !== 'ready' && gameStatus !== 'gameover' && renderPlayer()}
          {gameStatus !== 'ready' && gameStatus !== 'gameover' && renderGhosts()}
          {renderOverlay()}
        </View>
      </GestureDetector>

      {/* Controls */}
      {gameStatus === 'playing' && renderControls()}
      
      {/* Power pellet status */}
      {powerPelletActive && gameStatus === 'playing' && (
        <View style={styles.powerStatus}>
          <Text style={[styles.powerStatusText, powerFlash && { opacity: 0.5 }]}>
            POWER MODE {Math.ceil(powerPelletTimer / 10)}s
          </Text>
          {getComboPoints() && (
            <Text style={styles.comboText}>x{ghostsEatenCombo} = {getComboPoints()}</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: GAME_WIDTH,
    marginBottom: 8,
    paddingHorizontal: 5,
  },
  scoreContainer: {
    alignItems: 'flex-start',
  },
  levelContainer: {
    alignItems: 'center',
  },
  highScoreContainer: {
    alignItems: 'flex-end',
  },
  scoreLabel: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  scoreValue: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  highScoreValue: {
    color: '#FFB8FF',
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  levelLabel: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  levelValue: {
    color: '#00FFFF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: GAME_WIDTH,
    marginBottom: 8,
    paddingHorizontal: 5,
  },
  infoBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livesContainer: {
    flexDirection: 'row',
  },
  lifeIcon: {
    width: 22,
    height: 22,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lifeIconBody: {
    width: 18,
    height: 18,
    backgroundColor: COLORS.player,
    borderRadius: 9,
    position: 'relative',
    overflow: 'hidden',
  },
  lifeIconMouth: {
    position: 'absolute',
    right: -2,
    top: 4,
    width: 10,
    height: 10,
    backgroundColor: COLORS.background,
    transform: [{ rotate: '45deg' }],
  },
  lifeIconBow: {
    position: 'absolute',
    top: -2,
    left: 5,
    width: 6,
    height: 4,
    backgroundColor: '#FF0000',
    borderRadius: 2,
  },
  fruitIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 10,
  },
  pauseButton: {
    padding: 2,
  },
  gameContainer: {
    position: 'relative',
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: COLORS.wall,
    borderRadius: 4,
  },
  cell: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pellet: {
    width: 4,
    height: 4,
    backgroundColor: COLORS.pellet,
    borderRadius: 2,
  },
  powerPellet: {
    width: 12,
    height: 12,
    backgroundColor: COLORS.powerPellet,
    borderRadius: 6,
  },
  powerPelletFlash: {
    opacity: 0.3,
  },
  fruit: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 8,
  },
  cherryContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  cherry: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cherryStem: {
    position: 'absolute',
    top: -4,
    left: 6,
    width: 2,
    height: 6,
    backgroundColor: '#00FF00',
  },
  strawberry: {
    width: 14,
    height: 16,
    borderRadius: 7,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  strawberryLeaf: {
    position: 'absolute',
    top: -3,
    left: 3,
    width: 8,
    height: 4,
    backgroundColor: '#00FF00',
    borderRadius: 2,
  },
  strawberrySeed: {
    position: 'absolute',
    top: 6,
    left: '30%',
    width: 2,
    height: 2,
    backgroundColor: '#FFFF00',
    borderRadius: 1,
  },
  orange: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  orangeLeaf: {
    position: 'absolute',
    top: -4,
    left: 5,
    width: 6,
    height: 4,
    backgroundColor: '#00FF00',
    borderRadius: 2,
  },
  pretzel: {
    width: 14,
    height: 14,
    borderWidth: 3,
    borderRadius: 7,
    backgroundColor: 'transparent',
  },
  apple: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  appleStem: {
    position: 'absolute',
    top: -4,
    left: 6,
    width: 2,
    height: 5,
    backgroundColor: '#8B4513',
  },
  appleLeaf: {
    position: 'absolute',
    top: -3,
    left: 8,
    width: 5,
    height: 3,
    backgroundColor: '#00FF00',
    borderRadius: 2,
  },
  pear: {
    width: 12,
    height: 16,
    borderRadius: 6,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  banana: {
    width: 16,
    height: 10,
    borderRadius: 8,
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
    transform: [{ rotate: '-20deg' }],
  },
  player: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  pacmanBody: {
    width: '100%',
    height: '100%',
    backgroundColor: COLORS.player,
    borderRadius: 100,
    overflow: 'hidden',
    position: 'relative',
  },
  pacmanMouth: {
    position: 'absolute',
    right: -2,
    top: '20%',
    width: '55%',
    height: '60%',
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 50,
    borderBottomLeftRadius: 50,
  },
  pacmanBow: {
    position: 'absolute',
    top: -4,
    left: '25%',
    width: 10,
    height: 8,
    backgroundColor: '#FF0000',
    borderRadius: 3,
    zIndex: 1,
  },
  pacmanBeautyMark: {
    position: 'absolute',
    top: '25%',
    right: '30%',
    width: 3,
    height: 3,
    backgroundColor: '#000000',
    borderRadius: 1.5,
  },
  ghost: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9,
  },
  ghostBody: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 4,
    overflow: 'visible',
  },
  ghostEyes: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostEyesOnly: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  ghostEyeWhite: {
    width: 7,
    height: 8,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    marginHorizontal: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 1,
  },
  ghostEyeWhiteLarge: {
    width: 9,
    height: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 5,
    marginHorizontal: 2,
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 2,
  },
  frightenedEye: {
    width: 5,
    height: 5,
    backgroundColor: '#FFB8FF',
    borderRadius: 2.5,
  },
  ghostEyePupil: {
    width: 4,
    height: 5,
    backgroundColor: '#2121DE',
    borderRadius: 2,
  },
  ghostEyePupilLarge: {
    width: 5,
    height: 6,
    backgroundColor: '#2121DE',
    borderRadius: 2.5,
  },
  frightenedMouth: {
    flexDirection: 'row',
    marginTop: 3,
    height: 4,
    alignItems: 'flex-end',
  },
  frightenedTooth: {
    width: 3,
    height: 3,
    backgroundColor: '#FFB8FF',
    marginHorizontal: 1,
  },
  ghostSkirt: {
    position: 'absolute',
    bottom: 0,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'center',
  },
  ghostLeg: {
    width: 5,
    height: 5,
    borderBottomLeftRadius: 5,
    borderBottomRightRadius: 5,
  },
  ghostLegGap: {
    width: 2,
    height: 5,
    backgroundColor: COLORS.background,
  },
  controls: {
    marginTop: 15,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    width: 65,
    height: 65,
    backgroundColor: 'rgba(33, 33, 222, 0.7)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 3,
    borderWidth: 2,
    borderColor: 'rgba(33, 33, 222, 1)',
  },
  controlSpacer: {
    width: 65,
    height: 65,
    margin: 3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  dyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    color: '#FFB8FF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
    letterSpacing: 2,
  },
  titleTextBig: {
    color: COLORS.player,
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
    letterSpacing: 3,
  },
  subtitleText: {
    color: COLORS.text,
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 15,
    textAlign: 'center',
  },
  ghostIntro: {
    marginBottom: 15,
  },
  ghostIntroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 3,
  },
  miniGhost: {
    width: 18,
    height: 18,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
    marginRight: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniGhostEyes: {
    flexDirection: 'row',
    marginTop: -2,
  },
  miniGhostEye: {
    width: 4,
    height: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    marginHorizontal: 1,
  },
  ghostName: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  startButton: {
    backgroundColor: COLORS.player,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  startButtonText: {
    color: COLORS.background,
    fontSize: 16,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.text,
    paddingHorizontal: 25,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  secondaryButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 1,
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 12,
  },
  highScoreReadyText: {
    color: '#FFB8FF',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 15,
  },
  pausedText: {
    color: COLORS.player,
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 15,
    letterSpacing: 3,
  },
  gameOverText: {
    color: '#FF0000',
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 15,
    letterSpacing: 2,
  },
  levelCompleteText: {
    color: '#00FF00',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
  },
  levelCompleteSubtext: {
    color: '#00FF00',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 15,
    letterSpacing: 2,
  },
  finalScoreText: {
    color: COLORS.text,
    fontSize: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
  },
  newHighScoreText: {
    color: '#FFD700',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 5,
  },
  bonusText: {
    color: '#00FFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 15,
  },
  highScoreOverlayText: {
    color: '#FFB8FF',
    fontSize: 16,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 15,
  },
  dyingText: {
    color: '#FF0000',
    fontSize: 40,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  powerStatus: {
    marginTop: 10,
    alignItems: 'center',
  },
  powerStatusText: {
    color: '#FFB8FF',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  comboText: {
    color: '#00FFFF',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
  },
});

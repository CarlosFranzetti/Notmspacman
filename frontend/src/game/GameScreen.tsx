import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing,
  interpolate,
  runOnJS,
} from 'react-native-reanimated';
import { useGameStore, MAZE_LAYOUT, MAZE_WIDTH, MAZE_HEIGHT, Direction, FruitType } from './store';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ARCADE-ACCURATE SIZING
const CELL_SIZE = 14; // Smaller cells for more arcade-like proportions
const GAME_WIDTH = CELL_SIZE * MAZE_WIDTH;
const GAME_HEIGHT = CELL_SIZE * MAZE_HEIGHT;

// Character sizing - slightly larger than cell for overlap effect
const CHARACTER_SIZE = CELL_SIZE * 1.4;
const GHOST_SIZE = CELL_SIZE * 1.35;

// Colors - authentic arcade palette
const COLORS = {
  background: '#000000',
  wall: '#2121DE',
  wallHighlight: '#5555FF',
  wallShadow: '#0000AA',
  pellet: '#FCB4AA',
  powerPellet: '#FCB4AA',
  player: '#FFFF00',
  playerHighlight: '#FFFFAA',
  playerShadow: '#CCAA00',
  text: '#FFFFFF',
  frightened: '#2121FF',
  frightenedFlash: '#FFFFFF',
  eaten: '#FFFFFF',
};

// Fruit colors with gradients
const FRUIT_COLORS: Record<FruitType, { main: string; highlight: string }> = {
  cherry: { main: '#FF0000', highlight: '#FF6666' },
  strawberry: { main: '#FF3366', highlight: '#FF99AA' },
  orange: { main: '#FFA500', highlight: '#FFCC66' },
  pretzel: { main: '#CD853F', highlight: '#DEB887' },
  apple: { main: '#FF0000', highlight: '#FF6666' },
  pear: { main: '#90EE90', highlight: '#CCFFCC' },
  banana: { main: '#FFE135', highlight: '#FFFF99' },
};

// Timing - 60fps arcade accurate with smoother movement
const FRAME_TIME = 1000 / 60; // ~16.67ms
const MOVE_FRAMES = 12; // More frames per tile for smoother movement
const GHOST_MOVE_FRAMES = 14; // Ghosts slightly slower
const ANIMATION_FRAMES = 16; // Frames for mouth animation cycle

// Sound Manager with synthesized arcade sounds
class ArcadeSoundManager {
  private static instance: ArcadeSoundManager;
  private enabled: boolean = true;
  private audioContext: AudioContext | null = null;
  private chompPhase: number = 0;
  private chompCounter: number = 0;
  private masterVolume: number = 0.03; // Lower overall volume
  
  private constructor() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.log('Web Audio not available');
      }
    }
  }

  public static getInstance(): ArcadeSoundManager {
    if (!ArcadeSoundManager.instance) {
      ArcadeSoundManager.instance = new ArcadeSoundManager();
    }
    return ArcadeSoundManager.instance;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'square', volume: number = 0.03) {
    if (!this.enabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);
      
      // Lower volume with smooth decay
      const actualVolume = volume * this.masterVolume * 10;
      gainNode.gain.setValueAtTime(actualVolume, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + duration);
    } catch (e) {
      // Silently fail
    }
  }

  // Waka-waka chomp sound - only plays every 3rd pellet for less noise
  public playChomp() {
    this.chompCounter++;
    if (this.chompCounter % 3 !== 0) return; // Only play every 3rd pellet
    
    this.chompPhase = 1 - this.chompPhase;
    const freq = this.chompPhase === 0 ? 220 : 260; // Lower frequencies
    this.playTone(freq, 0.04, 'sine', 0.025); // Softer sine wave
  }

  // Power pellet - gentle ascending tone
  public playPowerPellet() {
    const notes = [440, 550, 660, 880];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.08, 'sine', 0.04), i * 60);
    });
  }

  // Ghost eaten - soft rising sweep
  public playGhostEaten() {
    if (!this.enabled || !this.audioContext) return;
    
    try {
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(180, this.audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(600, this.audioContext.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.04, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + 0.2);
      
      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.2);
    } catch (e) {}
  }

  // Death sound - gentle descending tones
  public playDeath() {
    const notes = [400, 350, 300, 260, 220, 180];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.03), i * 100);
    });
  }

  // Level complete - soft victory melody
  public playLevelComplete() {
    const melody = [440, 550, 660, 880];
    melody.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.12, 'sine', 0.035), i * 120);
    });
  }

  // Fruit eaten - gentle blip
  public playFruitEaten() {
    this.playTone(660, 0.06, 'sine', 0.025);
    setTimeout(() => this.playTone(880, 0.06, 'sine', 0.025), 70);
  }

  // Start game jingle - quiet and pleasant
  public playStartGame() {
    const notes = [330, 392, 440, 523];
    notes.forEach((freq, i) => {
      setTimeout(() => this.playTone(freq, 0.1, 'sine', 0.03), i * 100);
    });
  }

  // Initialize audio context (must be called from user interaction)
  public async init() {
    if (Platform.OS === 'web' && this.audioContext?.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}

const soundManager = ArcadeSoundManager.getInstance();

export default function GameScreen() {
  const frameCount = useRef(0);
  const lastFrameTime = useRef(0);
  const animationFrame = useRef<number | null>(null);
  const moveCounter = useRef(0);
  const ghostMoveCounter = useRef(0);
  const modeTimer = useRef<NodeJS.Timeout | null>(null);
  
  // Animation states
  const [mouthAngle, setMouthAngle] = useState(0);
  const [powerFlash, setPowerFlash] = useState(false);
  const [ghostWiggle, setGhostWiggle] = useState(0);
  
  // Smooth position interpolation for player - initialize with default position
  const playerX = useSharedValue(13 * CELL_SIZE);
  const playerY = useSharedValue(23 * CELL_SIZE);

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
  } = useGameStore();

  // Initialize ghost position shared values - NOT using hooks in map
  // Ghost positions will be calculated directly without shared values for now

  // Sync player position with smooth animation - longer duration for smoother movement
  useEffect(() => {
    const targetX = playerPosition.x * CELL_SIZE;
    const targetY = playerPosition.y * CELL_SIZE;
    
    // Smoother easing with longer duration
    playerX.value = withTiming(targetX, {
      duration: FRAME_TIME * MOVE_FRAMES * 0.9, // Slightly faster than move rate for overlap
      easing: Easing.out(Easing.quad), // Smooth deceleration
    });
    playerY.value = withTiming(targetY, {
      duration: FRAME_TIME * MOVE_FRAMES * 0.9,
      easing: Easing.out(Easing.quad),
    });
  }, [playerPosition.x, playerPosition.y]);

  // Ghost positions will be animated via state changes

  // Calculate move speed based on level - smoother with more frames
  const getMoveFrames = useCallback(() => {
    // Speed up slightly each level but keep smooth
    return Math.max(8, MOVE_FRAMES - Math.floor((level - 1) * 0.4));
  }, [level]);

  // Main game loop - 60fps with smoother animations
  useEffect(() => {
    if (gameStatus !== 'playing') return;

    let running = true;
    const moveFrames = getMoveFrames();
    const ghostMoveFrames = moveFrames + 2; // Ghosts move slightly slower

    const gameLoop = (timestamp: number) => {
      if (!running) return;

      const deltaTime = timestamp - lastFrameTime.current;
      
      if (deltaTime >= FRAME_TIME) {
        frameCount.current++;
        lastFrameTime.current = timestamp;
        
        // Smoother mouth animation (16 frames per cycle for fluid movement)
        const mouthCycle = frameCount.current % ANIMATION_FRAMES;
        const mouthProgress = mouthCycle / ANIMATION_FRAMES;
        // Smooth sine wave for natural opening/closing
        setMouthAngle(Math.sin(mouthProgress * Math.PI * 2) * 40);
        
        // Smoother ghost wiggle animation (more gradual)
        const wiggleProgress = frameCount.current / 8;
        setGhostWiggle(Math.sin(wiggleProgress) * 1.5);
        
        // Power pellet flash (slower flash rate)
        if (powerPelletActive && frameCount.current % 12 === 0) {
          setPowerFlash(f => !f);
        }
        
        // Player movement
        moveCounter.current++;
        if (moveCounter.current >= moveFrames) {
          moveCounter.current = 0;
          movePlayer();
          eatPellet();
          checkGhostCollision();
          
          // Play chomp sound (less frequently)
          soundManager.playChomp();
        }
        
        // Ghost movement (smoother timing)
        ghostMoveCounter.current++;
        if (ghostMoveCounter.current >= ghostMoveFrames) {
          ghostMoveCounter.current = 0;
          moveGhosts();
          checkGhostCollision();
          decrementPowerTimer();
          incrementGameTime();
        }
      }

      animationFrame.current = requestAnimationFrame(gameLoop);
    };

    animationFrame.current = requestAnimationFrame(gameLoop);

    // Mode switching timer
    modeTimer.current = setInterval(() => {
      const state = useGameStore.getState();
      const newGhosts = state.ghosts.map(g => ({
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

  // Reset counters when game starts
  useEffect(() => {
    if (gameStatus === 'playing') {
      frameCount.current = 0;
      moveCounter.current = 0;
      ghostMoveCounter.current = 0;
      lastFrameTime.current = performance.now();
      soundManager.playStartGame();
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
        if (translationX > 10) setDirection('right');
        else if (translationX < -10) setDirection('left');
      } else {
        if (translationY > 10) setDirection('down');
        else if (translationY < -10) setDirection('up');
      }
    });

  // Render maze with pixel-art shading
  const renderMaze = useMemo(() => {
    const cells = [];
    
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        const cell = MAZE_LAYOUT[y][x];
        const hasPellet = pellets[y] && pellets[y][x];
        const hasPowerPellet = powerPellets.some(p => p.x === x && p.y === y);
        
        if (cell === 0) {
          // Wall with pixel shading
          cells.push(
            <View
              key={`wall-${x}-${y}`}
              style={[
                styles.cell,
                styles.wallCell,
                {
                  left: x * CELL_SIZE,
                  top: y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                },
              ]}
            >
              {/* Highlight edge */}
              <View style={styles.wallHighlight} />
              {/* Shadow edge */}
              <View style={styles.wallShadow} />
            </View>
          );
        } else {
          // Path cell
          cells.push(
            <View
              key={`path-${x}-${y}`}
              style={[
                styles.cell,
                {
                  left: x * CELL_SIZE,
                  top: y * CELL_SIZE,
                  width: CELL_SIZE,
                  height: CELL_SIZE,
                  backgroundColor: COLORS.background,
                },
              ]}
            >
              {hasPellet && (
                <View style={styles.pellet}>
                  <View style={styles.pelletHighlight} />
                </View>
              )}
              {hasPowerPellet && (
                <Animated.View 
                  style={[
                    styles.powerPellet,
                    { opacity: powerFlash ? 0.3 : 1 }
                  ]}
                >
                  <View style={styles.powerPelletHighlight} />
                </Animated.View>
              )}
            </View>
          );
        }
      }
    }
    
    return cells;
  }, [pellets, powerPellets, powerFlash]);

  // Animated player style
  const playerAnimatedStyle = useAnimatedStyle(() => {
    const offset = (CHARACTER_SIZE - CELL_SIZE) / 2;
    return {
      left: playerX.value - offset,
      top: playerY.value - offset,
    };
  });

  // Render Ms. Pac-Man with pixel-art details
  const renderPlayer = () => {
    const rotation = {
      right: 0,
      left: 180,
      up: -90,
      down: 90,
    }[playerDirection];

    return (
      <Animated.View
        style={[
          styles.player,
          playerAnimatedStyle,
          {
            width: CHARACTER_SIZE,
            height: CHARACTER_SIZE,
            transform: [{ rotate: `${rotation}deg` }],
          },
        ]}
      >
        {/* Main body */}
        <View style={styles.pacmanBody}>
          {/* Highlight */}
          <View style={styles.pacmanHighlight} />
          
          {/* Mouth */}
          <View 
            style={[
              styles.pacmanMouth,
              { 
                height: `${30 + Math.abs(mouthAngle)}%`,
                top: `${35 - Math.abs(mouthAngle) / 2}%`,
              }
            ]} 
          />
          
          {/* Eye */}
          <View style={styles.pacmanEye} />
          
          {/* Bow (Ms. feature) */}
          <View style={styles.pacmanBow}>
            <View style={styles.bowLeft} />
            <View style={styles.bowRight} />
            <View style={styles.bowCenter} />
          </View>
          
          {/* Beauty mark */}
          <View style={styles.pacmanBeautyMark} />
        </View>
      </Animated.View>
    );
  };

  // Render ghosts with pixel-art details
  const renderGhosts = () => {
    return ghosts.map((ghost, index) => {
      const isFrightened = ghost.mode === 'frightened';
      const isEaten = ghost.mode === 'eaten';
      const flashWhite = isFrightened && powerPelletTimer < 20 && powerFlash;
      
      const offset = (GHOST_SIZE - CELL_SIZE) / 2;
      
      // Get eye direction based on ghost movement
      const eyeOffsetX = ghost.direction === 'left' ? -2 : ghost.direction === 'right' ? 2 : 0;
      const eyeOffsetY = ghost.direction === 'up' ? -2 : ghost.direction === 'down' ? 2 : 0;
      
      const ghostStyle = {
        left: ghost.position.x * CELL_SIZE - offset,
        top: ghost.position.y * CELL_SIZE - offset + ghostWiggle,
        width: GHOST_SIZE,
        height: GHOST_SIZE,
      };
      
      return (
        <View key={ghost.id} style={[styles.ghost, ghostStyle]}>
          {isEaten ? (
            // Just eyes when eaten
            <View style={styles.ghostEyesOnly}>
              <View style={styles.eatenEye}>
                <View style={[styles.eatenPupil, { marginLeft: eyeOffsetX, marginTop: eyeOffsetY }]} />
              </View>
              <View style={styles.eatenEye}>
                <View style={[styles.eatenPupil, { marginLeft: eyeOffsetX, marginTop: eyeOffsetY }]} />
              </View>
            </View>
          ) : (
            <View
              style={[
                styles.ghostBody,
                { 
                  backgroundColor: isFrightened 
                    ? (flashWhite ? COLORS.frightenedFlash : COLORS.frightened) 
                    : ghost.color 
                },
              ]}
            >
              {/* Ghost highlight */}
              <View style={[styles.ghostHighlight, isFrightened && { backgroundColor: 'rgba(100, 100, 255, 0.5)' }]} />
              
              {/* Eyes */}
              <View style={styles.ghostEyes}>
                {isFrightened ? (
                  // Frightened eyes
                  <>
                    <View style={styles.frightenedEye} />
                    <View style={styles.frightenedEye} />
                  </>
                ) : (
                  // Normal eyes
                  <>
                    <View style={styles.ghostEyeWhite}>
                      <View style={[styles.ghostPupil, { marginLeft: eyeOffsetX, marginTop: eyeOffsetY }]} />
                    </View>
                    <View style={styles.ghostEyeWhite}>
                      <View style={[styles.ghostPupil, { marginLeft: eyeOffsetX, marginTop: eyeOffsetY }]} />
                    </View>
                  </>
                )}
              </View>
              
              {/* Frightened mouth */}
              {isFrightened && (
                <View style={styles.frightenedMouthContainer}>
                  {[0, 1, 2, 3, 4].map(i => (
                    <View 
                      key={i} 
                      style={[
                        styles.frightenedMouthSegment,
                        { backgroundColor: flashWhite ? COLORS.frightened : COLORS.frightenedFlash }
                      ]} 
                    />
                  ))}
                </View>
              )}
              
              {/* Wavy bottom */}
              <View style={styles.ghostSkirt}>
                {[0, 1, 2, 3].map(i => (
                  <View 
                    key={i}
                    style={[
                      styles.ghostWave,
                      { 
                        backgroundColor: isFrightened 
                          ? (flashWhite ? COLORS.frightenedFlash : COLORS.frightened)
                          : ghost.color,
                        marginTop: (i + frameCount.current / 4) % 2 === 0 ? 0 : -2,
                      }
                    ]} 
                  />
                ))}
              </View>
            </View>
          )}
        </View>
      );
    });
  };

  // Render fruit with pixel-art style
  const renderFruit = () => {
    if (!fruit || !fruit.active) return null;
    
    const offset = (CHARACTER_SIZE - CELL_SIZE) / 2;
    const colors = FRUIT_COLORS[fruit.type];
    
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
            <View style={[styles.cherry, { backgroundColor: colors.main }]}>
              <View style={[styles.cherryHighlight, { backgroundColor: colors.highlight }]} />
            </View>
            <View style={[styles.cherry, { backgroundColor: colors.main, marginLeft: -3 }]}>
              <View style={[styles.cherryHighlight, { backgroundColor: colors.highlight }]} />
            </View>
            <View style={styles.cherryStem} />
            <View style={styles.cherryLeaf} />
          </View>
        )}
        {fruit.type === 'strawberry' && (
          <View style={[styles.strawberry, { backgroundColor: colors.main }]}>
            <View style={[styles.strawberryHighlight, { backgroundColor: colors.highlight }]} />
            <View style={styles.strawberryLeaves} />
            <View style={styles.strawberrySeed} />
            <View style={[styles.strawberrySeed, { left: '55%', top: '50%' }]} />
            <View style={[styles.strawberrySeed, { left: '35%', top: '65%' }]} />
          </View>
        )}
        {fruit.type === 'orange' && (
          <View style={[styles.orange, { backgroundColor: colors.main }]}>
            <View style={[styles.orangeHighlight, { backgroundColor: colors.highlight }]} />
            <View style={styles.orangeStem} />
          </View>
        )}
      </View>
    );
  };

  const renderControls = () => (
    <View style={styles.controls}>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('up')}
          activeOpacity={0.7}
        >
          <View style={styles.dpadArrow}>
            <View style={[styles.dpadTriangle, { transform: [{ rotate: '0deg' }] }]} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('left')}
          activeOpacity={0.7}
        >
          <View style={styles.dpadArrow}>
            <View style={[styles.dpadTriangle, { transform: [{ rotate: '-90deg' }] }]} />
          </View>
        </TouchableOpacity>
        <View style={styles.controlCenter} />
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('right')}
          activeOpacity={0.7}
        >
          <View style={styles.dpadArrow}>
            <View style={[styles.dpadTriangle, { transform: [{ rotate: '90deg' }] }]} />
          </View>
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('down')}
          activeOpacity={0.7}
        >
          <View style={styles.dpadArrow}>
            <View style={[styles.dpadTriangle, { transform: [{ rotate: '180deg' }] }]} />
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLives = () => {
    const lifeIcons = [];
    for (let i = 0; i < lives; i++) {
      lifeIcons.push(
        <View key={i} style={styles.lifeIcon}>
          <View style={styles.lifePacman}>
            <View style={styles.lifeMouth} />
            <View style={styles.lifeBow} />
          </View>
        </View>
      );
    }
    return <View style={styles.livesContainer}>{lifeIcons}</View>;
  };

  const handleStartGame = async () => {
    await soundManager.init();
    startGame();
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
                  <View style={styles.miniGhostHighlight} />
                  <View style={styles.miniGhostEyes}>
                    <View style={styles.miniGhostEye}>
                      <View style={styles.miniGhostPupil} />
                    </View>
                    <View style={styles.miniGhostEye}>
                      <View style={styles.miniGhostPupil} />
                    </View>
                  </View>
                </View>
                <Text style={styles.ghostName}>{ghost.name}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.startButton} onPress={handleStartGame}>
            <Text style={styles.startButtonText}>START GAME</Text>
          </TouchableOpacity>
          <Text style={styles.instructionText}>Swipe or use D-pad to move</Text>
          {highScore > 0 && (
            <Text style={styles.highScoreReadyText}>HIGH SCORE: {highScore}</Text>
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
          <TouchableOpacity style={styles.quitButton} onPress={resetGame}>
            <Text style={styles.quitButtonText}>QUIT</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (gameStatus === 'gameover') {
      soundManager.playDeath();
      return (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>GAME OVER</Text>
          <Text style={styles.finalScoreText}>{score.toString().padStart(6, '0')}</Text>
          {score >= highScore && score > 0 && (
            <Text style={styles.newHighScoreText}>NEW HIGH SCORE!</Text>
          )}
          <TouchableOpacity style={styles.startButton} onPress={resetGame}>
            <Text style={styles.startButtonText}>PLAY AGAIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (gameStatus === 'levelcomplete') {
      soundManager.playLevelComplete();
      return (
        <View style={styles.overlay}>
          <Text style={styles.levelCompleteText}>LEVEL {level}</Text>
          <Text style={styles.levelCompleteSubtext}>COMPLETE!</Text>
          <Text style={styles.finalScoreText}>{score.toString().padStart(6, '0')}</Text>
          <TouchableOpacity style={styles.startButton} onPress={nextLevel}>
            <Text style={styles.startButtonText}>NEXT LEVEL</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (gameStatus === 'dying') {
      return (
        <View style={styles.dyingOverlay} />
      );
    }

    return null;
  };

  return (
    <View style={styles.container}>
      {/* Arcade cabinet top */}
      <View style={styles.cabinetTop}>
        <View style={styles.scorePanel}>
          <View style={styles.scoreSection}>
            <Text style={styles.scoreLabel}>1UP</Text>
            <Text style={styles.scoreValue}>{score.toString().padStart(6, '0')}</Text>
          </View>
          <View style={styles.scoreSection}>
            <Text style={styles.scoreLabel}>HIGH SCORE</Text>
            <Text style={styles.highScoreValue}>{Math.max(score, highScore).toString().padStart(6, '0')}</Text>
          </View>
          <View style={styles.scoreSection}>
            <Text style={styles.scoreLabel}>LEVEL</Text>
            <Text style={styles.levelValue}>{level}</Text>
          </View>
        </View>
      </View>

      {/* Lives and fruit display */}
      <View style={styles.infoBar}>
        {renderLives()}
        <View style={styles.infoRight}>
          {fruit && fruit.active && (
            <View style={[styles.fruitIndicator, { backgroundColor: FRUIT_COLORS[fruit.type].main }]} />
          )}
          {gameStatus === 'playing' && (
            <TouchableOpacity onPress={pauseGame} style={styles.pauseBtn}>
              <Text style={styles.pauseBtnText}>II</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Game Area with CRT effect border */}
      <GestureDetector gesture={panGesture}>
        <View style={styles.crtBorder}>
          <View style={[styles.gameContainer, { width: GAME_WIDTH, height: GAME_HEIGHT }]}>
            {renderMaze}
            {renderFruit()}
            {gameStatus !== 'ready' && gameStatus !== 'gameover' && renderPlayer()}
            {gameStatus !== 'ready' && gameStatus !== 'gameover' && renderGhosts()}
            {renderOverlay()}
          </View>
        </View>
      </GestureDetector>

      {/* D-Pad Controls */}
      {gameStatus === 'playing' && renderControls()}
      
      {/* Power mode indicator */}
      {powerPelletActive && gameStatus === 'playing' && (
        <View style={styles.powerIndicator}>
          <Text style={[styles.powerText, powerFlash && { opacity: 0.5 }]}>
            POWER! {Math.ceil(powerPelletTimer / 6)}
          </Text>
          {ghostsEatenCombo > 0 && (
            <Text style={styles.comboText}>{200 * Math.pow(2, ghostsEatenCombo - 1)} PTS</Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 45 : 25,
  },
  cabinetTop: {
    width: GAME_WIDTH + 20,
    paddingVertical: 8,
    paddingHorizontal: 10,
    backgroundColor: '#0f0f1a',
    borderRadius: 8,
    marginBottom: 5,
  },
  scorePanel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scoreSection: {
    alignItems: 'center',
  },
  scoreLabel: {
    color: '#FFFFFF',
    fontSize: 8,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  scoreValue: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  highScoreValue: {
    color: '#FF69B4',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  levelValue: {
    color: '#00FFFF',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontWeight: 'bold',
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: GAME_WIDTH + 20,
    paddingHorizontal: 10,
    marginBottom: 5,
  },
  infoRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  livesContainer: {
    flexDirection: 'row',
  },
  lifeIcon: {
    width: 18,
    height: 18,
    marginRight: 3,
  },
  lifePacman: {
    width: 16,
    height: 16,
    backgroundColor: COLORS.player,
    borderRadius: 8,
    overflow: 'hidden',
  },
  lifeMouth: {
    position: 'absolute',
    right: -2,
    top: 4,
    width: 8,
    height: 8,
    backgroundColor: '#1a1a2e',
    transform: [{ rotate: '45deg' }],
  },
  lifeBow: {
    position: 'absolute',
    top: -2,
    left: 4,
    width: 6,
    height: 4,
    backgroundColor: '#FF0000',
    borderRadius: 2,
  },
  fruitIndicator: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginRight: 8,
  },
  pauseBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#333',
    borderRadius: 4,
  },
  pauseBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  crtBorder: {
    padding: 4,
    backgroundColor: '#0a0a14',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#333',
  },
  gameContainer: {
    position: 'relative',
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    borderRadius: 2,
  },
  cell: {
    position: 'absolute',
  },
  wallCell: {
    backgroundColor: COLORS.wall,
    borderRadius: 2,
  },
  wallHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 2,
    height: 2,
    backgroundColor: COLORS.wallHighlight,
    borderTopLeftRadius: 2,
  },
  wallShadow: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    left: 2,
    height: 2,
    backgroundColor: COLORS.wallShadow,
    borderBottomRightRadius: 2,
  },
  pellet: {
    width: 3,
    height: 3,
    backgroundColor: COLORS.pellet,
    borderRadius: 1.5,
    alignSelf: 'center',
    marginTop: 5,
  },
  pelletHighlight: {
    width: 1,
    height: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 0.5,
    position: 'absolute',
    top: 0,
    left: 0,
  },
  powerPellet: {
    width: 10,
    height: 10,
    backgroundColor: COLORS.powerPellet,
    borderRadius: 5,
    alignSelf: 'center',
    marginTop: 2,
  },
  powerPelletHighlight: {
    width: 3,
    height: 3,
    backgroundColor: '#FFFFFF',
    borderRadius: 1.5,
    position: 'absolute',
    top: 1,
    left: 1,
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
  },
  pacmanHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: '40%',
    height: '40%',
    backgroundColor: COLORS.playerHighlight,
    borderRadius: 100,
    opacity: 0.6,
  },
  pacmanMouth: {
    position: 'absolute',
    right: -2,
    width: '50%',
    backgroundColor: COLORS.background,
  },
  pacmanEye: {
    position: 'absolute',
    top: '20%',
    right: '35%',
    width: 3,
    height: 3,
    backgroundColor: '#000',
    borderRadius: 1.5,
  },
  pacmanBow: {
    position: 'absolute',
    top: -3,
    left: '20%',
    width: 12,
    height: 8,
  },
  bowLeft: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 5,
    height: 6,
    backgroundColor: '#FF0000',
    borderRadius: 2,
    transform: [{ rotate: '-20deg' }],
  },
  bowRight: {
    position: 'absolute',
    right: 0,
    top: 0,
    width: 5,
    height: 6,
    backgroundColor: '#FF0000',
    borderRadius: 2,
    transform: [{ rotate: '20deg' }],
  },
  bowCenter: {
    position: 'absolute',
    left: 4,
    top: 2,
    width: 4,
    height: 4,
    backgroundColor: '#CC0000',
    borderRadius: 2,
  },
  pacmanBeautyMark: {
    position: 'absolute',
    top: '30%',
    right: '25%',
    width: 2,
    height: 2,
    backgroundColor: '#000',
    borderRadius: 1,
  },
  ghost: {
    position: 'absolute',
    zIndex: 9,
  },
  ghostBody: {
    width: '100%',
    height: '100%',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    overflow: 'visible',
  },
  ghostHighlight: {
    position: 'absolute',
    top: 2,
    left: 3,
    width: '35%',
    height: '35%',
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 100,
  },
  ghostEyes: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    top: '25%',
    left: 0,
    right: 0,
  },
  ghostEyeWhite: {
    width: 6,
    height: 7,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    marginHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  ghostPupil: {
    width: 3,
    height: 4,
    backgroundColor: '#2121DE',
    borderRadius: 1.5,
  },
  ghostEyesOnly: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  },
  eatenEye: {
    width: 8,
    height: 9,
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    marginHorizontal: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  eatenPupil: {
    width: 4,
    height: 5,
    backgroundColor: '#2121DE',
    borderRadius: 2,
  },
  frightenedEye: {
    width: 4,
    height: 4,
    backgroundColor: '#FFB8B8',
    borderRadius: 2,
    marginHorizontal: 3,
  },
  frightenedMouthContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    position: 'absolute',
    bottom: '30%',
    left: 0,
    right: 0,
  },
  frightenedMouthSegment: {
    width: 3,
    height: 2,
    marginHorizontal: 0.5,
    borderRadius: 1,
  },
  ghostSkirt: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  ghostWave: {
    width: 4,
    height: 5,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    marginHorizontal: 0.5,
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
    position: 'relative',
  },
  cherry: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cherryHighlight: {
    position: 'absolute',
    top: 1,
    left: 1,
    width: 2,
    height: 2,
    borderRadius: 1,
  },
  cherryStem: {
    position: 'absolute',
    top: -5,
    left: 5,
    width: 2,
    height: 6,
    backgroundColor: '#00AA00',
    borderRadius: 1,
    transform: [{ rotate: '15deg' }],
  },
  cherryLeaf: {
    position: 'absolute',
    top: -4,
    left: 6,
    width: 4,
    height: 3,
    backgroundColor: '#00DD00',
    borderRadius: 2,
  },
  strawberry: {
    width: 12,
    height: 14,
    borderRadius: 6,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
  strawberryHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  strawberryLeaves: {
    position: 'absolute',
    top: -3,
    left: 3,
    width: 6,
    height: 4,
    backgroundColor: '#00DD00',
    borderRadius: 2,
  },
  strawberrySeed: {
    position: 'absolute',
    top: '40%',
    left: '30%',
    width: 2,
    height: 2,
    backgroundColor: '#FFFF00',
    borderRadius: 1,
  },
  orange: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  orangeHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  orangeStem: {
    position: 'absolute',
    top: -3,
    left: 5,
    width: 4,
    height: 3,
    backgroundColor: '#00AA00',
    borderRadius: 2,
  },
  controls: {
    marginTop: 12,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    width: 55,
    height: 55,
    backgroundColor: '#2a2a4a',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
    borderWidth: 2,
    borderColor: '#4a4a6a',
    borderBottomColor: '#1a1a3a',
    borderRightColor: '#1a1a3a',
  },
  controlCenter: {
    width: 55,
    height: 55,
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    margin: 2,
  },
  dpadArrow: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dpadTriangle: {
    width: 0,
    height: 0,
    backgroundColor: 'transparent',
    borderStyle: 'solid',
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderBottomWidth: 16,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: '#FFFFFF',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 15,
  },
  dyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
  },
  titleText: {
    color: '#FFB8FF',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    letterSpacing: 2,
  },
  titleTextBig: {
    color: COLORS.player,
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 6,
    letterSpacing: 3,
  },
  subtitleText: {
    color: '#888',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 12,
  },
  ghostIntro: {
    marginBottom: 12,
  },
  ghostIntroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 2,
  },
  miniGhost: {
    width: 16,
    height: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginRight: 8,
    overflow: 'hidden',
  },
  miniGhostHighlight: {
    position: 'absolute',
    top: 2,
    left: 2,
    width: 5,
    height: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    borderRadius: 2.5,
  },
  miniGhostEyes: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 3,
  },
  miniGhostEye: {
    width: 4,
    height: 5,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
    marginHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  miniGhostPupil: {
    width: 2,
    height: 3,
    backgroundColor: '#2121DE',
    borderRadius: 1,
  },
  ghostName: {
    color: '#FFFFFF',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  startButton: {
    backgroundColor: COLORS.player,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 6,
    marginTop: 8,
    borderWidth: 2,
    borderColor: COLORS.playerHighlight,
    borderBottomColor: COLORS.playerShadow,
    borderRightColor: COLORS.playerShadow,
  },
  startButtonText: {
    color: '#000',
    fontSize: 14,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  quitButton: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    marginTop: 10,
    borderWidth: 2,
    borderColor: '#666',
    borderRadius: 6,
  },
  quitButtonText: {
    color: '#888',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  instructionText: {
    color: '#555',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 10,
  },
  highScoreReadyText: {
    color: '#FF69B4',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 10,
  },
  pausedText: {
    color: COLORS.player,
    fontSize: 28,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 15,
  },
  gameOverText: {
    color: '#FF0000',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  levelCompleteText: {
    color: '#00FF00',
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  levelCompleteSubtext: {
    color: '#00FF00',
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  finalScoreText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
  },
  newHighScoreText: {
    color: '#FFD700',
    fontSize: 12,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 8,
  },
  powerIndicator: {
    marginTop: 8,
    alignItems: 'center',
  },
  powerText: {
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
    marginTop: 2,
  },
});

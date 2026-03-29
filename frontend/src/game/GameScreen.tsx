import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useGameStore, MAZE_LAYOUT, MAZE_WIDTH, MAZE_HEIGHT, Direction } from './store';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Calculate cell size based on screen
const GAME_WIDTH = Math.min(SCREEN_WIDTH - 20, 400);
const CELL_SIZE = Math.floor(GAME_WIDTH / MAZE_WIDTH);
const GAME_HEIGHT = CELL_SIZE * MAZE_HEIGHT;

// Colors
const COLORS = {
  background: '#000000',
  wall: '#2121DE',
  pellet: '#FFFF00',
  powerPellet: '#FFB8FF',
  player: '#FFFF00',
  text: '#FFFFFF',
  frightened: '#2121DE',
  eaten: '#FFFFFF',
};

export default function GameScreen() {
  const gameLoop = useRef<NodeJS.Timeout | null>(null);
  const ghostLoop = useRef<NodeJS.Timeout | null>(null);
  const modeTimer = useRef<NodeJS.Timeout | null>(null);
  const [mouthOpen, setMouthOpen] = useState(true);
  const [powerFlash, setPowerFlash] = useState(false);

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
    ghosts,
    gameStatus,
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
  } = useGameStore();

  // Game loop
  useEffect(() => {
    if (gameStatus === 'playing') {
      gameLoop.current = setInterval(() => {
        movePlayer();
        eatPellet();
        checkGhostCollision();
        decrementPowerTimer();
        setMouthOpen(m => !m);
      }, 100);

      ghostLoop.current = setInterval(() => {
        moveGhosts();
        checkGhostCollision();
      }, 150);

      // Mode switching timer
      modeTimer.current = setInterval(() => {
        // Switch between scatter and chase modes
        const { ghosts } = useGameStore.getState();
        const newGhosts = ghosts.map(g => ({
          ...g,
          mode: g.mode === 'scatter' ? 'chase' : 
                g.mode === 'chase' ? 'scatter' : 
                g.mode,
        }));
        useGameStore.setState({ ghosts: newGhosts });
      }, 7000);
    }

    return () => {
      if (gameLoop.current) clearInterval(gameLoop.current);
      if (ghostLoop.current) clearInterval(ghostLoop.current);
      if (modeTimer.current) clearInterval(modeTimer.current);
    };
  }, [gameStatus]);

  // Power pellet flash effect
  useEffect(() => {
    let flashInterval: NodeJS.Timeout;
    if (powerPelletActive) {
      flashInterval = setInterval(() => {
        setPowerFlash(f => !f);
      }, 200);
    }
    return () => {
      if (flashInterval) clearInterval(flashInterval);
    };
  }, [powerPelletActive]);

  // Handle swipe gestures
  const panGesture = Gesture.Pan()
    .onEnd((event) => {
      const { translationX, translationY } = event;
      
      if (Math.abs(translationX) > Math.abs(translationY)) {
        // Horizontal swipe
        if (translationX > 20) {
          setDirection('right');
        } else if (translationX < -20) {
          setDirection('left');
        }
      } else {
        // Vertical swipe
        if (translationY > 20) {
          setDirection('down');
        } else if (translationY < -20) {
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
                borderRadius: cell === 0 ? 2 : 0,
              },
            ]}
          >
            {hasPellet && (
              <View style={styles.pellet} />
            )}
            {hasPowerPellet && (
              <View style={[styles.powerPellet, powerFlash && styles.powerPelletFlash]} />
            )}
          </View>
        );
      }
    }
    
    return cells;
  };

  const renderPlayer = () => {
    const rotation = {
      right: '0deg',
      left: '180deg',
      up: '-90deg',
      down: '90deg',
    }[playerDirection];

    return (
      <View
        style={[
          styles.player,
          {
            left: playerPosition.x * CELL_SIZE,
            top: playerPosition.y * CELL_SIZE,
            width: CELL_SIZE,
            height: CELL_SIZE,
            transform: [{ rotate: rotation }],
          },
        ]}
      >
        <View style={styles.pacmanBody}>
          {mouthOpen && <View style={styles.pacmanMouth} />}
          <View style={styles.pacmanBow} />
        </View>
      </View>
    );
  };

  const renderGhosts = () => {
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
              left: ghost.position.x * CELL_SIZE,
              top: ghost.position.y * CELL_SIZE,
              width: CELL_SIZE,
              height: CELL_SIZE,
            },
          ]}
        >
          {isEaten ? (
            <View style={styles.ghostEyes}>
              <View style={styles.ghostEyeWhite}>
                <View style={styles.ghostEyePupil} />
              </View>
              <View style={styles.ghostEyeWhite}>
                <View style={styles.ghostEyePupil} />
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
                <View style={styles.frightenedMouth} />
              )}
              <View style={styles.ghostLegs}>
                <View style={[styles.ghostLeg, { backgroundColor: isFrightened ? (flashWhite ? '#FFFFFF' : COLORS.frightened) : ghost.color }]} />
                <View style={[styles.ghostLeg, { backgroundColor: isFrightened ? (flashWhite ? '#FFFFFF' : COLORS.frightened) : ghost.color }]} />
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
        >
          <Ionicons name="caret-up" size={32} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('left')}
        >
          <Ionicons name="caret-back" size={32} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.controlSpacer} />
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('right')}
        >
          <Ionicons name="caret-forward" size={32} color={COLORS.text} />
        </TouchableOpacity>
      </View>
      <View style={styles.controlRow}>
        <TouchableOpacity 
          style={styles.controlButton}
          onPress={() => setDirection('down')}
        >
          <Ionicons name="caret-down" size={32} color={COLORS.text} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderLives = () => {
    const lifeIcons = [];
    for (let i = 0; i < lives; i++) {
      lifeIcons.push(
        <View key={i} style={styles.lifeIcon}>
          <View style={styles.lifeIconInner} />
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
                <View style={[styles.miniGhost, { backgroundColor: ghost.color }]} />
                <Text style={styles.ghostName}>{ghost.name}</Text>
              </View>
            ))}
          </View>
          <TouchableOpacity style={styles.startButton} onPress={startGame}>
            <Text style={styles.startButtonText}>START GAME</Text>
          </TouchableOpacity>
          <Text style={styles.instructionText}>Swipe or use arrows to move</Text>
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
        </View>
      );
    }

    if (gameStatus === 'gameover') {
      return (
        <View style={styles.overlay}>
          <Text style={styles.gameOverText}>GAME OVER</Text>
          <Text style={styles.scoreText}>Score: {score}</Text>
          <Text style={styles.highScoreText}>High Score: {highScore}</Text>
          <TouchableOpacity style={styles.startButton} onPress={resetGame}>
            <Text style={styles.startButtonText}>PLAY AGAIN</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (gameStatus === 'levelcomplete') {
      return (
        <View style={styles.overlay}>
          <Text style={styles.levelCompleteText}>LEVEL {level} COMPLETE!</Text>
          <Text style={styles.scoreText}>Score: {score}</Text>
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

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>{score}</Text>
        </View>
        <View style={styles.levelContainer}>
          <Text style={styles.levelLabel}>LEVEL</Text>
          <Text style={styles.levelValue}>{level}</Text>
        </View>
        <View style={styles.highScoreContainer}>
          <Text style={styles.scoreLabel}>HIGH</Text>
          <Text style={styles.scoreValue}>{highScore}</Text>
        </View>
      </View>

      {/* Lives and Pause */}
      <View style={styles.infoBar}>
        {renderLives()}
        {gameStatus === 'playing' && (
          <TouchableOpacity onPress={pauseGame} style={styles.pauseButton}>
            <Ionicons name="pause" size={24} color={COLORS.text} />
          </TouchableOpacity>
        )}
      </View>

      {/* Game Area */}
      <GestureDetector gesture={panGesture}>
        <View style={[styles.gameContainer, { width: GAME_WIDTH, height: GAME_HEIGHT }]}>
          {renderMaze()}
          {gameStatus !== 'ready' && gameStatus !== 'gameover' && renderPlayer()}
          {gameStatus !== 'ready' && gameStatus !== 'gameover' && renderGhosts()}
          {renderOverlay()}
        </View>
      </GestureDetector>

      {/* Controls */}
      {gameStatus === 'playing' && renderControls()}
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
    marginBottom: 10,
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
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  scoreValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  levelLabel: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  levelValue: {
    color: '#FFB8FF',
    fontSize: 20,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  infoBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: GAME_WIDTH,
    marginBottom: 10,
  },
  livesContainer: {
    flexDirection: 'row',
  },
  lifeIcon: {
    width: 20,
    height: 20,
    marginRight: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  lifeIconInner: {
    width: 16,
    height: 16,
    backgroundColor: COLORS.player,
    borderRadius: 8,
    borderTopRightRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  pauseButton: {
    padding: 5,
  },
  gameContainer: {
    position: 'relative',
    backgroundColor: COLORS.background,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.wall,
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
    width: 10,
    height: 10,
    backgroundColor: COLORS.powerPellet,
    borderRadius: 5,
  },
  powerPelletFlash: {
    opacity: 0.3,
  },
  player: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pacmanBody: {
    width: '90%',
    height: '90%',
    backgroundColor: COLORS.player,
    borderRadius: 100,
    overflow: 'hidden',
    position: 'relative',
  },
  pacmanMouth: {
    position: 'absolute',
    right: 0,
    top: '25%',
    width: '50%',
    height: '50%',
    backgroundColor: COLORS.background,
    transform: [{ rotate: '0deg' }],
  },
  pacmanBow: {
    position: 'absolute',
    top: -3,
    left: '30%',
    width: 8,
    height: 6,
    backgroundColor: '#FF0000',
    borderRadius: 2,
  },
  ghost: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ghostBody: {
    width: '85%',
    height: '85%',
    borderTopLeftRadius: 100,
    borderTopRightRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'visible',
  },
  ghostEyes: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: -2,
  },
  ghostEyeWhite: {
    width: 6,
    height: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 3,
    marginHorizontal: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  frightenedEye: {
    width: 4,
    height: 4,
    backgroundColor: '#FFB8FF',
    borderRadius: 2,
  },
  ghostEyePupil: {
    width: 3,
    height: 3,
    backgroundColor: '#2121DE',
    borderRadius: 1.5,
  },
  frightenedMouth: {
    width: 8,
    height: 4,
    borderWidth: 1,
    borderColor: '#FFB8FF',
    marginTop: 2,
    borderRadius: 2,
  },
  ghostLegs: {
    position: 'absolute',
    bottom: -2,
    flexDirection: 'row',
    width: '100%',
    justifyContent: 'space-evenly',
  },
  ghostLeg: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  controls: {
    marginTop: 20,
    alignItems: 'center',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    width: 60,
    height: 60,
    backgroundColor: 'rgba(33, 33, 222, 0.6)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 2,
  },
  controlSpacer: {
    width: 60,
    height: 60,
    margin: 2,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  dyingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  titleText: {
    color: '#FFB8FF',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    textAlign: 'center',
  },
  titleTextBig: {
    color: COLORS.player,
    fontSize: 32,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  subtitleText: {
    color: COLORS.text,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 20,
    textAlign: 'center',
  },
  ghostIntro: {
    marginBottom: 20,
  },
  ghostIntroItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  miniGhost: {
    width: 16,
    height: 16,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    marginRight: 10,
  },
  ghostName: {
    color: COLORS.text,
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  startButton: {
    backgroundColor: COLORS.player,
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 10,
    marginTop: 10,
  },
  startButtonText: {
    color: COLORS.background,
    fontSize: 18,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  instructionText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 15,
  },
  pausedText: {
    color: COLORS.player,
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 20,
  },
  gameOverText: {
    color: '#FF0000',
    fontSize: 36,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 20,
  },
  levelCompleteText: {
    color: '#00FF00',
    fontSize: 24,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 20,
  },
  scoreText: {
    color: COLORS.text,
    fontSize: 24,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 10,
  },
  highScoreText: {
    color: '#FFB8FF',
    fontSize: 18,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginBottom: 20,
  },
  dyingText: {
    color: '#FF0000',
    fontSize: 48,
    fontWeight: 'bold',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
});

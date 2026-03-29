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
  withSpring,
  Easing,
  interpolate,
  withSequence,
  withDelay,
  runOnJS,
} from 'react-native-reanimated';
import { useGameStore, MAZE_LAYOUT, MAZE_WIDTH, MAZE_HEIGHT, Direction, FruitType } from './store';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Sizing
const CELL_SIZE = 14;
const GAME_WIDTH = CELL_SIZE * MAZE_WIDTH;
const GAME_HEIGHT = CELL_SIZE * MAZE_HEIGHT;
const CHARACTER_SIZE = CELL_SIZE * 1.6;
const GHOST_SIZE = CELL_SIZE * 1.5;

// Colors
const COLORS = {
  bg: '#000000',
  wall: '#2121DE',
  wallHL: '#5858FF',
  wallSH: '#0000AA',
  pellet: '#FCB4AA',
  pacYellow: '#FFFF00',
  pacLight: '#FFFFAA',
  pacMid: '#FFEE00',
  pacDark: '#CCAA00',
  pacLip: '#FF6699',
  bowRed: '#FF0000',
  bowLight: '#FF6666',
  bowDark: '#CC0000',
  frightened: '#2121FF',
  text: '#FFFFFF',
};

// Timing - faster and smoother
const FRAME_MS = 1000 / 60;
const MOVE_MS = 140; // Faster movement
const GHOST_MOVE_MS = 155;
const SUB_FRAMES = 4; // Extra interpolation frames

// Intro melody
const INTRO_NOTES = [
  { f: 494, d: 0.12 }, { f: 587, d: 0.12 }, { f: 698, d: 0.12 }, { f: 587, d: 0.12 },
  { f: 494, d: 0.24 }, { f: 440, d: 0.12 }, { f: 494, d: 0.12 }, { f: 587, d: 0.24 },
];

// Sound Manager
class SoundMgr {
  private static inst: SoundMgr;
  private ctx: AudioContext | null = null;
  private vol = 0.02;
  private phase = 0;
  private cnt = 0;
  
  private constructor() {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try { this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)(); } catch {}
    }
  }
  
  static get(): SoundMgr { if (!SoundMgr.inst) SoundMgr.inst = new SoundMgr(); return SoundMgr.inst; }
  
  private tone(freq: number, dur: number, type: OscillatorType = 'sine', v: number = 0.02) {
    if (!this.ctx) return;
    try {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      o.type = type; o.frequency.setValueAtTime(freq, this.ctx.currentTime);
      g.gain.setValueAtTime(v * this.vol * 10, this.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur * 0.9);
      o.start(); o.stop(this.ctx.currentTime + dur);
    } catch {}
  }
  
  intro() {
    let t = 0;
    INTRO_NOTES.forEach(n => {
      setTimeout(() => this.tone(n.f, n.d, 'square', 0.025), t * 1000);
      t += n.d;
    });
  }
  
  chomp() {
    this.cnt++;
    if (this.cnt % 5 !== 0) return;
    this.phase = 1 - this.phase;
    this.tone(this.phase ? 220 : 260, 0.025, 'sine', 0.012);
  }
  
  power() { [392, 494, 587, 784].forEach((f, i) => setTimeout(() => this.tone(f, 0.05, 'sine', 0.02), i * 40)); }
  ghost() { if (this.ctx) { try { const o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.connect(g); g.connect(this.ctx.destination); o.type = 'sine'; o.frequency.setValueAtTime(150, this.ctx.currentTime); o.frequency.exponentialRampToValueAtTime(500, this.ctx.currentTime + 0.1); g.gain.setValueAtTime(0.025, this.ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.12); o.start(); o.stop(this.ctx.currentTime + 0.12); } catch {} } }
  death() { [320, 280, 240, 200, 160].forEach((f, i) => setTimeout(() => this.tone(f, 0.07, 'sine', 0.018), i * 80)); }
  level() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.08, 'sine', 0.02), i * 80)); }
  async init() { if (Platform.OS === 'web' && this.ctx?.state === 'suspended') await this.ctx.resume(); }
}

const snd = SoundMgr.get();

export default function GameScreen() {
  const frameRef = useRef(0);
  const lastTimeRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const moveRef = useRef<NodeJS.Timeout | null>(null);
  const ghostRef = useRef<NodeJS.Timeout | null>(null);
  const modeRef = useRef<NodeJS.Timeout | null>(null);
  const subFrameRef = useRef(0);
  
  const [anim, setAnim] = useState(0);
  const [flash, setFlash] = useState(false);
  const [intro, setIntro] = useState(false);
  const [introStep, setIntroStep] = useState(0);
  
  // Smooth interpolated positions
  const pX = useSharedValue(13 * CELL_SIZE);
  const pY = useSharedValue(23 * CELL_SIZE);
  const pRot = useSharedValue(180);
  const pMouth = useSharedValue(0);

  const {
    playerPosition, playerDirection, lives, score, highScore, level,
    pellets, powerPellets, powerPelletActive, powerPelletTimer,
    fruit, ghosts, ghostsEatenCombo, gameStatus, soundEnabled,
    startGame, pauseGame, resumeGame, resetGame, setDirection,
    movePlayer, moveGhosts, eatPellet, checkGhostCollision,
    decrementPowerTimer, nextLevel, incrementGameTime,
  } = useGameStore();

  // Ultra-smooth position interpolation with cubic easing
  useEffect(() => {
    const tx = playerPosition.x * CELL_SIZE;
    const ty = playerPosition.y * CELL_SIZE;
    
    // Use spring for more natural movement
    pX.value = withTiming(tx, { duration: MOVE_MS * 0.8, easing: Easing.out(Easing.cubic) });
    pY.value = withTiming(ty, { duration: MOVE_MS * 0.8, easing: Easing.out(Easing.cubic) });
  }, [playerPosition.x, playerPosition.y]);

  // Smooth rotation
  useEffect(() => {
    const rots: Record<Direction, number> = { right: 0, left: 180, up: 270, down: 90 };
    pRot.value = withTiming(rots[playerDirection], { duration: 50, easing: Easing.out(Easing.quad) });
  }, [playerDirection]);

  // Main animation loop - 60fps with sub-frame interpolation
  useEffect(() => {
    if (gameStatus !== 'playing') return;
    let running = true;
    
    const loop = (ts: number) => {
      if (!running) return;
      const dt = ts - lastTimeRef.current;
      
      if (dt >= FRAME_MS) {
        frameRef.current++;
        subFrameRef.current = (subFrameRef.current + 1) % SUB_FRAMES;
        lastTimeRef.current = ts;
        
        // Smooth mouth animation (24 frames per cycle)
        const mouthCycle = (frameRef.current % 24) / 24;
        const mouthVal = Math.sin(mouthCycle * Math.PI * 2) * 0.5 + 0.5;
        pMouth.value = withTiming(mouthVal, { duration: FRAME_MS * 2 });
        setAnim(frameRef.current % 24);
        
        // Power flash
        if (powerPelletActive && frameRef.current % 12 === 0) setFlash(f => !f);
      }
      
      rafRef.current = requestAnimationFrame(loop);
    };
    
    rafRef.current = requestAnimationFrame(loop);
    
    // Movement timers
    moveRef.current = setInterval(() => {
      movePlayer(); eatPellet(); checkGhostCollision(); snd.chomp();
    }, MOVE_MS);
    
    ghostRef.current = setInterval(() => {
      moveGhosts(); checkGhostCollision(); decrementPowerTimer(); incrementGameTime();
    }, GHOST_MOVE_MS);
    
    modeRef.current = setInterval(() => {
      const s = useGameStore.getState();
      useGameStore.setState({ ghosts: s.ghosts.map(g => ({
        ...g, mode: g.mode === 'scatter' ? 'chase' : g.mode === 'chase' ? 'scatter' : g.mode
      }))});
    }, 7000);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (moveRef.current) clearInterval(moveRef.current);
      if (ghostRef.current) clearInterval(ghostRef.current);
      if (modeRef.current) clearInterval(modeRef.current);
    };
  }, [gameStatus, powerPelletActive]);

  // Intro sequence
  useEffect(() => {
    if (intro) {
      snd.intro();
      let s = 0;
      const iv = setInterval(() => { s++; setIntroStep(s); if (s >= 8) { clearInterval(iv); setIntro(false); startGame(); } }, 180);
      return () => clearInterval(iv);
    }
  }, [intro]);

  // Gestures
  const pan = Gesture.Pan().onEnd(e => {
    const { translationX: tx, translationY: ty } = e;
    if (Math.abs(tx) > Math.abs(ty)) setDirection(tx > 6 ? 'right' : tx < -6 ? 'left' : playerDirection);
    else setDirection(ty > 6 ? 'down' : ty < -6 ? 'up' : playerDirection);
  });

  // Maze render
  const maze = useMemo(() => {
    const c = [];
    for (let y = 0; y < MAZE_HEIGHT; y++) {
      for (let x = 0; x < MAZE_WIDTH; x++) {
        const cell = MAZE_LAYOUT[y][x];
        const pel = pellets[y]?.[x];
        const pow = powerPellets.some(p => p.x === x && p.y === y);
        
        if (cell === 0) {
          c.push(<View key={`w${x}${y}`} style={[st.cell, st.wall, { left: x * CELL_SIZE, top: y * CELL_SIZE }]}>
            <View style={st.wallHL}/><View style={st.wallSH}/>
          </View>);
        } else {
          c.push(<View key={`p${x}${y}`} style={[st.cell, { left: x * CELL_SIZE, top: y * CELL_SIZE }]}>
            {pel && <View style={st.pellet}><View style={st.pelHL}/></View>}
            {pow && <Animated.View style={[st.power, { opacity: flash ? 0.3 : 1 }]}><View style={st.powHL}/></Animated.View>}
          </View>);
        }
      }
    }
    return c;
  }, [pellets, powerPellets, flash]);

  // Player animated style
  const playerStyle = useAnimatedStyle(() => {
    const off = (CHARACTER_SIZE - CELL_SIZE) / 2;
    return {
      left: pX.value - off,
      top: pY.value - off,
      transform: [{ rotate: `${pRot.value}deg` }],
    };
  });

  // Mouth opening calculation
  const mouthOpen = useMemo(() => {
    const prog = (anim % 24) / 24;
    return Math.abs(Math.sin(prog * Math.PI * 2)) * 55;
  }, [anim]);

  // Ms. Pac-Man sprite with refined pixel art
  const renderMsPacMan = () => (
    <Animated.View style={[st.pac, playerStyle, { width: CHARACTER_SIZE, height: CHARACTER_SIZE }]}>
      {/* Main body with gradient shading */}
      <View style={st.pacBody}>
        {/* Top-left highlight */}
        <View style={st.pacHL1} />
        <View style={st.pacHL2} />
        {/* Bottom-right shadow */}
        <View style={st.pacSH1} />
        <View style={st.pacSH2} />
        
        {/* Mouth with smooth animation */}
        <View style={[st.pacMouth, { height: `${22 + mouthOpen * 0.65}%`, top: `${39 - mouthOpen * 0.35}%` }]} />
        
        {/* Inner mouth shadow */}
        <View style={[st.mouthShadow, { height: `${10 + mouthOpen * 0.3}%`, top: `${42 - mouthOpen * 0.2}%`, opacity: mouthOpen > 15 ? 0.3 : 0 }]} />
        
        {/* Eye with detail */}
        <View style={st.eye}>
          <View style={st.eyeHL} />
          <View style={st.pupil} />
        </View>
        
        {/* Refined bow with 3D shading */}
        <View style={st.bow}>
          <View style={st.bowL}>
            <View style={st.bowLHL} />
            <View style={st.bowLSH} />
          </View>
          <View style={st.bowR}>
            <View style={st.bowRHL} />
            <View style={st.bowRSH} />
          </View>
          <View style={st.bowC}>
            <View style={st.bowCHL} />
          </View>
          {/* Bow ribbon tails */}
          <View style={st.bowTail1} />
          <View style={st.bowTail2} />
        </View>
        
        {/* Beauty mark */}
        <View style={st.mark} />
        
        {/* Blush */}
        <View style={st.blush} />
        
        {/* Lip hint when mouth open */}
        <View style={[st.lip, { opacity: mouthOpen > 25 ? 0.8 : 0 }]} />
      </View>
    </Animated.View>
  );

  // Ghost sprites with smooth animation
  const renderGhosts = () => ghosts.map((g, i) => {
    const fright = g.mode === 'frightened';
    const eaten = g.mode === 'eaten';
    const fl = fright && powerPelletTimer < 20 && flash;
    
    const off = (GHOST_SIZE - CELL_SIZE) / 2;
    const wig = Math.sin((frameRef.current + i * 4) / 5) * 1.2;
    const ex = g.direction === 'left' ? -1.5 : g.direction === 'right' ? 1.5 : 0;
    const ey = g.direction === 'up' ? -1.5 : g.direction === 'down' ? 1.5 : 0;
    
    // Use direct position instead of animated style inside map
    const gLeft = g.position.x * CELL_SIZE - off;
    const gTop = g.position.y * CELL_SIZE - off + wig;
    
    return (
      <View key={g.id} style={[st.ghost, { left: gLeft, top: gTop, width: GHOST_SIZE, height: GHOST_SIZE }]}>
        {eaten ? (
          <View style={st.eyesOnly}>
            <View style={st.bigEye}><View style={[st.bigPupil, { marginLeft: ex, marginTop: ey }]} /></View>
            <View style={st.bigEye}><View style={[st.bigPupil, { marginLeft: ex, marginTop: ey }]} /></View>
          </View>
        ) : (
          <View style={[st.gBody, { backgroundColor: fright ? (fl ? '#FFF' : COLORS.frightened) : g.color }]}>
            <View style={[st.gHL, fright && { backgroundColor: 'rgba(100,100,255,0.35)' }]} />
            <View style={st.gEyes}>
              {fright ? (
                <><View style={st.fEye} /><View style={st.fEye} /></>
              ) : (
                <>
                  <View style={st.gEyeW}><View style={[st.gPupil, { marginLeft: ex, marginTop: ey }]} /></View>
                  <View style={st.gEyeW}><View style={[st.gPupil, { marginLeft: ex, marginTop: ey }]} /></View>
                </>
              )}
            </View>
            {fright && <View style={st.fMouth}>{[0,1,2,3].map(j => <View key={j} style={[st.fTooth, { backgroundColor: fl ? COLORS.frightened : '#FFB8B8' }]} />)}</View>}
            <View style={st.skirt}>
              {[0,1,2,3].map(j => <View key={j} style={[st.wave, { backgroundColor: fright ? (fl ? '#FFF' : COLORS.frightened) : g.color, marginTop: (j + Math.floor(frameRef.current / 3)) % 2 === 0 ? 0 : -2 }]} />)}
            </View>
          </View>
        )}
      </View>
    );
  });

  // Controls
  const renderDPad = () => (
    <View style={st.dpad}>
      <View style={st.dRow}><TouchableOpacity style={st.dBtn} onPress={() => setDirection('up')} activeOpacity={0.7}><View style={[st.dArr, { transform: [{ rotate: '0deg' }] }]} /></TouchableOpacity></View>
      <View style={st.dRow}>
        <TouchableOpacity style={st.dBtn} onPress={() => setDirection('left')} activeOpacity={0.7}><View style={[st.dArr, { transform: [{ rotate: '-90deg' }] }]} /></TouchableOpacity>
        <View style={st.dC} />
        <TouchableOpacity style={st.dBtn} onPress={() => setDirection('right')} activeOpacity={0.7}><View style={[st.dArr, { transform: [{ rotate: '90deg' }] }]} /></TouchableOpacity>
      </View>
      <View style={st.dRow}><TouchableOpacity style={st.dBtn} onPress={() => setDirection('down')} activeOpacity={0.7}><View style={[st.dArr, { transform: [{ rotate: '180deg' }] }]} /></TouchableOpacity></View>
    </View>
  );

  // Lives
  const renderLives = () => (
    <View style={st.lives}>
      {Array(lives).fill(0).map((_, i) => (
        <View key={i} style={st.life}>
          <View style={st.lifePac}><View style={st.lifeMouth} /><View style={st.lifeBow} /></View>
        </View>
      ))}
    </View>
  );

  const handleStart = async () => { await snd.init(); setIntro(true); setIntroStep(0); };

  // Overlays
  const renderOverlay = () => {
    if (intro) return (
      <View style={st.ov}>
        <Text style={st.ready}>READY!</Text>
        <View style={st.introRow}>{ghosts.slice(0, introStep).map(g => <View key={g.id} style={[st.introG, { backgroundColor: g.color }]} />)}</View>
      </View>
    );

    if (gameStatus === 'ready') return (
      <View style={st.ov}>
        <Text style={st.t1}>MS. NOT MR.</Text>
        <Text style={st.t2}>PAC-MAN</Text>
        <Text style={st.sub}>Pun-derful Ghost Names!</Text>
        <View style={st.gList}>
          {ghosts.map(g => (
            <View key={g.id} style={st.gRow}>
              <View style={[st.miniG, { backgroundColor: g.color }]}><View style={st.miniEyes}><View style={st.miniE} /><View style={st.miniE} /></View></View>
              <Text style={st.gName}>{g.name}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity style={st.btn} onPress={handleStart}><Text style={st.btnT}>START</Text></TouchableOpacity>
        {highScore > 0 && <Text style={st.hs}>HIGH SCORE: {highScore}</Text>}
      </View>
    );

    if (gameStatus === 'paused') return (
      <View style={st.ov}>
        <Text style={st.pause}>PAUSED</Text>
        <TouchableOpacity style={st.btn} onPress={resumeGame}><Text style={st.btnT}>RESUME</Text></TouchableOpacity>
      </View>
    );

    if (gameStatus === 'gameover') return (
      <View style={st.ov}>
        <Text style={st.over}>GAME OVER</Text>
        <Text style={st.final}>{score}</Text>
        {score >= highScore && <Text style={st.newHS}>NEW HIGH SCORE!</Text>}
        <TouchableOpacity style={st.btn} onPress={resetGame}><Text style={st.btnT}>PLAY AGAIN</Text></TouchableOpacity>
      </View>
    );

    if (gameStatus === 'levelcomplete') return (
      <View style={st.ov}>
        <Text style={st.lvlT}>LEVEL {level}</Text>
        <Text style={st.comp}>COMPLETE!</Text>
        <TouchableOpacity style={st.btn} onPress={nextLevel}><Text style={st.btnT}>CONTINUE</Text></TouchableOpacity>
      </View>
    );

    return null;
  };

  return (
    <View style={st.container}>
      <View style={st.scores}>
        <View style={st.sCol}><Text style={st.sLbl}>1UP</Text><Text style={st.sVal}>{score.toString().padStart(6, '0')}</Text></View>
        <View style={st.sCol}><Text style={st.sLbl}>HIGH SCORE</Text><Text style={st.hsVal}>{Math.max(score, highScore).toString().padStart(6, '0')}</Text></View>
        <View style={st.sCol}><Text style={st.sLbl}>LEVEL</Text><Text style={st.lvlVal}>{level}</Text></View>
      </View>
      
      <View style={st.info}>
        {renderLives()}
        {gameStatus === 'playing' && <TouchableOpacity style={st.pauseB} onPress={pauseGame}><Text style={st.pauseT}>II</Text></TouchableOpacity>}
      </View>

      <GestureDetector gesture={pan}>
        <View style={st.border}>
          <View style={[st.game, { width: GAME_WIDTH, height: GAME_HEIGHT }]}>
            {maze}
            {gameStatus !== 'ready' && gameStatus !== 'gameover' && !intro && renderMsPacMan()}
            {gameStatus !== 'ready' && gameStatus !== 'gameover' && !intro && renderGhosts()}
            {renderOverlay()}
          </View>
        </View>
      </GestureDetector>

      {gameStatus === 'playing' && !intro && renderDPad()}
      {powerPelletActive && gameStatus === 'playing' && <Text style={[st.powInd, flash && { opacity: 0.5 }]}>POWER! {Math.ceil(powerPelletTimer / 6)}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080818', alignItems: 'center', paddingTop: Platform.OS === 'ios' ? 44 : 24 },
  scores: { flexDirection: 'row', justifyContent: 'space-between', width: GAME_WIDTH + 14, paddingHorizontal: 6, paddingVertical: 5, backgroundColor: '#040410', borderRadius: 5, marginBottom: 3 },
  sCol: { alignItems: 'center' },
  sLbl: { color: '#FFF', fontSize: 7, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },
  sVal: { color: '#FFF', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },
  hsVal: { color: '#FF69B4', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },
  lvlVal: { color: '#0FF', fontSize: 12, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontWeight: 'bold' },
  info: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', width: GAME_WIDTH + 14, paddingHorizontal: 6, marginBottom: 3 },
  lives: { flexDirection: 'row' },
  life: { width: 17, height: 17, marginRight: 2 },
  lifePac: { width: 15, height: 15, backgroundColor: COLORS.pacYellow, borderRadius: 7.5, overflow: 'hidden' },
  lifeMouth: { position: 'absolute', right: -2, top: 3.5, width: 7, height: 7, backgroundColor: '#080818', transform: [{ rotate: '45deg' }] },
  lifeBow: { position: 'absolute', top: -2, left: 3.5, width: 5, height: 3, backgroundColor: COLORS.bowRed, borderRadius: 1.5 },
  pauseB: { paddingHorizontal: 7, paddingVertical: 2, backgroundColor: '#222', borderRadius: 3 },
  pauseT: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  border: { padding: 2, backgroundColor: '#040410', borderRadius: 5, borderWidth: 2, borderColor: '#1a1a2a' },
  game: { backgroundColor: COLORS.bg, overflow: 'hidden', borderRadius: 2 },
  cell: { position: 'absolute', width: CELL_SIZE, height: CELL_SIZE },
  wall: { backgroundColor: COLORS.wall, borderRadius: 2 },
  wallHL: { position: 'absolute', top: 0, left: 0, right: 2, height: 2, backgroundColor: COLORS.wallHL, borderTopLeftRadius: 2 },
  wallSH: { position: 'absolute', bottom: 0, right: 0, left: 2, height: 2, backgroundColor: COLORS.wallSH, borderBottomRightRadius: 2 },
  pellet: { width: 3, height: 3, backgroundColor: COLORS.pellet, borderRadius: 1.5, alignSelf: 'center', marginTop: 5.5 },
  pelHL: { width: 1, height: 1, backgroundColor: '#FFF', borderRadius: 0.5, position: 'absolute' },
  power: { width: 10, height: 10, backgroundColor: COLORS.pellet, borderRadius: 5, alignSelf: 'center', marginTop: 2 },
  powHL: { width: 3, height: 3, backgroundColor: '#FFF', borderRadius: 1.5, position: 'absolute', top: 1, left: 1 },
  
  // Ms. Pac-Man styles
  pac: { position: 'absolute', zIndex: 10 },
  pacBody: { width: '100%', height: '100%', backgroundColor: COLORS.pacYellow, borderRadius: 100, overflow: 'hidden' },
  pacHL1: { position: 'absolute', top: 2, left: 3, width: '30%', height: '30%', backgroundColor: COLORS.pacLight, borderRadius: 100, opacity: 0.9 },
  pacHL2: { position: 'absolute', top: 5, left: 6, width: '15%', height: '15%', backgroundColor: '#FFFFEE', borderRadius: 100, opacity: 0.7 },
  pacSH1: { position: 'absolute', bottom: 2, right: 2, width: '35%', height: '35%', backgroundColor: COLORS.pacDark, borderRadius: 100, opacity: 0.4 },
  pacSH2: { position: 'absolute', bottom: 4, right: 4, width: '20%', height: '20%', backgroundColor: '#AA8800', borderRadius: 100, opacity: 0.3 },
  pacMouth: { position: 'absolute', right: -4, width: '58%', backgroundColor: COLORS.bg, borderTopLeftRadius: 50, borderBottomLeftRadius: 50 },
  mouthShadow: { position: 'absolute', right: 0, width: '25%', backgroundColor: '#333', borderTopLeftRadius: 20, borderBottomLeftRadius: 20 },
  eye: { position: 'absolute', top: '16%', right: '28%', width: 5, height: 6, backgroundColor: '#000', borderRadius: 2.5, overflow: 'hidden' },
  eyeHL: { position: 'absolute', top: 0, left: 0, width: 2, height: 2, backgroundColor: '#444', borderRadius: 1 },
  pupil: { position: 'absolute', bottom: 1, right: 0, width: 2, height: 2, backgroundColor: '#222', borderRadius: 1 },
  
  // Refined bow
  bow: { position: 'absolute', top: -5, left: '15%', width: 16, height: 12 },
  bowL: { position: 'absolute', left: 0, top: 3, width: 7, height: 7, backgroundColor: COLORS.bowRed, borderRadius: 3.5, transform: [{ rotate: '-12deg' }], overflow: 'hidden' },
  bowLHL: { position: 'absolute', top: 1, left: 1, width: 2.5, height: 2.5, backgroundColor: COLORS.bowLight, borderRadius: 1.25 },
  bowLSH: { position: 'absolute', bottom: 0, right: 0, width: 3, height: 3, backgroundColor: COLORS.bowDark, borderRadius: 1.5 },
  bowR: { position: 'absolute', right: 0, top: 3, width: 7, height: 7, backgroundColor: COLORS.bowRed, borderRadius: 3.5, transform: [{ rotate: '12deg' }], overflow: 'hidden' },
  bowRHL: { position: 'absolute', top: 1, left: 1, width: 2.5, height: 2.5, backgroundColor: COLORS.bowLight, borderRadius: 1.25 },
  bowRSH: { position: 'absolute', bottom: 0, right: 0, width: 3, height: 3, backgroundColor: COLORS.bowDark, borderRadius: 1.5 },
  bowC: { position: 'absolute', left: 5.5, top: 4, width: 5, height: 5, backgroundColor: COLORS.bowDark, borderRadius: 2.5, overflow: 'hidden' },
  bowCHL: { position: 'absolute', top: 0.5, left: 0.5, width: 2, height: 2, backgroundColor: COLORS.bowRed, borderRadius: 1 },
  bowTail1: { position: 'absolute', left: 6, bottom: -1, width: 2, height: 4, backgroundColor: COLORS.bowRed, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, transform: [{ rotate: '-20deg' }] },
  bowTail2: { position: 'absolute', right: 6, bottom: -1, width: 2, height: 4, backgroundColor: COLORS.bowRed, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, transform: [{ rotate: '20deg' }] },
  mark: { position: 'absolute', top: '30%', right: '20%', width: 2, height: 2, backgroundColor: '#000', borderRadius: 1 },
  blush: { position: 'absolute', top: '42%', right: '18%', width: 4, height: 2, backgroundColor: COLORS.pacLip, borderRadius: 1, opacity: 0.4 },
  lip: { position: 'absolute', bottom: '26%', right: '3%', width: 3, height: 1.5, backgroundColor: COLORS.pacLip, borderRadius: 1 },
  
  // Ghost styles
  ghost: { position: 'absolute', zIndex: 9 },
  gBody: { width: '100%', height: '100%', borderTopLeftRadius: 100, borderTopRightRadius: 100, overflow: 'visible' },
  gHL: { position: 'absolute', top: 2, left: 3, width: '32%', height: '32%', backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 100 },
  gEyes: { flexDirection: 'row', justifyContent: 'center', position: 'absolute', top: '20%', left: 0, right: 0 },
  gEyeW: { width: 6, height: 7, backgroundColor: '#FFF', borderRadius: 3, marginHorizontal: 1, justifyContent: 'center', alignItems: 'center' },
  gPupil: { width: 3, height: 4, backgroundColor: '#2121DE', borderRadius: 1.5 },
  eyesOnly: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', height: '100%' },
  bigEye: { width: 8, height: 9, backgroundColor: '#FFF', borderRadius: 4, marginHorizontal: 2, justifyContent: 'center', alignItems: 'center' },
  bigPupil: { width: 4, height: 5, backgroundColor: '#2121DE', borderRadius: 2 },
  fEye: { width: 4, height: 4, backgroundColor: '#FFB8B8', borderRadius: 2, marginHorizontal: 3 },
  fMouth: { flexDirection: 'row', justifyContent: 'center', position: 'absolute', bottom: '26%', left: 0, right: 0 },
  fTooth: { width: 3, height: 2, marginHorizontal: 0.5, borderRadius: 1 },
  skirt: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center' },
  wave: { width: 4, height: 5, borderBottomLeftRadius: 4, borderBottomRightRadius: 4, marginHorizontal: 0.5 },
  
  // D-pad
  dpad: { marginTop: 8, alignItems: 'center' },
  dRow: { flexDirection: 'row', alignItems: 'center' },
  dBtn: { width: 50, height: 50, backgroundColor: '#181830', borderRadius: 7, justifyContent: 'center', alignItems: 'center', margin: 1.5, borderWidth: 2, borderColor: '#282848', borderBottomColor: '#080818', borderRightColor: '#080818' },
  dC: { width: 50, height: 50, backgroundColor: '#080818', borderRadius: 7, margin: 1.5 },
  dArr: { width: 0, height: 0, borderLeftWidth: 8, borderRightWidth: 8, borderBottomWidth: 13, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: '#FFF' },
  
  // Overlays
  ov: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center', padding: 14 },
  t1: { color: '#FFB8FF', fontSize: 17, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', letterSpacing: 2 },
  t2: { color: COLORS.pacYellow, fontSize: 23, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 5, letterSpacing: 3 },
  sub: { color: '#888', fontSize: 8, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 10 },
  gList: { marginBottom: 10 },
  gRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 1.5 },
  miniG: { width: 15, height: 15, borderTopLeftRadius: 7.5, borderTopRightRadius: 7.5, marginRight: 7, overflow: 'hidden' },
  miniEyes: { flexDirection: 'row', justifyContent: 'center', marginTop: 2.5 },
  miniE: { width: 3.5, height: 4.5, backgroundColor: '#FFF', borderRadius: 1.75, marginHorizontal: 0.75 },
  gName: { color: '#FFF', fontSize: 10, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  btn: { backgroundColor: COLORS.pacYellow, paddingHorizontal: 26, paddingVertical: 9, borderRadius: 5, marginTop: 7, borderWidth: 2, borderColor: COLORS.pacLight, borderBottomColor: COLORS.pacDark, borderRightColor: COLORS.pacDark },
  btnT: { color: '#000', fontSize: 13, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  hs: { color: '#FF69B4', fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 9 },
  pause: { color: COLORS.pacYellow, fontSize: 26, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 14 },
  over: { color: '#F00', fontSize: 22, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 9 },
  final: { color: '#FFF', fontSize: 26, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 7 },
  newHS: { color: '#FFD700', fontSize: 11, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 7 },
  lvlT: { color: '#0F0', fontSize: 20, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  comp: { color: '#0F0', fontSize: 16, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 9 },
  ready: { color: COLORS.pacYellow, fontSize: 30, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  introRow: { flexDirection: 'row', marginTop: 18 },
  introG: { width: 18, height: 18, borderTopLeftRadius: 9, borderTopRightRadius: 9, marginHorizontal: 3 },
  powInd: { color: '#FFB8FF', fontSize: 10, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginTop: 7 },
});

// Sound effects for Ms. Not Mr. Pac-Man
// These are simple synthesized sounds that approximate the classic arcade sounds

import { Audio } from 'expo-av';

class SoundManager {
  private static instance: SoundManager;
  private sounds: Map<string, Audio.Sound> = new Map();
  private enabled: boolean = true;

  private constructor() {}

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  public setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  // Play the waka waka sound when eating pellets
  public async playChomp() {
    if (!this.enabled) return;
    try {
      // Simple beep approximation
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
        { volume: 0.3 }
      );
      await sound.playAsync();
      // Clean up
      setTimeout(async () => {
        await sound.unloadAsync();
      }, 200);
    } catch (e) {
      // Silently fail on unsupported platforms
    }
  }

  // Play power pellet sound
  public async playPowerPellet() {
    if (!this.enabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
        { volume: 0.5 }
      );
      await sound.playAsync();
      setTimeout(async () => {
        await sound.unloadAsync();
      }, 500);
    } catch (e) {
      // Silently fail
    }
  }

  // Play ghost eaten sound
  public async playGhostEaten() {
    if (!this.enabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
        { volume: 0.6 }
      );
      await sound.playAsync();
      setTimeout(async () => {
        await sound.unloadAsync();
      }, 300);
    } catch (e) {
      // Silently fail
    }
  }

  // Play death sound
  public async playDeath() {
    if (!this.enabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
        { volume: 0.7 }
      );
      await sound.playAsync();
      setTimeout(async () => {
        await sound.unloadAsync();
      }, 1500);
    } catch (e) {
      // Silently fail
    }
  }

  // Play level complete sound
  public async playLevelComplete() {
    if (!this.enabled) return;
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=' },
        { volume: 0.6 }
      );
      await sound.playAsync();
      setTimeout(async () => {
        await sound.unloadAsync();
      }, 1000);
    } catch (e) {
      // Silently fail
    }
  }

  // Clean up all sounds
  public async cleanup() {
    for (const [_, sound] of this.sounds) {
      try {
        await sound.unloadAsync();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    this.sounds.clear();
  }
}

export const soundManager = SoundManager.getInstance();

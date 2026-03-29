# 👾 Ms. Not Mr. Pac-Man

> A love-letter to the arcade classic — **Ms. Pac-Man** — built with React Native / Expo and deployable on Vercel.

---

## 🎮 Game Features

- 🟡 **Ms. Pac-Man** sprite with red bow, beauty mark, and blush
- 👻 **Four ghosts** with pun names: *Blinky McBlinkface*, *Stinky Pinky*, *Thinky Inky*, *Sue-shi Roll*
- 💊 **Power pellets** — eat ghosts for combo scoring (200 → 400 → 800 → 1600)
- 🍒 **Bonus fruit** — Cherry, Strawberry, Orange, Pretzel, Apple, Pear, Banana by level
- 🏆 **Persistent high score** — saved locally via AsyncStorage
- 💀 **Death animation** — classic spinning shrink with descending sound
- 📺 **Game Over screen** — old CRT TV turning-off animation
- 📡 **CRT / retro effects** — scanlines, phosphor vignette, and screen flicker
- 🔊 **Synthesised audio** — Web Audio API for chomp, power, ghost-eat, death, and level-complete sounds

---

## 🕹️ Controls

| Platform | How to play |
|----------|-------------|
| **Desktop** | Arrow keys or WASD |
| **Mobile** | Swipe to change direction or use the D-pad |
| **Pause** | Tap the `II` button during play |

---

## 🗂️ Project Structure

```
Notmspacman/
├── frontend/               # Expo / React Native app
│   ├── app/                # Expo Router entry points
│   │   ├── index.tsx       # Root screen (mounts GameScreen)
│   │   └── +html.tsx       # HTML shell (CRT CSS effects)
│   ├── src/
│   │   └── game/
│   │       ├── GameScreen.tsx   # All rendering & animation
│   │       ├── store.ts         # Zustand game-state store
│   │       └── sounds.ts        # Legacy sound stub (replaced by SoundMgr)
│   ├── assets/
│   ├── app.json
│   └── package.json
├── backend/                # Minimal Python backend (optional)
│   ├── server.py
│   └── requirements.txt
├── vercel.json             # Vercel deployment config
└── README.md
```

---

## 🚀 Running Locally

```bash
cd frontend
yarn install
yarn web        # opens in browser
# or
yarn start      # Expo dev server (scan QR for mobile)
```

---

## ☁️ Deploying to Vercel

1. Import the repo in [vercel.com](https://vercel.com)
2. Vercel auto-reads `vercel.json` at the root — no extra setup needed
3. Build command: `cd frontend && yarn install && npx expo export --platform web`
4. Output directory: `frontend/dist`

---

## 🎵 Sound

All sounds are synthesised in real-time using the **Web Audio API** — no audio files needed.

| Sound | Trigger |
|-------|---------|
| 🎶 Intro melody | Press START |
| 😮‍💨 Waka-waka | Eating pellets |
| ⚡ Power-up | Power pellet eaten |
| 💥 Ghost eaten | Ghost eaten during power |
| 💀 Death | Ms. Pac-Man hit by ghost |
| 🎉 Level complete | All pellets cleared |

---

## 📜 Scoring

| Action | Points |
|--------|--------|
| Pellet | 10 |
| Power pellet | 50 |
| Ghost (1st) | 200 |
| Ghost (2nd combo) | 400 |
| Ghost (3rd combo) | 800 |
| Ghost (4th combo) | 1600 |
| Cherry 🍒 | 100 |
| Strawberry 🍓 | 300 |
| Orange 🍊 | 500 |
| Pretzel 🥨 | 700 |
| Apple 🍎 | 1000 |
| Pear 🍐 | 2000 |
| Banana 🍌 | 5000 |

---

## 🛠️ Tech Stack

- **React Native** + **Expo** (SDK 54)
- **Expo Router** for file-based navigation
- **React Native Reanimated** for 60 fps animations
- **React Native Gesture Handler** for swipe controls
- **Zustand** for game state management
- **AsyncStorage** for high score persistence
- **Web Audio API** for synthesised sound

---

*Made with 💛 — not affiliated with Bandai Namco or the Ms. Pac-Man franchise.*

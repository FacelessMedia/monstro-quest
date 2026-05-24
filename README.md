# 🔥 MONSTRO QUEST

A fully playable, original retro monster-catching RPG **built from scratch in 60 minutes** for a "1 AI recreated Pokemon Red in 60 minutes" YouTube video.

> **Everything is original.** All sprites are drawn programmatically as colored pixel grids in code (`lib/sprites.ts`). All creature names, designs, lore, types, and moves are original. No copyrighted or trademarked content was used.

## 🎮 Play it now
**https://monstro-quest.vercel.app**

Click "Play as Guest" to start instantly, or sign up to keep a synced username-based save.

## Features

- 🎮 **Tile-based overworld** with smooth movement and camera follow
- 🌿 **Wild encounters** in tall grass
- ⚔️ **Turn-based battles** with damage formula, type effectiveness, STAB, critical hits
- 🦊 **8 original creatures** (Cinderpaw, Aquadrip, Sprigling, Boltkit, Rockle, Wisplet, Buzzbee, Goolet, Spinifin) each with hand-coded 32×32 pixel-art sprites
- ⚡ **9 elemental types** with a full effectiveness chart
- 💊 **Catch Capsules** to capture wild monsters
- 📈 **Leveling & EXP** system with auto-learn moves
- 💾 **Save anywhere** — auto-save every 30 s + manual SAVE button
- 👤 **Username / password accounts** (browser-local) and **Guest mode**
- 🗺️ **Multi-map world** with portals between towns and routes

## Controls

| Key | Action |
|-----|--------|
| Arrow Keys / WASD | Move |
| Space / Enter / Z | Confirm / Talk |
| Escape | Open menu |
| Shift (held) | Run |

## Tech Stack

- **Next.js 14** (App Router)
- **TypeScript**
- **HTML5 Canvas** — every pixel drawn programmatically, no external image assets
- **LocalStorage** for accounts & saves
- **Vercel** for hosting

## Project Structure

```
app/            Next.js app router pages
components/     React UI (TitleScreen, Game canvas, etc.)
lib/
  sprites.ts    All sprites as char-grid + color palette pairs
  creatures.ts  Species, moves, types, damage / catch logic
  world.ts      Tilemap definitions & encounter tables
  save.ts       Login, signup, save/load
```

## Development

```bash
npm install --legacy-peer-deps
npm run dev
# http://localhost:3000
```

## Built in 60 minutes by Cascade / Windsurf

Made for fun. No real Pokémon were harmed in the making of this game.

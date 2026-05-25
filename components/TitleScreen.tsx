"use client";

import { useEffect, useRef, useState } from "react";
import { registerAccount, loginAccount, loginAsGuest } from "../lib/save";
import { SPECIES } from "../lib/creatures";
import { drawSprite } from "../lib/sprites";

type Props = {
  onLogin: (username: string) => void;
};

export function TitleScreen({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Animated creature carousel — fades through every species
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    const speciesList = Object.values(SPECIES).filter((sp: any) => sp && sp.sprite);
    if (speciesList.length === 0) return; // nothing to render
    let raf = 0;
    let t0 = performance.now();
    const tick = (t: number) => {
      const elapsed = (t - t0) / 1000;
      const W = cvs.width;
      const H = cvs.height;
      ctx.clearRect(0, 0, W, H);
      // Slow scrolling background dots
      ctx.fillStyle = "rgba(120,160,210,0.06)";
      for (let i = 0; i < 30; i++) {
        const px = (i * 73 + elapsed * 30) % W;
        const py = (i * 47 + elapsed * 12) % H;
        ctx.fillRect(px, py, 2, 2);
      }
      // Each species shown for ~2.5s with a smooth fade
      const cycle = 2.5;
      const phase = elapsed / cycle;
      const idx = ((Math.floor(phase) % speciesList.length) + speciesList.length) % speciesList.length;
      const sub = phase - Math.floor(phase); // 0..1 within slot
      const alpha = sub < 0.15 ? sub / 0.15 : sub > 0.85 ? (1 - sub) / 0.15 : 1;
      const sp = speciesList[idx];
      if (!sp || !sp.sprite) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const bob = Math.sin(elapsed * 3) * 4;
      const scale = 4;
      const spriteW = 32 * scale; // sprite is 32px wide max
      const x = Math.floor(W / 2 - spriteW / 2);
      const y = Math.floor(H / 2 - spriteW / 2 + bob) - 20;
      ctx.globalAlpha = alpha;
      drawSprite(ctx, sp.sprite, x, y, scale);
      ctx.globalAlpha = 1;
      // Caption
      ctx.font = `bold 14px "Courier New", monospace`;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.textAlign = "center";
      ctx.fillText(sp.name, W / 2, H - 28);
      ctx.font = `bold 11px "Courier New", monospace`;
      ctx.fillStyle = sp.color;
      const types = Array.isArray(sp.types) ? sp.types.join(" / ").toUpperCase() : "";
      ctx.fillText(types, W / 2, H - 12);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const result =
      mode === "login"
        ? loginAccount(username, password)
        : registerAccount(username, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onLogin(username.trim().toLowerCase());
  }

  function handleGuest() {
    loginAsGuest();
    onLogin("__guest__");
  }

  return (
    <div className="app-root">
      <div className="title-screen">
        <h1 className="logo">MONSTRO QUEST</h1>
        <p className="subtitle">A Retro Monster RPG</p>

        <canvas
          ref={canvasRef}
          width={220}
          height={220}
          className="title-carousel"
          aria-hidden="true"
        />

        <div className="form-card">
          <div className="tabs">
            <button
              type="button"
              className={`tab ${mode === "login" ? "active" : ""}`}
              onClick={() => { setMode("login"); setError(""); }}
            >
              Log In
            </button>
            <button
              type="button"
              className={`tab ${mode === "signup" ? "active" : ""}`}
              onClick={() => { setMode("signup"); setError(""); }}
            >
              Sign Up
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Trainer Name</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ember_42"
                maxLength={20}
                autoComplete="username"
                spellCheck={false}
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="•••••"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
            </div>
            <button className="btn" type="submit">
              {mode === "login" ? "Continue Adventure" : "Begin Adventure"}
            </button>
            <div className="error">{error}</div>
          </form>

          <button className="btn ghost" type="button" onClick={handleGuest}>
            Play as Guest (browser save)
          </button>
        </div>

        <p className="credits">An original retro RPG · Built fresh from pixels and code</p>
      </div>
    </div>
  );
}

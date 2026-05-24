"use client";

import { useState } from "react";
import { registerAccount, loginAccount, loginAsGuest } from "../lib/save";

type Props = {
  onLogin: (username: string) => void;
};

export function TitleScreen({ onLogin }: Props) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

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

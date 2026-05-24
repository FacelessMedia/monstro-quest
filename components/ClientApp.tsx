"use client";

import { useEffect, useState } from "react";
import { TitleScreen } from "./TitleScreen";
import { Game } from "./Game";
import { getCurrentUser, logout, displayName } from "../lib/save";

export function ClientApp() {
  const [user, setUser] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!user) {
    return <TitleScreen onLogin={(u) => setUser(u)} />;
  }

  return (
    <Game
      username={user}
      displayName={displayName(user)}
      onLogout={() => {
        logout();
        setUser(null);
      }}
    />
  );
}

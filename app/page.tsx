"use client";

import { useEffect, useState } from "react";
import { ClientApp } from "../components/ClientApp";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="app-root">
        <div className="title-screen">
          <h1 className="logo">MONSTRO QUEST</h1>
          <p className="subtitle">Loading...</p>
        </div>
      </div>
    );
  }
  return <ClientApp />;
}

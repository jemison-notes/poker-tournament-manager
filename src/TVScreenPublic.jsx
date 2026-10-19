import React, { useEffect } from 'react';
import { soundManager } from './soundUtils.js';

export default function TVScreenPublic({ tournament }) {
useEffect(() => {
  if (!tournament.isRunning) return;
  if (tournament.timeLeft > 0 && tournament.timeLeft <= 5) {
    soundManager.playTick();
  } else if (tournament.timeLeft === 0) {
    soundManager.playBlindLevelUp();
  }
}, [
  tournament.isRunning,
  tournament.timeLeft,
]);

  const currentLevel = tournament.blinds[tournament.currentLevelIndex];
  const seconds = Math.max(0, tournament.timeLeft);
  const time = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold">{tournament.name}</h1>
      <div className="text-9xl font-mono font-bold text-green-400">{time}</div>
      <h2 className="text-3xl">
        {currentLevel?.isBreak ? 'Intervalo' : `Nível ${currentLevel?.level ?? 0}`}
      </h2>
      {currentLevel && !currentLevel.isBreak && (
        <p className="text-4xl">
          Blinds: {currentLevel.smallBlind} / {currentLevel.bigBlind}
          {currentLevel.ante > 0 ? ` • Ante: ${currentLevel.ante}` : ''}
        </p>
      )}
    </main>
  );
}

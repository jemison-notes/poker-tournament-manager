import React, { useEffect } from 'react';
import { soundManager } from '.poker-tournament-manager/src/soundUtils'; 

// Dentro do componente TVScreen:
useEffect(() => {
  let interval = null;

  if (tournament.isRunning && tournament.timeLeft > 0) {
    interval = setInterval(() => {
      const nextTime = tournament.timeLeft - 1;

      // Opcional: Bip nos últimos 5 segundos (5, 4, 3, 2, 1)
      if (nextTime > 0 && nextTime <= 5) {
        soundManager.playTick();
      }

      update({ timeLeft: nextTime });
    }, 1000);
  } else if (tournament.isRunning && tournament.timeLeft === 0) {
    // 🔔 TOCA O ALERTA QUANDO OS BLINDS SOBEM
    soundManager.playBlindLevelUp();

    const nextIndex = clamp(tournament.currentLevelIndex + 1, 0, tournament.blinds.length - 1);
    const nextBlind = tournament.blinds[nextIndex];
    const duration =
      nextBlind?.duration ||
      (nextBlind?.isBreak ? nextBlind.breakDuration : null) ||
      tournament.levelDuration ||
      10;

    update({
      currentLevelIndex: nextIndex,
      timeLeft: duration * 60,
      isRunning: nextIndex < tournament.blinds.length - 1,
    });
  }

  return () => clearInterval(interval);
}, [
  tournament.isRunning,
  tournament.timeLeft,
  tournament.currentLevelIndex,
  tournament.blinds,
  tournament.levelDuration,
  update,
]);

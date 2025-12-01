import React, { useState, useEffect } from 'react';

const TVScreenPublic = ({ tournament }) => {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(t => t + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const currentLevel = tournament.blinds[tournament.currentLevelIndex] ?? { 
    level: 0, 
    smallBlind: 0, 
    bigBlind: 0, 
    ante: 0, 
    isBreak: false 
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalPrizePool = tournament.players.reduce((s, p) => {
    const actionsTotal = p.actions * tournament.buyInValue;
    const addonsTotal = p.addons * tournament.addonValue;
    const extraChipTotal = p.hasExtraChip ? tournament.extraChipValue : 0;
    const total = actionsTotal + addonsTotal + extraChipTotal;
    const afterFee = total * (1 - tournament.adminFeePercent / 100);
    return s + afterFee;
  }, 0);

  return (
    <div className="min-h-screen bg-black text-white p-8">
      {/* Cabeçalho */}
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold text-green-400 mb-2">{tournament.name}</h1>
        <div className="text-2xl text-gray-400">Torneio de Poker</div>
      </div>

      {/* Relógio Principal */}
      <div className="text-center mb-12">
        <div className="text-9xl font-mono font-extrabold text-green-400 mb-4">
          {formatTime(tournament.timeLeft)}
        </div>
        <div className="text-3xl mb-4">
          {currentLevel.isBreak ? '⏸️ INTERVALO' : `Nível ${currentLevel.level}`}
        </div>
        
        {!currentLevel.isBreak && (
          <div className="text-2xl text-gray-300 mb-2">
            Blinds: {currentLevel.smallBlind}/{currentLevel.bigBlind} 
            {currentLevel.ante > 0 ? ` • Ante: ${currentLevel.ante}` : ''}
          </div>
        )}
        
        {currentLevel.isBreak && (
          <div className="text-2xl text-orange-300 mb-2">
            Intervalo • Duração: {currentLevel.breakDuration || 10} minutos
          </div>
        )}
      </div>

      {/* Status Grid */}
      <div className="grid grid-cols-4 gap-6 mb-12">
        <div className="text-center p-4 bg-gray-900 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Prize Pool</div>
          <div className="text-3xl font-bold">R$ {totalPrizePool.toFixed(2)}</div>
        </div>
        
        <div className="text-center p-4 bg-gray-900 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Jogadores Ativos</div>
          <div className="text-3xl font-bold">{tournament.players.filter(p => p.active).length}</div>
        </div>
        
        <div className="text-center p-4 bg-gray-900 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Nível Duração</div>
          <div className="text-3xl font-bold">{tournament.levelDuration} min</div>
        </div>
        
        <div className="text-center p-4 bg-gray-900 rounded-lg">
          <div className="text-sm text-gray-400 mb-2">Nível Atual</div>
          <div className="text-3xl font-bold">{currentLevel.level}</div>
        </div>
      </div>

      {/* Top 3 */}
      <div className="grid grid-cols-3 gap-6 mb-12">
        {[1, 2, 3].map((pos) => {
          const pl = tournament.players.find(p => p.position === pos);
          return (
            <div key={pos} className={`p-6 rounded-xl text-center ${pos === 1 ? 'bg-yellow-900' : pos === 2 ? 'bg-gray-800' : 'bg-orange-900'}`}>
              <div className="text-2xl font-bold mb-2">{pos}º Lugar</div>
              <div className="text-3xl font-semibold mb-2">{pl ? pl.name : '-'}</div>
              <div className="text-xl text-gray-300">
                {pl ? `R$ ${pl.prize.toFixed(2)}` : '-'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Maiores Pilhas */}
      <div className="bg-gray-900 p-6 rounded-xl">
        <div className="text-2xl font-bold mb-4 text-center">Maiores Pilhas</div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {tournament.players
            .slice()
            .sort((a, b) => b.chips - a.chips)
            .slice(0, 6)
            .map((p, i) => (
              <div key={p.id} className="bg-black p-4 rounded-lg text-center">
                <div className="text-lg font-semibold mb-1">{p.name}</div>
                <div className="text-2xl font-bold text-green-400">{p.chips.toLocaleString()}</div>
                <div className="text-sm text-gray-400 mt-1">#{i + 1}</div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

export default TVScreenPublic;

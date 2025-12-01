import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Play, Pause, RotateCcw, Users, Trophy, Plus, Trash2, Clock, FileText, Settings } from 'lucide-react';

/*
  PokerTournamentManager.tsx
  - Tela TV (modo A) com relógio, nível, blinds, prize pool e contagem de fichas
  - Painel administrativo completo para gerenciar torneios, jogadores, blinds e fórmulas de ranking
  - Suporte a múltiplos torneios (lista) — abrir um torneio para gerenciar
  - Suporte a múltiplas fórmulas de ranking (salvas com nome); o organizador escolhe uma para aplicar
  - Persistência em localStorage

  Observações de segurança: para avaliar fórmulas, usa-se `new Function(...)` localmente.
  NÃO execute fórmulas vindas de fontes não confiáveis em produção.
*/

// Removido type definitions - usando comentários JSDoc ou objetos JS

const uid = (prefix = '') => `${prefix}${Date.now()}${Math.floor(Math.random() * 9999)}`;

const defaultBlindStructure = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0 },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0 },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 25, isBreak: true, breakDuration: 10 },
  { level: 4, smallBlind: 100, bigBlind: 200, ante: 25 },
  { level: 5, smallBlind: 150, bigBlind: 300, ante: 50 },
];

const saveKey = 'poker_tournaments_v1';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// --------- Context to share tournaments ---------
const TournamentsContext = createContext(null);

const useTournaments = () => useContext(TournamentsContext);

// --------- Provider ---------
const TournamentsProvider = ({ children }) => {
  const [tournaments, setTournaments] = useState([]);
  const [activeTournamentId, setActiveTournamentId] = useState(null);

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setTournaments(parsed);
        if (parsed.length) setActiveTournamentId(parsed[0].id);
      }
    } catch (e) {
      console.warn('Could not parse saved tournaments', e);
    }
  }, []);

  // save
  useEffect(() => {
    localStorage.setItem(saveKey, JSON.stringify(tournaments));
  }, [tournaments]);

  const createTournament = (name = 'Novo Torneio') => {
    const t = {
      id: uid('tr_'),
      name,
      players: [],
      blinds: defaultBlindStructure,
      levelDuration: 10,
      currentLevelIndex: 0,
      timeLeft: 10 * 60,
      isRunning: false,
      stageWeight: 1.0,
      buyInValue: 100,
      buyInChips: 10000,
      rebuyValue: 100,
      rebuyChips: 10000,
      addonValue: 50,
      addonChips: 5000,
      adminFeePercent: 10,
      timeChipEnabled: false,
      timeChipValue: 2000,
      extraChipEnabled: false,
      extraChipValue: 20,
      extraChipAmount: 2000,
    };
    setTournaments((s) => [t, ...s]);
    setActiveTournamentId(t.id);
  };

  const updateTournament = (id, patch) => {
    setTournaments((s) => s.map(t => t.id === id ? { ...t, ...patch } : t));
  };

  const removeTournament = (id) => {
    setTournaments((s) => s.filter(t => t.id !== id));
    setActiveTournamentId((cur) => (cur === id ? (tournaments[0]?.id ?? null) : cur));
  };

  return (
    <TournamentsContext.Provider value={{ tournaments, setTournaments, activeTournamentId, setActiveTournamentId, createTournament, updateTournament, removeTournament }}>
      {children}
    </TournamentsContext.Provider>
  );
};

// --------- Formula evaluator (local only) ---------
function calculateRanking(actions, position, stageWeight) {
  // Fórmula: (((total de ações / posição) * 100) ^ 0.5) * peso da etapa
  if (position <= 0 || actions <= 0) return 0;
  return Math.pow(((actions / position) * 100), 0.5) * stageWeight;
}

// --------- Components ---------

const TopBar = ({ title, onCreate }) => {
  const { createTournament } = useTournaments();
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-3xl font-bold text-white flex items-center gap-3">
        <Trophy size={28} />
        {title || 'Gerenciador de Torneios'}
      </h1>
      <div className="flex gap-2">
        <button className="px-4 py-2 bg-blue-600 rounded text-white flex items-center gap-2" onClick={() => createTournament('Torneio ' + new Date().toLocaleString())}>
          <Plus size={16} /> Novo Torneio
        </button>
      </div>
    </div>
  );
};

// Tournament List (left column)
const TournamentList = () => {
  const { tournaments, activeTournamentId, setActiveTournamentId, removeTournament } = useTournaments();
  return (
    <div className="w-72 bg-gray-900 p-4 rounded-lg">
      <div className="text-gray-300 font-semibold mb-2">Torneios</div>
      <div className="space-y-2 max-h-80 overflow-auto">
        {tournaments.map(t => (
          <div key={t.id} className={`p-3 rounded-md cursor-pointer flex items-center justify-between ${t.id === activeTournamentId ? 'bg-green-700' : 'bg-gray-800'}`} onClick={() => setActiveTournamentId(t.id)}>
            <div className="text-white font-medium">{t.name}</div>
            <div className="flex gap-2">
              <button onClick={(e) => { e.stopPropagation(); removeTournament(t.id); }} className="p-1 rounded bg-red-600 text-white"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
        {tournaments.length === 0 && <div className="text-gray-500">Nenhum torneio. Crie um novo.</div>}
      </div>
    </div>
  );
};

// TV Screen (Modo A) — Relógio, nível, blinds para admin (com controles)
const TVScreen = ({ tournament, update }) => {
  const [tick, setTick] = useState(0);

  // Timer effect
  useEffect(() => {
    let interval;
    if (tournament.isRunning && tournament.timeLeft > 0) {
      interval = setInterval(() => {
        update({ timeLeft: tournament.timeLeft - 1 });
        setTick((t) => t + 1);
      }, 1000);
    } else if (tournament.isRunning && tournament.timeLeft === 0) {
      // advance
      const next = clamp(tournament.currentLevelIndex + 1, 0, tournament.blinds.length - 1);
      update({ 
        currentLevelIndex: next, 
        timeLeft: tournament.levelDuration * 60, 
        isRunning: next === tournament.blinds.length - 1 ? false : tournament.isRunning 
      });
    }
    return () => clearInterval(interval);
  }, [tournament.isRunning, tournament.timeLeft, tournament.currentLevelIndex]);

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

  // Função para abrir TV em nova janela
  const openTVWindow = () => {
    const tvWindow = window.open('/tv', 'tv-screen', 'width=1200,height=800,menubar=no,toolbar=no,location=no');
    if (tvWindow) {
      // Salva o torneio atual no localStorage para a TV acessar
      localStorage.setItem('current_tv_tournament', JSON.stringify(tournament));
      localStorage.setItem('current_tv_tournament_id', tournament.id);
    }
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-white">Tela TV (Modo Admin)</h3>
        <button 
          onClick={openTVWindow}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 rounded-lg text-white font-bold flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Abrir Tela TV (Nova Janela)
        </button>
      </div>

      <div className="bg-black rounded-lg p-6 text-center text-white shadow-lg">
        <div className="text-6xl font-mono font-extrabold text-green-400 mb-4">
          {formatTime(tournament.timeLeft)}
        </div>
        
        <div className="text-xl mb-2">
          {currentLevel.isBreak ? (
            <span className="text-orange-400">⏸️ INTERVALO • Nível {currentLevel.level}</span>
          ) : (
            <span>Nível {currentLevel.level}</span>
          )}
        </div>
        
        {!currentLevel.isBreak && (
          <div className="text-lg text-gray-300 mb-2">
            Blinds: {currentLevel.smallBlind}/{currentLevel.bigBlind} 
            {currentLevel.ante > 0 ? ` • Ante: ${currentLevel.ante}` : ''}
          </div>
        )}
        
        {currentLevel.isBreak && (
          <div className="text-lg text-orange-300 mb-2">
            Pausa de {currentLevel.breakDuration} minutos
          </div>
        )}

        <div className="flex justify-center gap-6 my-6">
          <div className="text-center">
            <div className="text-sm text-gray-400">Prize Pool</div>
            <div className="text-2xl font-bold">R$ {totalPrizePool.toFixed(2)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Jogadores Ativos</div>
            <div className="text-2xl font-bold">{tournament.players.filter(p => p.active).length}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-gray-400">Nível Duração</div>
            <div className="text-2xl font-bold">{tournament.levelDuration} min</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <button 
            onClick={() => update({ isRunning: !tournament.isRunning })} 
            className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 ${tournament.isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}
          >
            {tournament.isRunning ? <Pause size={18} /> : <Play size={18} />} 
            {tournament.isRunning ? 'Pausar' : 'Iniciar'}
          </button>
          
          <button 
            onClick={() => update({ isRunning: false, currentLevelIndex: 0, timeLeft: tournament.levelDuration * 60 })} 
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2"
          >
            <RotateCcw size={18} /> Reiniciar
          </button>
          
          <button 
            onClick={() => update({ 
              currentLevelIndex: clamp(tournament.currentLevelIndex - 1, 0, tournament.blinds.length - 1), 
              timeLeft: tournament.levelDuration * 60 
            })} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            ← Nível Anterior
          </button>
          
          <button 
            onClick={() => update({ 
              currentLevelIndex: clamp(tournament.currentLevelIndex + 1, 0, tournament.blinds.length - 1), 
              timeLeft: tournament.levelDuration * 60 
            })} 
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg"
          >
            Próximo Nível →
          </button>
        </div>
      </div>

      {/* Instruções */}
      <div className="bg-gray-900 p-4 rounded-lg">
        <div className="text-gray-300 text-sm">
          <strong>Dica:</strong> Use o botão "Abrir Tela TV" para exibir o relógio em uma janela separada. 
          Assim você pode continuar usando o painel administrativo enquanto os jogadores veem apenas o relógio.
        </div>
      </div>
    </div>
  );
};
  // Timer effect
  useEffect(() => {
    let interval;
    if (tournament.isRunning && tournament.timeLeft > 0) {
      interval = setInterval(() => {
        update({ timeLeft: tournament.timeLeft - 1 });
        setTick((t) => t + 1);
      }, 1000);
    } else if (tournament.isRunning && tournament.timeLeft === 0) {
      // advance
      const next = clamp(tournament.currentLevelIndex + 1, 0, tournament.blinds.length - 1);
      update({ currentLevelIndex: next, timeLeft: tournament.levelDuration * 60, isRunning: next === tournament.blinds.length - 1 ? false : tournament.isRunning });
    }
    return () => clearInterval(interval);
  }, [tournament.isRunning, tournament.timeLeft, tournament.currentLevelIndex]);

  const currentLevel = tournament.blinds[tournament.currentLevelIndex] ?? { level: 0, smallBlind: 0, bigBlind: 0, ante: 0, isBreak: false };

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

  if (currentLevel.isBreak) {
    return (
      <div className="bg-black rounded-lg p-8 text-center text-white shadow-lg">
        <div className="text-7xl font-mono font-extrabold text-orange-400 mb-4">{formatTime(tournament.timeLeft)}</div>
        <div className="text-4xl mb-4 text-orange-300">⏸️ INTERVALO</div>
        <div className="text-xl text-gray-300 mb-2">Nível {currentLevel.level} - Pausa de {currentLevel.breakDuration} minutos</div>
        <div className="flex justify-center gap-6 my-4">
          <div>
            <div className="text-sm text-gray-400">Prize Pool</div>
            <div className="text-2xl font-bold">R$ {totalPrizePool.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Jogadores Ativos</div>
            <div className="text-2xl font-bold">{tournament.players.filter(p => p.active).length}</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex gap-3 justify-center mt-6">
          <button onClick={() => update({ isRunning: !tournament.isRunning })} className={`px-6 py-3 rounded font-bold flex items-center gap-2 ${tournament.isRunning ? 'bg-red-600' : 'bg-green-600'}`}>
            {tournament.isRunning ? <Pause size={18} /> : <Play size={18} />} {tournament.isRunning ? 'Pausar' : 'Iniciar'}
          </button>
          <button onClick={() => update({ isRunning: false, currentLevelIndex: 0, timeLeft: tournament.levelDuration * 60 })} className="px-6 py-3 bg-gray-700 rounded flex items-center gap-2"> <RotateCcw size={18} /> Reiniciar</button>
          <button onClick={() => update({ currentLevelIndex: clamp(tournament.currentLevelIndex - 1, 0, tournament.blinds.length - 1), timeLeft: tournament.levelDuration * 60 })} className="px-4 py-2 bg-blue-600 rounded">←</button>
          <button onClick={() => update({ currentLevelIndex: clamp(tournament.currentLevelIndex + 1, 0, tournament.blinds.length - 1), timeLeft: tournament.levelDuration * 60 })} className="px-4 py-2 bg-blue-600 rounded">→</button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black rounded-lg p-8 text-center text-white shadow-lg">
      <div className="text-7xl font-mono font-extrabold text-green-400 mb-4">{formatTime(tournament.timeLeft)}</div>
      <div className="text-2xl mb-1">Nível {currentLevel.level}</div>
      <div className="text-lg text-gray-300 mb-2">Blinds: {currentLevel.smallBlind}/{currentLevel.bigBlind} {currentLevel.ante > 0 ? `• Ante: ${currentLevel.ante}` : ''}</div>
      <div className="flex justify-center gap-6 my-4">
        <div>
          <div className="text-sm text-gray-400">Prize Pool</div>
          <div className="text-2xl font-bold">R$ {totalPrizePool.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Jogadores Ativos</div>
          <div className="text-2xl font-bold">{tournament.players.filter(p => p.active).length}</div>
        </div>
        <div>
          <div className="text-sm text-gray-400">Nível Duração</div>
          <div className="text-2xl font-bold">{tournament.levelDuration} min</div>
        </div>
      </div>

      {/* Top prizes (first 3) */}
      <div className="mt-6 grid grid-cols-3 gap-4">
        {[1,2,3].map((pos) => {
          const pl = tournament.players.find(p => p.position === pos);
          return (
            <div key={pos} className="bg-gray-900 p-4 rounded-lg">
              <div className="text-sm text-gray-400">{pos}º Lugar</div>
              <div className="font-semibold text-lg mt-1">{pl ? pl.name : '-'}</div>
              <div className="text-sm text-gray-400">Prêmio: {pl ? `R$ ${pl.prize.toFixed(2)}` : '-'}</div>
            </div>
          );
        })}
      </div>

      {/* Chips: show top 6 stacks */}
      <div className="mt-6 bg-gray-900 p-4 rounded-lg">
        <div className="text-left text-gray-300 font-semibold mb-2">Maior Pilha (Top 6)</div>
        <div className="grid grid-cols-2 gap-2">
          {tournament.players
            .slice()
            .sort((a,b) => b.chips - a.chips)
            .slice(0,6)
            .map(p => (
              <div key={p.id} className="flex justify-between items-center p-2 bg-black rounded">
                <div className="text-sm text-gray-200">{p.name}</div>
                <div className="text-sm font-bold">{p.chips}</div>
              </div>
            ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-3 justify-center mt-6">
        <button onClick={() => update({ isRunning: !tournament.isRunning })} className={`px-6 py-3 rounded font-bold flex items-center gap-2 ${tournament.isRunning ? 'bg-red-600' : 'bg-green-600'}`}>
          {tournament.isRunning ? <Pause size={18} /> : <Play size={18} />} {tournament.isRunning ? 'Pausar' : 'Iniciar'}
        </button>
        <button onClick={() => update({ isRunning: false, currentLevelIndex: 0, timeLeft: tournament.levelDuration * 60 })} className="px-6 py-3 bg-gray-700 rounded flex items-center gap-2"> <RotateCcw size={18} /> Reiniciar</button>
        <button onClick={() => update({ currentLevelIndex: clamp(tournament.currentLevelIndex - 1, 0, tournament.blinds.length - 1), timeLeft: tournament.levelDuration * 60 })} className="px-4 py-2 bg-blue-600 rounded">←</button>
        <button onClick={() => update({ currentLevelIndex: clamp(tournament.currentLevelIndex + 1, 0, tournament.blinds.length - 1), timeLeft: tournament.levelDuration * 60 })} className="px-4 py-2 bg-blue-600 rounded">→</button>
      </div>
    </div>
  );
};

// Admin Panel: editar jogadores, blinds, fórmulas, exportar
const AdminPanel = ({ tournament, save }) => {
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => { setNewPlayerName(''); }, [tournament.id]);

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;
    
    // Verifica se é time chip (níveis 1 ou 2)
    const isTimeChipEligible = tournament.timeChipEnabled && tournament.currentLevelIndex < 2;
    const timeChipBonus = isTimeChipEligible ? tournament.timeChipValue : 0;
    
    const p = { 
      id: Date.now(), 
      name: newPlayerName.trim(), 
      actions: 1, // começa com 1 buy-in
      rebuys: 0, 
      addons: 0,
      chips: tournament.buyInChips + timeChipBonus, 
      position: null, 
      prize: 0, 
      active: true,
      hasTimeChip: isTimeChipEligible,
      hasExtraChip: false,
    };
    save({ players: [...tournament.players, p] });
    setNewPlayerName('');
  };

  const updatePlayer = (id, patch) => {
    save({ players: tournament.players.map(p => p.id === id ? { ...p, ...patch } : p) });
  };

  const removePlayer = (id) => {
    save({ players: tournament.players.filter(p => p.id !== id) });
  };

  const exportCSV = () => {
    const rows = tournament.players.map(p => ({ 
      id: p.id, 
      name: p.name, 
      actions: p.actions,
      rebuys: p.rebuys, 
      addons: p.addons,
      hasTimeChip: p.hasTimeChip,
      hasExtraChip: p.hasExtraChip,
      chips: p.chips, 
      position: p.position, 
      prize: p.prize 
    }));
    const header = Object.keys(rows[0] || {}).join(',') + '\n';
    const body = rows.map(r => Object.values(r).join(',')).join('\n');
    const csv = header + body;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name.replace(/[^a-z0-9]/gi,'_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <h3 className="text-xl font-bold text-white">Painel Administrativo</h3>
      
      {/* Configurações do Torneio */}
      <div className="bg-gray-900 p-4 rounded">
        <div className="text-gray-300 font-semibold mb-3">Configurações do Torneio</div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Duração do nível (min)</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.levelDuration} onChange={(e)=> save({ levelDuration: clamp(Number(e.target.value)||1,1,180), timeLeft: clamp(Number(e.target.value)||1,1,180)*60 })} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Nível atual</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.currentLevelIndex} onChange={(e)=> save({ currentLevelIndex: clamp(Number(e.target.value)||0,0,tournament.blinds.length-1), timeLeft: tournament.levelDuration*60 })} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Peso da Etapa</label>
            <input type="number" step="0.1" className="w-full p-2 rounded bg-black text-white" value={tournament.stageWeight} onChange={(e)=> save({ stageWeight: Number(e.target.value) || 1 })} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Taxa Admin (%)</label>
            <input type="number" step="0.1" className="w-full p-2 rounded bg-black text-white" value={tournament.adminFeePercent} onChange={(e)=> save({ adminFeePercent: Number(e.target.value) || 0 })} />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Buy-in (R$)</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.buyInValue} onChange={(e)=> save({ buyInValue: Number(e.target.value) || 0 })} />
            <label className="block text-sm text-gray-400 mb-1 mt-2">Fichas do Buy-in</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.buyInChips} onChange={(e)=> save({ buyInChips: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Rebuy (R$)</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.rebuyValue} onChange={(e)=> save({ rebuyValue: Number(e.target.value) || 0 })} />
            <label className="block text-sm text-gray-400 mb-1 mt-2">Fichas do Rebuy</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.rebuyChips} onChange={(e)=> save({ rebuyChips: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Addon (R$)</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.addonValue} onChange={(e)=> save({ addonValue: Number(e.target.value) || 0 })} />
            <label className="block text-sm text-gray-400 mb-1 mt-2">Fichas do Addon</label>
            <input type="number" className="w-full p-2 rounded bg-black text-white" value={tournament.addonChips} onChange={(e)=> save({ addonChips: Number(e.target.value) || 0 })} />
          </div>
        </div>

        {/* Time Chip e Extra Chip */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="bg-black p-3 rounded">
            <label className="flex items-center gap-2 text-white mb-2">
              <input 
                type="checkbox" 
                checked={tournament.timeChipEnabled} 
                onChange={(e)=> save({ timeChipEnabled: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="font-semibold">Time Chip</span>
            </label>
            <div className="text-xs text-gray-400 mb-2">Fichas extras para quem se inscreve nos 2 primeiros níveis</div>
            <label className="block text-sm text-gray-400 mb-1">Fichas Time Chip</label>
            <input 
              type="number" 
              className="w-full p-2 rounded bg-gray-800 text-white" 
              value={tournament.timeChipValue} 
              onChange={(e)=> save({ timeChipValue: Number(e.target.value) || 0 })}
              disabled={!tournament.timeChipEnabled}
            />
          </div>
          <div className="bg-black p-3 rounded">
            <label className="flex items-center gap-2 text-white mb-2">
              <input 
                type="checkbox" 
                checked={tournament.extraChipEnabled} 
                onChange={(e)=> save({ extraChipEnabled: e.target.checked })}
                className="w-4 h-4"
              />
              <span className="font-semibold">Extra Chip</span>
            </label>
            <div className="text-xs text-gray-400 mb-2">Fichas extras que podem ser compradas no buy-in</div>
            <label className="block text-sm text-gray-400 mb-1">Valor (R$)</label>
            <input 
              type="number" 
              className="w-full p-2 rounded bg-gray-800 text-white mb-2" 
              value={tournament.extraChipValue} 
              onChange={(e)=> save({ extraChipValue: Number(e.target.value) || 0 })}
              disabled={!tournament.extraChipEnabled}
            />
            <label className="block text-sm text-gray-400 mb-1">Quantidade de Fichas</label>
            <input 
              type="number" 
              className="w-full p-2 rounded bg-gray-800 text-white" 
              value={tournament.extraChipAmount} 
              onChange={(e)=> save({ extraChipAmount: Number(e.target.value) || 0 })}
              disabled={!tournament.extraChipEnabled}
            />
          </div>
        </div>
      </div>

      {/* Adicionar Jogador */}
      <div className="bg-gray-900 p-4 rounded">
        <div className="text-gray-300 font-semibold mb-2">Adicionar Jogador</div>
        {tournament.timeChipEnabled && tournament.currentLevelIndex < 2 && (
          <div className="text-sm text-green-400 mb-2">✓ Time Chip ativo - Jogador receberá +{tournament.timeChipValue} fichas</div>
        )}
        <div className="flex gap-2">
          <input className="flex-1 p-2 rounded bg-black text-white" placeholder="Nome do jogador" value={newPlayerName} onChange={(e)=>setNewPlayerName(e.target.value)} />
          <button onClick={addPlayer} className="px-4 py-2 bg-green-600 rounded text-white">Adicionar</button>
          <button onClick={exportCSV} className="px-4 py-2 bg-gray-700 rounded text-white">Exportar CSV</button>
        </div>
      </div>

      {/* Players list */}
      <div className="bg-gray-900 p-3 rounded">
        <div className="text-gray-300 font-semibold mb-2">Jogadores ({tournament.players.length})</div>
        <div className="space-y-2 max-h-96 overflow-auto">
          {tournament.players.map(p => {
            const totalPaid = (p.actions * tournament.buyInValue) + (p.addons * tournament.addonValue) + (p.hasExtraChip ? tournament.extraChipValue : 0);
            return (
              <div key={p.id} className="flex items-center justify-between p-3 bg-black rounded">
                <div>
                  <div className="text-white font-medium flex items-center gap-2">
                    {p.name}
                    {p.hasTimeChip && <span className="text-xs bg-green-700 px-2 py-0.5 rounded">TIME</span>}
                    {p.hasExtraChip && <span className="text-xs bg-purple-700 px-2 py-0.5 rounded">EXTRA</span>}
                  </div>
                  <div className="text-sm text-gray-400">
                    Ações: {p.actions} (Buy-in + {p.rebuys} rebuys) • Addons: {p.addons} • Chips: {p.chips.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Total pago: R$ {totalPaid.toFixed(2)}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <div className="flex flex-col gap-1">
                    <input 
                      type="number" 
                      value={p.chips} 
                      onChange={(e)=> updatePlayer(p.id, { chips: Number(e.target.value) })} 
                      className="w-24 p-1 rounded bg-gray-800 text-white text-sm" 
                      placeholder="Fichas"
                    />
                    {tournament.extraChipEnabled && !p.hasExtraChip && (
                      <button 
                        onClick={()=> updatePlayer(p.id, { 
                          hasExtraChip: true,
                          chips: p.chips + tournament.extraChipAmount 
                        })} 
                        className="px-2 py-1 bg-purple-600 rounded text-white text-xs whitespace-nowrap"
                      >
                        +Extra Chip
                      </button>
                    )}
                  </div>
                  <button 
                    onClick={()=> updatePlayer(p.id, { 
                      rebuys: p.rebuys + 1, 
                      actions: p.actions + 1,
                      chips: p.chips + tournament.rebuyChips 
                    })} 
                    className="px-3 py-1 bg-blue-600 rounded text-white text-sm whitespace-nowrap"
                  >
                    +Rebuy
                  </button>
                  <button 
                    onClick={()=> updatePlayer(p.id, { 
                      addons: p.addons + 1,
                      chips: p.chips + tournament.addonChips 
                    })} 
                    className="px-3 py-1 bg-purple-600 rounded text-white text-sm whitespace-nowrap"
                  >
                    +Addon
                  </button>
                  <button 
                    onClick={()=> updatePlayer(p.id, { 
                      active: false, 
                      position: tournament.players.filter(x=>x.active).length 
                    })} 
                    className="px-3 py-1 bg-red-600 rounded text-white text-sm"
                  >
                    Eliminar
                  </button>
                  <button 
                    onClick={()=> removePlayer(p.id)} 
                    className="px-2 py-1 bg-gray-600 rounded text-white text-sm"
                  >
                    ✕
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// Blinds Structure Manager
const BlindsManager = ({ tournament, save }) => {
  const addBlindLevel = () => {
    const lastLevel = tournament.blinds[tournament.blinds.length - 1];
    const newLevel = {
      level: (lastLevel?.level || 0) + 1,
      smallBlind: (lastLevel?.smallBlind || 25) * 2,
      bigBlind: (lastLevel?.bigBlind || 50) * 2,
      ante: lastLevel?.ante || 0,
      isBreak: false,
    };
    save({ blinds: [...tournament.blinds, newLevel] });
  };

  const addBreak = () => {
    const lastLevel = tournament.blinds[tournament.blinds.length - 1];
    const newBreak = {
      level: (lastLevel?.level || 0) + 1,
      smallBlind: 0,
      bigBlind: 0,
      ante: 0,
      isBreak: true,
      breakDuration: 10,
    };
    save({ blinds: [...tournament.blinds, newBreak] });
  };

  const updateBlind = (index, patch) => {
    const updated = tournament.blinds.map((b, i) => i === index ? { ...b, ...patch } : b);
    save({ blinds: updated });
  };

  const removeBlind = (index) => {
    save({ blinds: tournament.blinds.filter((_, i) => i !== index) });
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-white">Estrutura de Blinds</h3>
        <div className="flex gap-2">
          <button onClick={addBlindLevel} className="px-3 py-2 bg-green-600 rounded text-white text-sm">
            + Adicionar Nível
          </button>
          <button onClick={addBreak} className="px-3 py-2 bg-orange-600 rounded text-white text-sm">
            + Adicionar Intervalo
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-[600px] overflow-auto">
        {tournament.blinds.map((blind, index) => (
          <div key={index} className={`p-3 rounded ${blind.isBreak ? 'bg-orange-900' : 'bg-gray-900'}`}>
            {blind.isBreak ? (
              <div className="flex items-center gap-4">
                <div className="flex-1 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nível</label>
                    <input
                      type="number"
                      className="w-full p-2 rounded bg-black text-white"
                      value={blind.level}
                      onChange={(e) => updateBlind(index, { level: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Duração do Intervalo (min)</label>
                    <input
                      type="number"
                      className="w-full p-2 rounded bg-black text-white"
                      value={blind.breakDuration || 10}
                      onChange={(e) => updateBlind(index, { breakDuration: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="text-orange-300 font-bold text-sm">INTERVALO</div>
                <button onClick={() => removeBlind(index)} className="px-3 py-2 bg-red-600 rounded text-white">
                  Remover
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex-1 grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Nível</label>
                    <input
                      type="number"
                      className="w-full p-2 rounded bg-black text-white"
                      value={blind.level}
                      onChange={(e) => updateBlind(index, { level: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Small Blind</label>
                    <input
                      type="number"
                      className="w-full p-2 rounded bg-black text-white"
                      value={blind.smallBlind}
                      onChange={(e) => updateBlind(index, { smallBlind: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Big Blind</label>
                    <input
                      type="number"
                      className="w-full p-2 rounded bg-black text-white"
                      value={blind.bigBlind}
                      onChange={(e) => updateBlind(index, { bigBlind: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Ante</label>
                    <input
                      type="number"
                      className="w-full p-2 rounded bg-black text-white"
                      value={blind.ante}
                      onChange={(e) => updateBlind(index, { ante: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <button onClick={() => removeBlind(index)} className="px-3 py-2 bg-red-600 rounded text-white">
                  Remover
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

const RankingViewer = ({ tournament }) => {
  const withScores = tournament.players.map(p => {
    const position = p.position ?? (p.active ? tournament.players.length : tournament.players.length);
    const score = calculateRanking(p.actions, position, tournament.stageWeight);
    return { ...p, score, finalPosition: position };
  }).sort((a,b) => b.score - a.score);

  return (
    <div className="bg-gray-800 p-4 rounded-lg">
      <div className="text-white font-semibold mb-3 text-xl">
        Ranking - Fórmula: (((ações ÷ posição) × 100) ^ 0.5) × peso da etapa
      </div>
      <div className="text-sm text-gray-400 mb-4">
        Peso da etapa atual: {tournament.stageWeight}
      </div>
      <div className="space-y-2">
        {withScores.map((p, i) => (
          <div key={p.id} className={`p-3 rounded flex items-center justify-between ${i===0? 'bg-yellow-500 text-black': i===1? 'bg-gray-600 text-white' : i===2? 'bg-orange-700 text-white' : 'bg-gray-900 text-white'}`}>
            <div className="flex gap-4 items-center">
              <div className="font-bold text-lg w-8">{i + 1}º</div>
              <div>
                <div className="font-medium">{p.name}</div>
                <div className="text-sm opacity-75">
                  Posição no torneio: {p.finalPosition}º • Ações: {p.actions}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold text-xl">{p.score.toFixed(2)}</div>
              <div className="text-xs opacity-75">pontos</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main App
const PokerTournamentManagerApp = () => {
  const { tournaments, activeTournamentId, setTournaments, updateTournament } = useTournaments();
  const [activeTab, setActiveTab] = useState('tv');

  const active = tournaments.find(t => t.id === activeTournamentId);

  const save = (patch) => {
    if (!active) return;
    const updated = { ...active, ...patch };
    setTournaments(ts => ts.map(t => t.id === active.id ? updated : t));
  };

  if (!active) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 to-gray-800 p-6">
      <div className="max-w-4xl w-full">
        <TopBar />
        <div className="mt-6 bg-gray-800 p-6 rounded text-white">
          <div className="text-center mb-4">Nenhum torneio selecionado. Crie um novo torneio para começar!</div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-green-900 to-gray-900 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-[280px_1fr] gap-6">
        <div>
          <TopBar title={active.name} />
          <TournamentList />
        </div>

        <div>
          <div className="flex gap-2 mb-4">
            <button onClick={()=> setActiveTab('tv')} className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab==='tv'? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}> <Clock size={16}/> TV</button>
            <button onClick={()=> setActiveTab('admin')} className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab==='admin'? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}> <Settings size={16}/> Admin</button>
            <button onClick={()=> setActiveTab('blinds')} className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab==='blinds'? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}> <FileText size={16}/> Blinds</button>
            <button onClick={()=> setActiveTab('ranking')} className={`px-4 py-2 rounded flex items-center gap-2 ${activeTab==='ranking'? 'bg-green-600 text-white' : 'bg-gray-700 text-white'}`}> <Trophy size={16}/> Ranking</button>
          </div>

          {activeTab === 'tv' && <TVScreen tournament={active} update={(p)=> save(p)} />}
          {activeTab === 'admin' && <AdminPanel tournament={active} save={(p)=> save(p)} />}
          {activeTab === 'blinds' && <BlindsManager tournament={active} save={(p)=> save(p)} />}
          {activeTab === 'ranking' && <RankingViewer tournament={active} />}
        </div>
      </div>
    </div>
  );
};

// --------- Exported Root that wraps provider ---------
const Root = () => (
  <TournamentsProvider>
    <PokerTournamentManagerApp />
  </TournamentsProvider>
);

export default Root;

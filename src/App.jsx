import React, { createContext, useContext, useEffect, useState } from 'react';
import { Play, Pause, RotateCcw, Trophy, Plus, Trash2, Clock, FileText, Settings, Tv } from 'lucide-react';

/*
  PokerTournamentManager.jsx
  - Tela TV em janela separada sincronizada via localStorage
  - Painel administrativo completo
  - Estrutura de blinds com tempo por nível
  - Intervalos não contam como níveis de aposta
*/

const uid = (prefix = '') => `${prefix}${Date.now()}_${Math.floor(Math.random() * 10000)}`;

const defaultBlindStructure = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, duration: 10, isBreak: false },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, duration: 10, isBreak: false },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 25, duration: 10, isBreak: false },
  { level: 4, smallBlind: 100, bigBlind: 200, ante: 25, duration: 10, isBreak: true, breakDuration: 10 },
  { level: 5, smallBlind: 150, bigBlind: 300, ante: 50, duration: 10, isBreak: false },
];

const saveKey = 'poker_tournaments_v1';
const tvStorageKey = 'current_tv_tournament';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

// --------- Context ---------
const TournamentsContext = createContext(null);
const useTournaments = () => useContext(TournamentsContext);

// --------- Provider ---------
const TournamentsProvider = ({ children }) => {
  const [tournaments, setTournaments] = useState([]);
  const [activeTournamentId, setActiveTournamentId] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(saveKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        setTournaments(parsed);
        if (parsed.length) setActiveTournamentId(parsed[0].id);
      }
    } catch (e) {
      console.warn('Não foi possível carregar os torneios guardados', e);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(saveKey, JSON.stringify(tournaments));
  }, [tournaments]);

  const createTournament = (name = 'Novo Torneio') => {
    const t = {
      id: uid('tr_'),
      name,
      players: [],
      blinds: [...defaultBlindStructure],
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
    setTournaments((prev) => [t, ...prev]);
    setActiveTournamentId(t.id);
  };

  const updateTournament = (id, patch) => {
    setTournaments((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const updated = { ...t, ...patch };
          // Mantém a janela pública da TV sincronizada
          localStorage.setItem(tvStorageKey, JSON.stringify(updated));
          return updated;
        }
        return t;
      })
    );
  };

  const removeTournament = (id) => {
    setTournaments((prev) => {
      const filtered = prev.filter((t) => t.id !== id);
      if (activeTournamentId === id) {
        setActiveTournamentId(filtered[0]?.id ?? null);
      }
      return filtered;
    });
  };

  return (
    <TournamentsContext.Provider
      value={{
        tournaments,
        setTournaments,
        activeTournamentId,
        setActiveTournamentId,
        createTournament,
        updateTournament,
        removeTournament,
      }}
    >
      {children}
    </TournamentsContext.Provider>
  );
};

// --------- Ranking Calculation ---------
function calculateRanking(actions, position, stageWeight) {
  if (position <= 0 || actions <= 0) return 0;
  return Math.pow((actions / position) * 100, 0.5) * stageWeight;
}

// --------- Components ---------

const TopBar = ({ title }) => {
  const { createTournament } = useTournaments();
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-2xl lg:text-3xl font-bold text-white flex items-center gap-3">
        <Trophy size={28} />
        {title || 'Gerenciador de Torneios'}
      </h1>
      <button
        type="button"
        className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white flex items-center gap-2 transition-colors"
        onClick={() => createTournament('Torneio ' + new Date().toLocaleDateString('pt-BR'))}
      >
        <Plus size={16} /> Novo Torneio
      </button>
    </div>
  );
};

const TournamentList = () => {
  const { tournaments, activeTournamentId, setActiveTournamentId, removeTournament } = useTournaments();
  return (
    <div className="w-full bg-gray-900 p-4 rounded-lg">
      <div className="text-gray-300 font-semibold mb-3">Torneios Salvos</div>
      <div className="space-y-2 max-h-80 overflow-y-auto">
        {tournaments.map((t) => (
          <div
            key={t.id}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setActiveTournamentId(t.id)}
            className={`p-3 rounded-md cursor-pointer flex items-center justify-between transition-colors ${
              t.id === activeTournamentId ? 'bg-green-700' : 'bg-gray-800 hover:bg-gray-700'
            }`}
            onClick={() => setActiveTournamentId(t.id)}
          >
            <span className="text-white font-medium truncate max-w-[180px]">{t.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeTournament(t.id);
              }}
              className="p-1.5 rounded bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="Remover Torneio"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        {tournaments.length === 0 && (
          <div className="text-gray-500 text-center py-4 text-sm">Nenhum torneio disponível.</div>
        )}
      </div>
    </div>
  );
};

// Tela TV (Modo Administrador)
const TVScreen = ({ tournament, update }) => {
  useEffect(() => {
    let interval = null;

    if (tournament.isRunning && tournament.timeLeft > 0) {
      interval = setInterval(() => {
        update({ timeLeft: tournament.timeLeft - 1 });
      }, 1000);
    } else if (tournament.isRunning && tournament.timeLeft === 0) {
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

  const currentLevel = tournament.blinds[tournament.currentLevelIndex] || {
    level: 0,
    smallBlind: 0,
    bigBlind: 0,
    ante: 0,
    isBreak: false,
    duration: 10,
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const totalPrizePool = tournament.players.reduce((sum, p) => {
    const actionsTotal = p.actions * tournament.buyInValue;
    const addonsTotal = p.addons * tournament.addonValue;
    const extraChipTotal = p.hasExtraChip ? tournament.extraChipValue : 0;
    const total = actionsTotal + addonsTotal + extraChipTotal;
    return sum + total * (1 - tournament.adminFeePercent / 100);
  }, 0);

  const openTVWindow = () => {
    localStorage.setItem(tvStorageKey, JSON.stringify(tournament));
    localStorage.setItem('current_tv_tournament_id', tournament.id);
    window.open('/tv', 'tv-screen', 'width=1280,height=720,menubar=no,toolbar=no,location=no');
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-white">Monitor de Controlo</h3>
        <button
          type="button"
          onClick={openTVWindow}
          className="px-5 py-2.5 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold flex items-center gap-2 transition-colors"
        >
          <Tv size={18} />
          Abrir Ecrã de Blinds (Janela Externa)
        </button>
      </div>

      <div className="bg-black rounded-lg p-6 text-center text-white shadow-lg border border-gray-700">
        <div className="text-6xl font-mono font-extrabold text-green-400 mb-4 tracking-wider">
          {formatTime(tournament.timeLeft)}
        </div>

        <div className="text-xl mb-2 font-bold">
          {currentLevel.isBreak ? (
            <span className="text-orange-400">⏸️ INTERVALO • Nível {currentLevel.level}</span>
          ) : (
            <span>Nível {currentLevel.level}</span>
          )}
        </div>

        {!currentLevel.isBreak ? (
          <div className="text-lg text-gray-300 mb-2">
            Blinds: {currentLevel.smallBlind} / {currentLevel.bigBlind}
            {currentLevel.ante > 0 ? ` • Ante: ${currentLevel.ante}` : ''}
          </div>
        ) : (
          <div className="text-lg text-orange-300 mb-2">
            Pausa de {currentLevel.breakDuration || 10} minutos
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 my-6 py-4 border-y border-gray-800">
          <div>
            <div className="text-sm text-gray-400">Prize Pool Líquido</div>
            <div className="text-2xl font-bold text-emerald-400">
              R$ {totalPrizePool.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Jogadores em Jogo</div>
            <div className="text-2xl font-bold">
              {tournament.players.filter((p) => p.active).length} / {tournament.players.length}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Duração do Nível</div>
            <div className="text-2xl font-bold">{currentLevel.duration || tournament.levelDuration} min</div>
          </div>
        </div>

        <div className="flex gap-3 justify-center mt-6 flex-wrap">
          <button
            type="button"
            onClick={() => update({ isRunning: !tournament.isRunning })}
            className={`px-6 py-3 rounded-lg font-bold flex items-center gap-2 transition-colors ${
              tournament.isRunning ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {tournament.isRunning ? <Pause size={18} /> : <Play size={18} />}
            {tournament.isRunning ? 'Pausar' : 'Iniciar'}
          </button>

          <button
            type="button"
            onClick={() =>
              update({
                isRunning: false,
                currentLevelIndex: 0,
                timeLeft: (tournament.blinds[0]?.duration || tournament.levelDuration) * 60,
              })
            }
            className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg flex items-center gap-2 transition-colors"
          >
            <RotateCcw size={18} /> Reiniciar
          </button>

          <button
            type="button"
            disabled={tournament.currentLevelIndex === 0}
            onClick={() => {
              const prevIdx = clamp(tournament.currentLevelIndex - 1, 0, tournament.blinds.length - 1);
              update({
                currentLevelIndex: prevIdx,
                timeLeft: (tournament.blinds[prevIdx]?.duration || tournament.levelDuration) * 60,
              });
            }}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            ← Nível Anterior
          </button>

          <button
            type="button"
            disabled={tournament.currentLevelIndex === tournament.blinds.length - 1}
            onClick={() => {
              const nextIdx = clamp(tournament.currentLevelIndex + 1, 0, tournament.blinds.length - 1);
              update({
                currentLevelIndex: nextIdx,
                timeLeft: (tournament.blinds[nextIdx]?.duration || tournament.levelDuration) * 60,
              });
            }}
            className="px-5 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            Próximo Nível →
          </button>
        </div>
      </div>

      <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className="text-gray-300 text-sm">
          <strong>Aviso:</strong> A janela externa de TV sincroniza através do armazenamento do navegador. Mantenha esta aba aberta para manter o temporizador e as contagens ativas.
        </div>
      </div>
    </div>
  );
};

// Admin Panel
const AdminPanel = ({ tournament, save }) => {
  const [newPlayerName, setNewPlayerName] = useState('');

  useEffect(() => {
    setNewPlayerName('');
  }, [tournament.id]);

  const addPlayer = () => {
    if (!newPlayerName.trim()) return;

    const isTimeChipEligible = tournament.timeChipEnabled && tournament.currentLevelIndex < 2;
    const timeChipBonus = isTimeChipEligible ? tournament.timeChipValue : 0;

    const p = {
      id: Date.now(),
      name: newPlayerName.trim(),
      actions: 1,
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
    save({ players: tournament.players.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  };

  const removePlayer = (id) => {
    save({ players: tournament.players.filter((p) => p.id !== id) });
  };

  const exportCSV = () => {
    if (!tournament.players.length) return;
    const rows = tournament.players.map((p) => ({
      id: p.id,
      name: p.name,
      actions: p.actions,
      rebuys: p.rebuys,
      addons: p.addons,
      hasTimeChip: p.hasTimeChip,
      hasExtraChip: p.hasExtraChip,
      chips: p.chips,
      position: p.position ?? '',
      prize: p.prize,
    }));
    const header = Object.keys(rows[0]).join(',') + '\n';
    const body = rows.map((r) => Object.values(r).join(',')).join('\n');
    const csv = '\uFEFF' + header + body;
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name.replace(/[^a-z0-9]/gi, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-6">
      <h3 className="text-xl font-bold text-white">Painel Administrativo</h3>

      {/* Parâmetros Gerais */}
      <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className="text-gray-300 font-semibold mb-3">Parâmetros do Torneio</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1">Duração Padrão (min)</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-black text-white border border-gray-700"
              value={tournament.levelDuration}
              onChange={(e) => {
                const val = clamp(Number(e.target.value) || 1, 1, 180);
                save({ levelDuration: val, timeLeft: val * 60 });
              }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Índice do Nível</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-black text-white border border-gray-700"
              value={tournament.currentLevelIndex}
              onChange={(e) => {
                const idx = clamp(Number(e.target.value) || 0, 0, tournament.blinds.length - 1);
                save({
                  currentLevelIndex: idx,
                  timeLeft: (tournament.blinds[idx]?.duration || tournament.levelDuration) * 60,
                });
              }}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Peso da Etapa</label>
            <input
              type="number"
              step="0.1"
              className="w-full p-2 rounded bg-black text-white border border-gray-700"
              value={tournament.stageWeight}
              onChange={(e) => save({ stageWeight: Number(e.target.value) || 1 })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Taxa Administrativa (%)</label>
            <input
              type="number"
              step="0.5"
              className="w-full p-2 rounded bg-black text-white border border-gray-700"
              value={tournament.adminFeePercent}
              onChange={(e) => save({ adminFeePercent: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* Fichas e Valores Financeiros */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-black/50 p-3 rounded border border-gray-800">
            <label className="block text-xs text-gray-400 mb-1">Buy-in (R$)</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-900 text-white mb-2"
              value={tournament.buyInValue}
              onChange={(e) => save({ buyInValue: Number(e.target.value) || 0 })}
            />
            <label className="block text-xs text-gray-400 mb-1">Fichas Buy-in</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-900 text-white"
              value={tournament.buyInChips}
              onChange={(e) => save({ buyInChips: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="bg-black/50 p-3 rounded border border-gray-800">
            <label className="block text-xs text-gray-400 mb-1">Rebuy (R$)</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-900 text-white mb-2"
              value={tournament.rebuyValue}
              onChange={(e) => save({ rebuyValue: Number(e.target.value) || 0 })}
            />
            <label className="block text-xs text-gray-400 mb-1">Fichas Rebuy</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-900 text-white"
              value={tournament.rebuyChips}
              onChange={(e) => save({ rebuyChips: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="bg-black/50 p-3 rounded border border-gray-800">
            <label className="block text-xs text-gray-400 mb-1">Add-on (R$)</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-900 text-white mb-2"
              value={tournament.addonValue}
              onChange={(e) => save({ addonValue: Number(e.target.value) || 0 })}
            />
            <label className="block text-xs text-gray-400 mb-1">Fichas Add-on</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-900 text-white"
              value={tournament.addonChips}
              onChange={(e) => save({ addonChips: Number(e.target.value) || 0 })}
            />
          </div>
        </div>

        {/* Time Chip e Extra Chip */}
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-black/40 p-3 rounded border border-gray-800">
            <label className="flex items-center gap-2 text-white mb-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={tournament.timeChipEnabled}
                onChange={(e) => save({ timeChipEnabled: e.target.checked })}
                className="w-4 h-4 accent-green-600"
              />
              Ativar Time Chip
            </label>
            <p className="text-xs text-gray-400 mb-2">Bónus para inscrições registadas até ao nível 2.</p>
            <label className="block text-xs text-gray-400 mb-1">Quantidade de Fichas</label>
            <input
              type="number"
              className="w-full p-2 rounded bg-gray-900 text-white disabled:opacity-40"
              value={tournament.timeChipValue}
              onChange={(e) => save({ timeChipValue: Number(e.target.value) || 0 })}
              disabled={!tournament.timeChipEnabled}
            />
          </div>

          <div className="bg-black/40 p-3 rounded border border-gray-800">
            <label className="flex items-center gap-2 text-white mb-2 font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={tournament.extraChipEnabled}
                onChange={(e) => save({ extraChipEnabled: e.target.checked })}
                className="w-4 h-4 accent-purple-600"
              />
              Ativar Extra Chip
            </label>
            <p className="text-xs text-gray-400 mb-2">Fichas adicionais adquiridas no registo inicial.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Valor (R$)</label>
                <input
                  type="number"
                  className="w-full p-2 rounded bg-gray-900 text-white disabled:opacity-40"
                  value={tournament.extraChipValue}
                  onChange={(e) => save({ extraChipValue: Number(e.target.value) || 0 })}
                  disabled={!tournament.extraChipEnabled}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Fichas Adicionais</label>
                <input
                  type="number"
                  className="w-full p-2 rounded bg-gray-900 text-white disabled:opacity-40"
                  value={tournament.extraChipAmount}
                  onChange={(e) => save({ extraChipAmount: Number(e.target.value) || 0 })}
                  disabled={!tournament.extraChipEnabled}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Adição e Gestão de Jogadores */}
      <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className="text-gray-300 font-semibold mb-2">Inscrição de Jogadores</div>
        <div className="flex gap-2">
          <input
            className="flex-1 p-2 rounded bg-black text-white border border-gray-700"
            placeholder="Nome do jogador"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addPlayer()}
          />
          <button
            type="button"
            onClick={addPlayer}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded text-white font-medium transition-colors"
          >
            Adicionar
          </button>
          <button
            type="button"
            onClick={exportCSV}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded text-white font-medium transition-colors"
          >
            Exportar CSV
          </button>
        </div>
      </div>

      {/* Lista de Jogadores */}
      <div className="bg-gray-900 p-4 rounded-lg border border-gray-800">
        <div className="text-gray-300 font-semibold mb-3">
          Lista de Jogadores ({tournament.players.length})
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {tournament.players.map((p) => {
            const totalPaid =
              p.actions * tournament.buyInValue +
              p.addons * tournament.addonValue +
              (p.hasExtraChip ? tournament.extraChipValue : 0);

            return (
              <div
                key={p.id}
                className={`flex flex-col md:flex-row items-start md:items-center justify-between p-3 rounded gap-3 transition-colors ${
                  p.active ? 'bg-black/60' : 'bg-red-950/40 opacity-70'
                }`}
              >
                <div>
                  <div className="text-white font-medium flex items-center gap-2">
                    {p.name}
                    {!p.active && <span className="text-xs bg-red-800 px-2 py-0.5 rounded">Eliminado</span>}
                    {p.hasTimeChip && <span className="text-xs bg-green-700 px-2 py-0.5 rounded">TIME</span>}
                    {p.hasExtraChip && <span className="text-xs bg-purple-700 px-2 py-0.5 rounded">EXTRA</span>}
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    Ações: {p.actions} (Buy-in + {p.rebuys} rebuys) • Addons: {p.addons} • Fichas:{' '}
                    {p.chips.toLocaleString()}
                  </div>
                  <div className="text-xs text-emerald-400 mt-0.5">
                    Valor total pago: R$ {totalPaid.toFixed(2)}
                  </div>
                </div>

                <div className="flex gap-2 items-center flex-wrap">
                  <input
                    type="number"
                    value={p.chips}
                    onChange={(e) => updatePlayer(p.id, { chips: Number(e.target.value) || 0 })}
                    className="w-24 p-1 rounded bg-gray-800 text-white text-sm border border-gray-700"
                    placeholder="Fichas"
                  />
                  {tournament.extraChipEnabled && !p.hasExtraChip && (
                    <button
                      type="button"
                      onClick={() =>
                        updatePlayer(p.id, {
                          hasExtraChip: true,
                          chips: p.chips + tournament.extraChipAmount,
                        })
                      }
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 rounded text-white text-xs whitespace-nowrap"
                    >
                      +Extra Chip
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      updatePlayer(p.id, {
                        rebuys: p.rebuys + 1,
                        actions: p.actions + 1,
                        chips: p.chips + tournament.rebuyChips,
                      })
                    }
                    className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 rounded text-white text-xs whitespace-nowrap"
                  >
                    +Rebuy
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      updatePlayer(p.id, {
                        addons: p.addons + 1,
                        chips: p.chips + tournament.addonChips,
                      })
                    }
                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 rounded text-white text-xs whitespace-nowrap"
                  >
                    +Add-on
                  </button>
                  {p.active ? (
                    <button
                      type="button"
                      onClick={() =>
                        updatePlayer(p.id, {
                          active: false,
                          position: tournament.players.filter((x) => x.active).length,
                        })
                      }
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 rounded text-white text-xs"
                    >
                      Eliminar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        updatePlayer(p.id, {
                          active: true,
                          position: null,
                        })
                      }
                      className="px-2.5 py-1 bg-gray-600 hover:bg-gray-500 rounded text-white text-xs"
                    >
                      Reativar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => removePlayer(p.id)}
                    className="p-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs"
                    title="Excluir Jogador"
                  >
                    <Trash2 size={14} />
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

// Blinds Manager
const BlindsManager = ({ tournament, save }) => {
  const [newLevelDuration, setNewLevelDuration] = useState(tournament.levelDuration);

  const addBlindLevel = () => {
    const lastLevel = tournament.blinds[tournament.blinds.length - 1];
    const newLevel = {
      level: (lastLevel?.level || 0) + 1,
      smallBlind: (lastLevel?.smallBlind || 25) * 2,
      bigBlind: (lastLevel?.bigBlind || 50) * 2,
      ante: lastLevel?.ante || 0,
      isBreak: false,
      duration: newLevelDuration,
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
      duration: 10,
    };
    save({ blinds: [...tournament.blinds, newBreak] });
  };

  const updateBlind = (index, patch) => {
    const updated = tournament.blinds.map((b, i) => (i === index ? { ...b, ...patch } : b));
    save({ blinds: updated });
  };

  const removeBlind = (index) => {
    save({ blinds: tournament.blinds.filter((_, i) => i !== index) });
  };

  const moveBlind = (index, direction) => {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= tournament.blinds.length) return;
    const newBlinds = [...tournament.blinds];
    [newBlinds[index], newBlinds[targetIndex]] = [newBlinds[targetIndex], newBlinds[index]];
    newBlinds.forEach((b, idx) => {
      b.level = idx + 1;
    });
    save({ blinds: newBlinds });
  };

  const updateAllDurations = () => {
    const updated = tournament.blinds.map((blind) => ({
      ...blind,
      duration: blind.isBreak ? blind.breakDuration || 10 : newLevelDuration,
    }));
    save({ blinds: updated, levelDuration: newLevelDuration });
  };

  const calculateTotalTime = () =>
    tournament.blinds.reduce(
      (acc, b) => acc + (b.duration || (b.isBreak ? b.breakDuration : tournament.levelDuration) || 0),
      0
    );

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-2xl font-bold text-white">Estrutura de Níveis & Blinds</h3>
        <div className="text-gray-300 text-sm">
          Tempo Previsto de Torneio: <span className="font-bold text-white">{calculateTotalTime()} min</span>
        </div>
      </div>

      <div className="bg-gray-900 p-4 rounded-lg flex items-center justify-between">
        <span className="text-gray-300 font-medium">Uniformizar duração de todos os níveis:</span>
        <div className="flex items-center gap-3">
          <input
            type="number"
            className="w-20 p-2 rounded bg-black text-white border border-gray-700"
            value={newLevelDuration}
            onChange={(e) => setNewLevelDuration(Math.max(1, Number(e.target.value) || 1))}
            min="1"
          />
          <button
            type="button"
            onClick={updateAllDurations}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm font-medium transition-colors"
          >
            Aplicar Globalmente
          </button>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={addBlindLevel}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
        >
          <Plus size={16} /> Adicionar Nível de Aposta
        </button>
        <button
          type="button"
          onClick={addBreak}
          className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg text-white font-medium flex items-center gap-2 transition-colors"
        >
          <Clock size={16} /> Adicionar Pausa / Intervalo
        </button>
      </div>

      <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
        {tournament.blinds.map((blind, index) => (
          <div
            key={blind.level || index}
            className={`p-4 rounded-lg border ${
              blind.isBreak ? 'bg-orange-950/40 border-orange-800' : 'bg-gray-900 border-gray-800'
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-white ${
                  blind.isBreak ? 'bg-orange-700' : 'bg-blue-700'
                }`}
              >
                {blind.level}
              </div>

              <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
                {blind.isBreak ? (
                  <>
                    <div className="col-span-2">
                      <span className="text-orange-400 font-semibold block">INTERVALO TÉCNICO</span>
                      <span className="text-xs text-gray-400">Pausa programada sem aumentos de blinds.</span>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Duração (min)</label>
                      <input
                        type="number"
                        className="w-full p-1.5 rounded bg-black text-white border border-gray-700"
                        value={blind.breakDuration || 10}
                        onChange={(e) => {
                          const val = Math.max(1, Number(e.target.value) || 10);
                          updateBlind(index, { breakDuration: val, duration: val });
                        }}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Small Blind</label>
                      <input
                        type="number"
                        className="w-full p-1.5 rounded bg-black text-white border border-gray-700"
                        value={blind.smallBlind}
                        onChange={(e) => updateBlind(index, { smallBlind: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Big Blind</label>
                      <input
                        type="number"
                        className="w-full p-1.5 rounded bg-black text-white border border-gray-700"
                        value={blind.bigBlind}
                        onChange={(e) => updateBlind(index, { bigBlind: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Ante</label>
                      <input
                        type="number"
                        className="w-full p-1.5 rounded bg-black text-white border border-gray-700"
                        value={blind.ante}
                        onChange={(e) => updateBlind(index, { ante: Number(e.target.value) || 0 })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Duração (min)</label>
                      <input
                        type="number"
                        className="w-full p-1.5 rounded bg-black text-white border border-gray-700"
                        value={blind.duration || tournament.levelDuration}
                        onChange={(e) =>
                          updateBlind(index, {
                            duration: Math.max(1, Number(e.target.value) || tournament.levelDuration),
                          })
                        }
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => moveBlind(index, -1)}
                    disabled={index === 0}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded text-white text-xs"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlind(index, 1)}
                    disabled={index === tournament.blinds.length - 1}
                    className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-30 rounded text-white text-xs"
                  >
                    ↓
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => removeBlind(index)}
                  className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-white text-xs"
                >
                  Remover
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Visualizador de Ranking
const RankingViewer = ({ tournament }) => {
  const withScores = tournament.players
    .map((p) => {
      const position = p.position ?? (p.active ? tournament.players.length : tournament.players.length);
      const score = calculateRanking(p.actions, position, tournament.stageWeight);
      return { ...p, score, finalPosition: position };
    })
    .sort((a, b) => b.score - a.score);

  return (
    <div className="bg-gray-800 p-6 rounded-lg space-y-4">
      <div>
        <h3 className="text-xl font-bold text-white">Classificação da Etapa</h3>
        <p className="text-xs text-gray-400">
          Fórmula Oficial: ((Ações ÷ Posição) × 100)^0.5 × Peso da Etapa
        </p>
      </div>

      <div className="space-y-2">
        {withScores.map((p, i) => (
          <div
            key={p.id}
            className={`p-3 rounded-lg flex items-center justify-between border ${
              i === 0
                ? 'bg-amber-500/20 border-amber-500 text-white'
                : i === 1
                ? 'bg-slate-400/20 border-slate-400 text-white'
                : i === 2
                ? 'bg-amber-800/20 border-amber-800 text-white'
                : 'bg-gray-900 border-gray-800 text-white'
            }`}
          >
            <div className="flex gap-4 items-center">
              <span className="font-extrabold text-lg w-6">{i + 1}º</span>
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-xs text-gray-400">
                  Posição no Torneio: {p.finalPosition}º • Ações: {p.actions}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="font-mono font-bold text-lg text-emerald-400">{p.score.toFixed(2)}</div>
              <div className="text-xs text-gray-400">pontos</div>
            </div>
          </div>
        ))}

        {withScores.length === 0 && (
          <div className="text-gray-500 text-center py-6">Nenhum jogador pontuável registado.</div>
        )}
      </div>
    </div>
  );
};

// Componente Principal
const PokerTournamentManagerApp = () => {
  const { tournaments, activeTournamentId, updateTournament } = useTournaments();
  const [activeTab, setActiveTab] = useState('tv');

  const active = tournaments.find((t) => t.id === activeTournamentId);

  const save = (patch) => {
    if (!active) return;
    updateTournament(active.id, patch);
  };

  if (!active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 p-6">
        <div className="max-w-md w-full bg-gray-900 p-8 rounded-xl border border-gray-800 text-center text-white">
          <Trophy size={48} className="mx-auto text-amber-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sem Torneios Ativos</h2>
          <p className="text-sm text-gray-400 mb-6">
            Crie um novo torneio para configurar os blinds, jogadores e o ecrã de transmissão.
          </p>
          <TopBar />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 p-6">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6">
        <div>
          <TopBar title={active.name} />
          <TournamentList />
        </div>

        <div>
          <div className="flex gap-2 mb-4 bg-gray-900 p-1.5 rounded-lg border border-gray-800">
            <button
              type="button"
              onClick={() => setActiveTab('tv')}
              className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'tv' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Clock size={16} /> Monitor TV
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'admin' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Settings size={16} /> Gestão
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('blinds')}
              className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'blinds' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <FileText size={16} /> Blinds
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ranking')}
              className={`flex-1 py-2 rounded flex items-center justify-center gap-2 text-sm font-medium transition-colors ${
                activeTab === 'ranking' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Trophy size={16} /> Ranking
            </button>
          </div>

          {activeTab === 'tv' && <TVScreen tournament={active} update={save} />}
          {activeTab === 'admin' && <AdminPanel tournament={active} save={save} />}
          {activeTab === 'blinds' && <BlindsManager tournament={active} save={save} />}
          {activeTab === 'ranking' && <RankingViewer tournament={active} />}
        </div>
      </div>
    </div>
  );
};

export default function Root() {
  return (
    <TournamentsProvider>
      <PokerTournamentManagerApp />
    </TournamentsProvider>
  );
}

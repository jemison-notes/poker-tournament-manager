import React, { useState, useEffect } from 'react';
import TVScreenPublic from './TVScreenPublic';

const TVRoute = () => {
  const [tournament, setTournament] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Busca o torneio do localStorage
    const tournamentData = localStorage.getItem('current_tv_tournament');
    const tournamentId = localStorage.getItem('current_tv_tournament_id');
    
    if (tournamentData) {
      try {
        setTournament(JSON.parse(tournamentData));
      } catch (e) {
        console.error('Erro ao carregar torneio:', e);
      }
    }
    
    // Atualiza a cada 2 segundos
    const interval = setInterval(() => {
      const updatedData = localStorage.getItem('current_tv_tournament');
      if (updatedData) {
        try {
          setTournament(JSON.parse(updatedData));
        } catch (e) {
          console.error('Erro ao atualizar torneio:', e);
        }
      }
    }, 2000);
    
    setLoading(false);
    
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl">Carregando...</div>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white text-2xl text-center">
          Nenhum torneio ativo<br />
          <span className="text-gray-400 text-lg">Abra a TV pelo painel administrativo</span>
        </div>
      </div>
    );
  }

  return <TVScreenPublic tournament={tournament} />;
};

export default TVRoute;

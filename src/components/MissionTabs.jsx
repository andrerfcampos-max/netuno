import React from 'react';
import { X, Target, Plus } from 'lucide-react';

const MissionTabs = ({ missions, activeMissionId, openMissionIds, onTabClick, onCloseTab, onNewMission }) => {
  // Pega apenas as missões que estão abertas (openMissionIds)
  const openMissions = openMissionIds
    .map(id => missions.find(m => m.id === id))
    .filter(Boolean); // Filtra caso alguma não exista

  if (openMissions.length === 0) return null;

  return (
    <div className="flex items-center w-full bg-slate-900 border-b border-slate-700 px-2 pt-2 overflow-x-auto overflow-y-hidden" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
      <style>{`
        ::-webkit-scrollbar { display: none; }
      `}</style>
      
      <div className="flex gap-1 items-end min-w-max">
        {openMissions.map((mission) => {
          const isActive = mission.id === activeMissionId;
          const isComplete = mission.selectedIds.length > 0 && mission.selectedIds.length === mission.completedIds.length;
          
          return (
            <div 
              key={mission.id}
              onClick={() => onTabClick(mission.id)}
              className={`flex items-center gap-2 px-4 py-2 border border-b-0 rounded-t-lg cursor-pointer transition-all select-none
                ${isActive 
                  ? 'bg-slate-800 border-slate-600 text-emerald-400 font-bold z-10 shadow-[0_-2px_10px_rgba(0,0,0,0.3)]' 
                  : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:text-slate-300'
                }
              `}
              style={isActive ? { marginBottom: '-1px' } : {}}
            >
              <Target size={14} className={isComplete ? "text-slate-500" : (isActive ? "text-emerald-400 animate-pulse" : "")} />
              <span className={`text-sm truncate max-w-[150px] ${isComplete ? 'line-through opacity-70' : ''}`}>
                {mission.name}
              </span>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(mission.id);
                }}
                className={`p-0.5 rounded-full hover:bg-slate-700 ${isActive ? 'text-slate-400 hover:text-red-400' : 'text-slate-600'}`}
                title="Fechar aba"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}

        <button 
          onClick={onNewMission}
          className="flex items-center justify-center p-2 mb-1 ml-1 text-slate-500 hover:bg-slate-800 hover:text-emerald-400 rounded-lg transition-colors"
          title="Nova Missão"
        >
          <Plus size={18} />
        </button>
      </div>
    </div>
  );
};

export default MissionTabs;

import React, { useState, useEffect } from 'react';
import { X, UserCog, Shield, Save } from 'lucide-react';
import { loadRbacUsers, saveRbacUsers } from '../utils/storage';

const UserManagerModal = ({ onClose }) => {
  const [users, setUsers] = useState(loadRbacUsers());

  const [editingMatricula, setEditingMatricula] = useState(null);
  const [tempRole, setTempRole] = useState('');

  const handleRoleChange = (matricula, newRole) => {
    const updatedUsers = users.map(u => u.matricula === matricula ? { ...u, role: newRole } : u);
    setUsers(updatedUsers);
    saveRbacUsers(updatedUsers);
    setEditingMatricula(null);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-2xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700/80 text-slate-100">
        
        {/* CABEÇALHO PADRONIZADO */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer"
            >
              ← Voltar
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-md shadow-red-950/50 shrink-0">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                Painel Administrativo (RBAC)
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Gestão de papéis de usuários, permissões e segurança operacional
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            title="Fechar"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[70vh]">
          <p className="text-sm text-slate-400 mb-4">
            Como Administrador, você pode alterar os papéis de cada usuário no sistema. Os papéis determinam as permissões globais.
          </p>

          <div className="flex flex-col gap-3">
            {users.map(u => (
              <div key={u.matricula} className="bg-slate-700/50 p-4 rounded-lg flex flex-col sm:flex-row gap-4 justify-between items-center border border-slate-600 hover:border-slate-500 transition-colors">
                
                <div className="flex items-center gap-4 w-full sm:w-auto">
                  <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-slate-300 font-bold border border-slate-600">
                    <UserCog size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-200">{u.nome}</h3>
                    <p className="text-xs text-slate-400 font-mono">Matrícula: {u.matricula}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  {editingMatricula === u.matricula ? (
                    <>
                      <select 
                        value={tempRole}
                        onChange={(e) => setTempRole(e.target.value)}
                        className="bg-slate-900 text-slate-200 text-sm rounded border border-slate-600 px-3 py-2"
                      >
                        <option value="vistoriador">Vistoriador</option>
                        <option value="gestor">Gestor</option>
                        <option value="admin">Administrador</option>
                      </select>
                      <button 
                        onClick={() => handleRoleChange(u.matricula, tempRole)}
                        className="p-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors"
                      >
                        <Save size={18} />
                      </button>
                      <button 
                        onClick={() => setEditingMatricula(null)}
                        className="p-2 bg-slate-600 hover:bg-slate-500 text-white rounded transition-colors"
                      >
                        <X size={18} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className={`px-3 py-1 rounded text-xs font-bold uppercase ${
                        u.role === 'admin' ? 'bg-red-900/50 text-red-400 border border-red-800' :
                        u.role === 'gestor' ? 'bg-amber-900/50 text-amber-400 border border-amber-800' :
                        'bg-blue-900/50 text-blue-400 border border-blue-800'
                      }`}>
                        {u.role}
                      </span>
                      {u.matricula !== 'admin' && (
                        <button 
                          onClick={() => {
                            setTempRole(u.role);
                            setEditingMatricula(u.matricula);
                          }}
                          className="ml-2 px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-bold rounded transition-colors"
                        >
                          Alterar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>

        </div>

      </div>
    </div>
  );
};

export default UserManagerModal;

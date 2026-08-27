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
    <div className="fixed inset-0 z-[200] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-800 w-full max-w-2xl rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-600">
        
        <div className="flex justify-between items-center p-4 border-b border-slate-700 bg-slate-900">
          <div className="flex items-center gap-3">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-600 rounded font-semibold transition-colors"
            >
              ← Voltar
            </button>
            <h2 className="text-xl font-bold text-red-400 flex items-center gap-2">
              <Shield size={24} />
              Gerenciamento de Acesso (RBAC)
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-red-400 transition-colors">
            <X size={24} />
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

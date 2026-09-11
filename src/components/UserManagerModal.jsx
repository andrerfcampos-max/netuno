import React, { useState } from 'react';
import { X, UserCog, Shield, UserPlus, Trash2, Check, AlertCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import { loadRbacUsers, saveRbacUsers } from '../utils/storage';

const UserManagerModal = ({ onClose }) => {
  const [users, setUsers] = useState(() => loadRbacUsers());
  const [newMatricula, setNewMatricula] = useState('');
  const [newNome, setNewNome] = useState('');
  const [newRole, setNewRole] = useState('gestor');

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'gestor': return 'Gestor';
      case 'vistoriador': return 'Vistoriador';
      default: return role;
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'admin':
        return 'bg-red-950/80 text-red-300 border-red-500/60';
      case 'gestor':
        return 'bg-amber-950/80 text-amber-300 border-amber-500/60';
      case 'vistoriador':
        return 'bg-sky-950/80 text-sky-300 border-sky-500/60';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-600';
    }
  };

  // Adicionar ou atualizar militar por matrícula
  const handleAddUser = (e) => {
    e.preventDefault();
    const cleanMat = newMatricula.trim();
    if (!cleanMat) {
      toast.warn('Informe o número da matrícula do militar.');
      return;
    }

    const cleanNome = newNome.trim() || `Militar ${cleanMat}`;
    const existsIdx = users.findIndex(u => String(u.matricula).toLowerCase() === cleanMat.toLowerCase());

    let updatedUsers = [];
    if (existsIdx >= 0) {
      // Já existe, atualiza os dados
      updatedUsers = users.map((u, idx) => 
        idx === existsIdx ? { ...u, nome: cleanNome, role: newRole } : u
      );
      toast.success(`Militar matrícula ${cleanMat} atualizado com perfil "${getRoleLabel(newRole)}"!`);
    } else {
      // Novo registro
      const newUser = {
        matricula: cleanMat,
        nome: cleanNome,
        role: newRole
      };
      updatedUsers = [newUser, ...users];
      toast.success(`Militar matrícula ${cleanMat} adicionado como "${getRoleLabel(newRole)}"!`);
    }

    setUsers(updatedUsers);
    saveRbacUsers(updatedUsers);
    setNewMatricula('');
    setNewNome('');
    setNewRole('gestor');
  };

  // Alterar papel direto na lista
  const handleRoleChange = (matricula, targetRole) => {
    // Trava de segurança: impede rebaixar a matrícula 1997400 se for o único admin
    if (String(matricula).toLowerCase() === '1997400' && targetRole !== 'admin') {
      const adminCount = users.filter(u => u.role === 'admin').length;
      if (adminCount <= 1) {
        toast.error('A matrícula 1997400 é o administrador mestre inicial e não pode ser rebaixada enquanto for o único administrador.');
        return;
      }
    }

    const updatedUsers = users.map(u => 
      String(u.matricula).toLowerCase() === String(matricula).toLowerCase() 
        ? { ...u, role: targetRole } 
        : u
    );
    setUsers(updatedUsers);
    saveRbacUsers(updatedUsers);
    toast.success(`Nível de acesso do militar ${matricula} alterado para "${getRoleLabel(targetRole)}"!`);
  };

  // Remover militar cadastrado (reverte para o padrão vistoriador)
  const handleRemoveUser = (u) => {
    if (String(u.matricula).toLowerCase() === '1997400') {
      toast.error('A matrícula 1997400 é o administrador inicial do sistema e não pode ser removida.');
      return;
    }

    if (u.role === 'admin') {
      const adminCount = users.filter(usr => usr.role === 'admin').length;
      if (adminCount <= 1) {
        toast.error('Não é possível remover o único administrador do sistema.');
        return;
      }
    }

    if (window.confirm(`Deseja remover as permissões especiais do militar ${u.nome} (Matrícula: ${u.matricula})? Ele retornará ao perfil padrão de Vistoriador.`)) {
      const updatedUsers = users.filter(usr => String(usr.matricula).toLowerCase() !== String(u.matricula).toLowerCase());
      setUsers(updatedUsers);
      saveRbacUsers(updatedUsers);
      toast.info(`Militar ${u.matricula} retornou ao nível padrão de Vistoriador.`);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-2 sm:p-4 animate-fadeIn">
      <div className="bg-slate-900 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-700/80 text-slate-100 max-h-[92vh]">
        
        {/* CABEÇALHO PADRONIZADO */}
        <div className="px-4 py-3 sm:px-6 sm:py-3.5 bg-slate-900 border-b border-slate-700/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button 
              type="button"
              onClick={onClose} 
              className="text-xs px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 rounded-lg font-semibold transition-colors flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
            >
              ← Voltar
            </button>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-600 to-rose-700 flex items-center justify-center text-white shadow-md shadow-red-950/50 shrink-0">
              <Shield size={20} />
            </div>
            <div className="min-w-0">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight truncate">
                Níveis de Acesso dos Militares
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                Defina quem é Administrador, Gestor ou Vistoriador por matrícula militar
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

        <div className="p-4 sm:p-5 overflow-y-auto custom-scrollbar flex flex-col gap-4">
          
          {/* CARD EXPLICATIVO DE REGRAS DE ACESSO */}
          <div className="bg-slate-800/60 border border-slate-700/80 rounded-xl p-3.5 flex items-start gap-3 text-xs leading-relaxed text-slate-300">
            <AlertCircle size={18} className="text-cyan-400 shrink-0 mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="font-bold text-white">Regra de Acesso Operacional:</span>
              <span>
                Apenas o <strong>Administrador</strong> tem autorização para definir os perfis de acesso de cada militar. 
                A matrícula inicial <strong>1997400</strong> é o administrador mestre do sistema.
              </span>
              <span className="text-slate-400 text-[11px]">
                💡 <em>Por padrão de fábrica, todos os militares que acessarem o sistema sem cadastro prévio entram automaticamente como <strong>Vistoriadores</strong>.</em>
              </span>
            </div>
          </div>

          {/* FORMULÁRIO DE CADASTRO / ATRIBUIÇÃO DE PERFIL */}
          <form onSubmit={handleAddUser} className="bg-slate-850 border border-slate-700 rounded-xl p-3.5 sm:p-4 flex flex-col gap-3">
            <h3 className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5 uppercase tracking-wider text-slate-300">
              <UserPlus size={16} className="text-emerald-400" />
              Atribuir Nível de Acesso por Matrícula
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5">
              {/* Matrícula */}
              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400">Matrícula Militar *</label>
                <input 
                  type="text"
                  value={newMatricula}
                  onChange={(e) => setNewMatricula(e.target.value)}
                  placeholder="Ex: 1997400"
                  maxLength={20}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-mono focus:outline-none focus:border-emerald-500"
                  required
                />
              </div>

              {/* Nome / Posto / Graduação (Opcional) */}
              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400">Nome / Posto / Graduação</label>
                <input 
                  type="text"
                  value={newNome}
                  onChange={(e) => setNewNome(e.target.value)}
                  placeholder="Ex: Sgt Roméro ou Cap Costa"
                  maxLength={50}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Nível de Acesso */}
              <div className="sm:col-span-4 flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-slate-400">Nível de Acesso *</label>
                <select 
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-medium focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="gestor">📋 Gestor</option>
                  <option value="admin">🛡️ Administrador</option>
                  <option value="vistoriador">🔍 Vistoriador</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button 
                type="submit"
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-md shadow-emerald-950/60 flex items-center gap-1.5"
              >
                <Check size={15} />
                <span>Salvar Nível de Acesso</span>
              </button>
            </div>
          </form>

          {/* LISTA DE MILITARES COM PERFIS CONFIGURADOS */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Militares com Permissões Configuradas ({users.length})
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {users.map(u => {
                const isMasterAdmin = String(u.matricula).toLowerCase() === '1997400';
                return (
                  <div 
                    key={u.matricula} 
                    className="bg-slate-800/80 p-3 sm:p-3.5 rounded-xl flex flex-col sm:flex-row gap-3 justify-between items-center border border-slate-700/80 hover:border-slate-600 transition-colors"
                  >
                    {/* Dados do Militar */}
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                      <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-slate-300 font-bold border border-slate-700 shrink-0">
                        <UserCog size={20} className={u.role === 'admin' ? 'text-red-400' : u.role === 'gestor' ? 'text-amber-400' : 'text-sky-400'} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-white text-sm truncate">{u.nome}</h4>
                          {isMasterAdmin && (
                            <span className="bg-red-950/80 border border-red-500/60 text-red-300 text-[10px] font-mono px-1.5 py-0.2 rounded font-bold">
                              Admin Inicial
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 font-mono">Matrícula: <strong className="text-slate-200">{u.matricula}</strong></p>
                      </div>
                    </div>

                    {/* Seletor do Nível de Acesso e Exclusão */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {/* Badge e Seletor de Perfil */}
                      <select 
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.matricula, e.target.value)}
                        className={`text-xs font-bold rounded-lg border px-3 py-1.5 cursor-pointer bg-slate-900 focus:outline-none transition-colors ${getRoleBadgeStyle(u.role)}`}
                      >
                        <option value="admin" className="bg-slate-900 text-red-400 font-bold">🛡️ Administrador</option>
                        <option value="gestor" className="bg-slate-900 text-amber-400 font-bold">📋 Gestor</option>
                        <option value="vistoriador" className="bg-slate-900 text-sky-400 font-bold">🔍 Vistoriador</option>
                      </select>

                      {/* Botão Remover (exceto admin inicial) */}
                      {!isMasterAdmin && (
                        <button 
                          type="button"
                          onClick={() => handleRemoveUser(u)}
                          title="Remover perfil especial (retorna a Vistoriador padrão)"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition-colors cursor-pointer active:scale-90"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>
    </div>
  );
};

export default UserManagerModal;

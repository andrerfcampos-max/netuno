import { createClient } from '@supabase/supabase-js';

// Chaves padrão do projeto Supabase Netuno
const DEFAULT_SUPABASE_URL = 'https://ixxgleaxmiffflsqaapc.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_nfAn0i2h5mK-ku2LMuXTYQ_xmdWjNZm';

const ENV_SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

let supabaseInstance = null;
let currentUrl = '';
let currentKey = '';

/**
 * Obtém a URL e Key ativas (prioriza localStorage para permitir configuração dinâmica pelo usuário)
 */
export const getActiveCloudConfig = () => {
  try {
    const customUrl = localStorage.getItem('netuno_supabase_url');
    const customKey = localStorage.getItem('netuno_supabase_key');
    const url = (customUrl && customUrl.trim()) || ENV_SUPABASE_URL;
    const key = (customKey && customKey.trim()) || ENV_SUPABASE_ANON_KEY;
    return { url, key, isCustom: Boolean(customUrl && customKey) };
  } catch {
    return { url: ENV_SUPABASE_URL, key: ENV_SUPABASE_ANON_KEY, isCustom: false };
  }
};

/**
 * Retorna se o banco em nuvem está configurado
 */
export const isCloudConfigured = () => {
  const { url, key } = getActiveCloudConfig();
  return Boolean(url && key && url.startsWith('http'));
};

/**
 * Obtém ou inicializa a instância singleton do cliente Supabase
 */
export const getSupabaseClient = () => {
  const { url, key } = getActiveCloudConfig();
  
  if (!url || !key) return null;

  if (!supabaseInstance || currentUrl !== url || currentKey !== key) {
    currentUrl = url;
    currentKey = key;
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
  }

  return supabaseInstance;
};

/**
 * Salva credenciais do Supabase no localStorage
 */
export const saveCloudConfig = (url, key) => {
  if (url && key) {
    localStorage.setItem('netuno_supabase_url', url.trim());
    localStorage.setItem('netuno_supabase_key', key.trim());
  } else {
    localStorage.removeItem('netuno_supabase_url');
    localStorage.removeItem('netuno_supabase_key');
  }
  supabaseInstance = null; // força reinicialização
};

/**
 * Testa a conexão com o Supabase
 */
export const testCloudConnection = async () => {
  try {
    const client = getSupabaseClient();
    if (!client) {
      return { success: false, message: 'Credenciais do Supabase não configuradas.' };
    }
    const { error } = await client.from('netuno_missions').select('id').limit(1);
    if (error) {
      return { success: false, message: `Erro ao conectar: ${error.message}` };
    }
    return { success: true, message: 'Conexão com o Supabase estabelecida com sucesso!' };
  } catch (err) {
    return { success: false, message: `Falha na conexão: ${err.message}` };
  }
};

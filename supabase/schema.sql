-- ==============================================================================
-- NETUNO - SCHEMA DO BANCO DE DADOS EM NUVEM (SUPABASE / POSTGRESQL)
-- Execute este script no SQL Editor do seu projeto Supabase para habilitar
-- sincronização multi-dispositivo em tempo real (Mobile <-> Desktop).
-- ==============================================================================

-- 1. TABELA DE MISSÕES E ROTAS
CREATE TABLE IF NOT EXISTS netuno_missions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_folder_id TEXT,
  selected_ids JSONB DEFAULT '[]'::jsonb,
  completed_ids JSONB DEFAULT '[]'::jsonb,
  is_draft BOOLEAN DEFAULT false,
  created_by TEXT,
  created_by_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. TABELA DE PASTAS DE QUARTÉIS
CREATE TABLE IF NOT EXISTS netuno_folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  parent_folder_id TEXT,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. TABELA DE VISTORIAS TÉCNICAS REALIZADAS
CREATE TABLE IF NOT EXISTS netuno_inspections (
  id TEXT PRIMARY KEY,
  cod_hidrante TEXT,
  nom_hidrante TEXT,
  flg_ativo BOOLEAN NOT NULL DEFAULT true,
  problemas_hidrante TEXT,
  nom_vistoriador TEXT,
  num_matricula TEXT,
  data_hora_vistoria TIMESTAMPTZ DEFAULT now(),
  observacao TEXT,
  foto_url TEXT,
  latitude NUMERIC(10,6),
  longitude NUMERIC(10,6),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. TABELA DE MUTAÇÕES DA BASE DE HIDRANTES (Edições, Cadastros e Exclusões)
CREATE TABLE IF NOT EXISTS netuno_hydrant_mutations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL, -- 'update', 'add', 'delete'
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- POLÍTICAS DE ACESSO LIVRE PARA CLIENTES ANÔNIMOS (RLS PUBLIC READ/WRITE)
-- ==============================================================================
ALTER TABLE netuno_missions ENABLE ROW LEVEL SECURITY;
ALTER TABLE netuno_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE netuno_inspections ENABLE ROW LEVEL SECURITY;
ALTER TABLE netuno_hydrant_mutations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Acesso público total a missões" ON netuno_missions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público total a pastas" ON netuno_folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público total a vistorias" ON netuno_inspections FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso público total a mutações de hidrantes" ON netuno_hydrant_mutations FOR ALL USING (true) WITH CHECK (true);

-- Habilitar Realtime para as tabelas
ALTER PUBLICATION supabase_realtime ADD TABLE netuno_missions;
ALTER PUBLICATION supabase_realtime ADD TABLE netuno_folders;
ALTER PUBLICATION supabase_realtime ADD TABLE netuno_inspections;
ALTER PUBLICATION supabase_realtime ADD TABLE netuno_hydrant_mutations;

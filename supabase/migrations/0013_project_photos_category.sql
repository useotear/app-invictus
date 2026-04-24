-- Categoria da foto de instalação (checklist obrigatório pra concluir a fase 9).
alter table project_photos
  add column if not exists category text;

create index if not exists project_photos_project_phase_category_idx
  on project_photos(project_id, phase_number, category);

-- Bucket separado pras fotos. Público? NÃO — URLs assinadas via backend.
-- Criar manualmente no Supabase Dashboard se ainda não existir:
--   Storage → New bucket → name: project-photos, public: OFF

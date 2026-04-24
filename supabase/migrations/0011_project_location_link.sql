-- Link opcional da localização (Google Maps, Waze etc) pra equipe de instalação.
alter table projects
  add column if not exists location_link text;

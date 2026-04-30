-- 0023: campo livre pra descrição dos materiais do kit
-- Ex: "40 módulos, Inversor GoodWe 4 MPPT"
alter table projects
  add column if not exists materials text;

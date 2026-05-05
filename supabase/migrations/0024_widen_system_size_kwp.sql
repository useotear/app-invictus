-- 0024: aumenta a precisão de system_size_kwp
-- Antes: numeric(6,2) → max 9999.99 kWp (sistemas grandes estouravam)
-- Depois: numeric(10,2) → max 99.999.999,99 kWp
alter table projects
  alter column system_size_kwp type numeric(10,2);

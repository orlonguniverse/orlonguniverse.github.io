-- ORLONG STAGE 8D.4C — PERMANENT CATEGORY-LEVEL GAME TEMPLATES
-- Run after stage-8d4-special-editions-and-game-data.sql.
-- A category owns one canonical game schema. Every card in that category receives the same data.

create table if not exists public.eden_card_category_game_templates (
 category_id text primary key,
 game_attributes jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null,
 constraint eden_category_game_template_object check(jsonb_typeof(game_attributes)='object')
);
alter table public.eden_card_category_game_templates enable row level security;
revoke all on public.eden_card_category_game_templates from anon,authenticated;

create or replace function public.get_moderator_card_category_game_templates()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('category_id',t.category_id,'game_attributes',t.game_attributes) order by t.category_id) from public.eden_card_category_game_templates t),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_card_category_game_template(p_category_id text,p_game_attributes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_count integer;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_category_id is null or not exists(select 1 from public.card_catalogue where category_id=p_category_id) then raise exception 'Choose a valid card category'; end if;
 if p_game_attributes is null or jsonb_typeof(p_game_attributes)<>'object' then raise exception 'Category game template must be a JSON object'; end if;
 if (select count(*) from jsonb_object_keys(p_game_attributes))>60 then raise exception 'A category template may contain up to 60 attributes'; end if;
 insert into public.eden_card_category_game_templates(category_id,game_attributes,updated_at,updated_by)
 values(p_category_id,p_game_attributes,now(),auth.uid())
 on conflict(category_id) do update set game_attributes=excluded.game_attributes,updated_at=now(),updated_by=auth.uid();
 insert into public.eden_card_release_metadata(card_id,game_attributes,updated_at)
 select c.card_id,p_game_attributes,now() from public.card_catalogue c where c.category_id=p_category_id
 on conflict(card_id) do update set game_attributes=excluded.game_attributes,updated_at=now();
 get diagnostics v_count = row_count;
 return jsonb_build_object('success',true,'category_id',p_category_id,'updated_cards',v_count);
end;
$$;

create or replace function public.apply_eden_card_category_game_template()
returns trigger language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_template jsonb;
begin
 select game_attributes into v_template from public.eden_card_category_game_templates where category_id=new.category_id;
 if v_template is not null then
  insert into public.eden_card_release_metadata(card_id,game_attributes,updated_at)
  values(new.card_id,v_template,now())
  on conflict(card_id) do update set game_attributes=excluded.game_attributes,updated_at=now();
 end if;
 return new;
end;
$$;

drop trigger if exists apply_eden_card_category_game_template on public.card_catalogue;
create trigger apply_eden_card_category_game_template
after insert or update of category_id on public.card_catalogue
for each row execute function public.apply_eden_card_category_game_template();

grant execute on function public.get_moderator_card_category_game_templates() to authenticated;
grant execute on function public.save_moderator_card_category_game_template(text,jsonb) to authenticated;

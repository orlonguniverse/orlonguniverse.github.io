-- ORLONG STAGE 8D.4D — FIX EMPTY CATEGORY TEMPLATE SEEDING
-- Run this corrective migration if Stage 8D.4C was already applied.
-- A category can legitimately have zero cards. Templates must be saveable before the first card is created.

create or replace function public.save_moderator_card_category_game_template(p_category_id text,p_game_attributes jsonb)
returns jsonb language plpgsql security definer set search_path=public,pg_temp
as $$
declare v_count integer;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_category_id is null or length(trim(p_category_id))=0 then
  raise exception 'Choose a category before saving its game template';
 end if;
 if p_game_attributes is null or jsonb_typeof(p_game_attributes)<>'object' then
  raise exception 'Category game template must be a JSON object';
 end if;
 if (select count(*) from jsonb_object_keys(p_game_attributes))>60 then
  raise exception 'A category template may contain up to 60 attributes';
 end if;

 insert into public.eden_card_category_game_templates(category_id,game_attributes,updated_at,updated_by)
 values(p_category_id,p_game_attributes,now(),auth.uid())
 on conflict(category_id) do update
 set game_attributes=excluded.game_attributes,updated_at=now(),updated_by=auth.uid();

 insert into public.eden_card_release_metadata(card_id,game_attributes,updated_at)
 select c.card_id,p_game_attributes,now()
 from public.card_catalogue c
 where c.category_id=p_category_id
 on conflict(card_id) do update
 set game_attributes=excluded.game_attributes,updated_at=now();
 get diagnostics v_count = row_count;
 return jsonb_build_object('success',true,'category_id',p_category_id,'updated_cards',v_count);
end;
$$;

grant execute on function public.save_moderator_card_category_game_template(text,jsonb) to authenticated;

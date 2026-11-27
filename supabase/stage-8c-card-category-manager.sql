-- ============================================================
-- ORLONG STAGE 8C.3 — MODERATOR-MANAGED CARD CATEGORIES
-- Add, edit, reorder, deactivate and safely remove categories.
-- Category codes remain stable once cards have been numbered.
-- ============================================================

create or replace function public.get_moderator_card_categories()
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',c.category_id,'label',c.label,'code',c.category_code,
  'description',coalesce(c.description,''),'sortOrder',c.sort_order,
  'active',c.is_active,
  'cardCount',(select count(*) from public.card_catalogue cc where cc.category_id=c.category_id)
 ) order by c.sort_order,c.label) from public.card_categories c),'[]'::jsonb);
end;
$$;

create or replace function public.save_moderator_card_category(
 p_category_id text,
 p_label text,
 p_code text,
 p_description text default null,
 p_sort_order integer default 0,
 p_is_active boolean default true
)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_existing_code text; v_card_count integer;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if p_category_id is null or p_category_id !~ '^[a-z0-9-]{1,40}$' then raise exception 'Category ID must use lowercase letters, numbers and hyphens'; end if;
 if nullif(trim(p_label),'') is null or char_length(trim(p_label))>80 then raise exception 'Enter a category label of 1–80 characters'; end if;
 if p_code is null or p_code !~ '^[A-Z]{3}$' then raise exception 'Category code must be exactly three uppercase letters'; end if;
 if char_length(coalesce(p_description,''))>500 then raise exception 'Category description must be 500 characters or fewer'; end if;
 select category_code into v_existing_code from public.card_categories where category_id=p_category_id;
 if found then
  select count(*) into v_card_count from public.card_catalogue where category_id=p_category_id;
  if v_card_count>0 and v_existing_code<>p_code then
   raise exception 'This category already has numbered cards. Its three-letter code cannot be changed, because that would break existing card identities.';
  end if;
 end if;
 insert into public.card_categories(category_id,label,category_code,description,sort_order,is_active)
 values(p_category_id,trim(p_label),p_code,nullif(trim(p_description),''),coalesce(p_sort_order,0),coalesce(p_is_active,true))
 on conflict(category_id) do update set
  label=excluded.label,category_code=excluded.category_code,
  description=excluded.description,sort_order=excluded.sort_order,
  is_active=excluded.is_active;
 return jsonb_build_object('success',true,'category_id',p_category_id);
end;
$$;

create or replace function public.remove_moderator_card_category(p_category_id text)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_count integer;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 select count(*) into v_count from public.card_catalogue where category_id=p_category_id;
 if not exists(select 1 from public.card_categories where category_id=p_category_id) then
  raise exception 'Category not found';
 end if;
 if v_count>0 then
  update public.card_categories set is_active=false where category_id=p_category_id;
  return jsonb_build_object('success',true,'removed',false,'deactivated',true,'card_count',v_count);
 end if;
 delete from public.card_categories where category_id=p_category_id;
 return jsonb_build_object('success',true,'removed',true,'deactivated',false,'card_count',0);
end;
$$;

revoke all on function public.get_moderator_card_categories() from public,anon;
revoke all on function public.save_moderator_card_category(text,text,text,text,integer,boolean) from public,anon;
revoke all on function public.remove_moderator_card_category(text) from public,anon;
grant execute on function public.get_moderator_card_categories() to authenticated;
grant execute on function public.save_moderator_card_category(text,text,text,text,integer,boolean) to authenticated;
grant execute on function public.remove_moderator_card_category(text) to authenticated;

select category_id,label,category_code,is_active
from public.card_categories order by sort_order,label;

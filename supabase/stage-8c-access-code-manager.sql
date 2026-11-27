-- ============================================================
-- ORLONG STAGE 8C.4 — ACCESS CODE MANAGEMENT
-- Extends the existing hashed-code system with campaign editing,
-- eligibility rules, disable controls and redemption history.
-- ============================================================

alter table public.access_code_campaigns
 add column if not exists eligibility_rules jsonb not null default '{}'::jsonb,
 add column if not exists updated_at timestamptz not null default now();

alter table public.access_code_campaigns
 drop constraint if exists access_code_campaigns_eligibility_object;
alter table public.access_code_campaigns
 add constraint access_code_campaigns_eligibility_object
 check (jsonb_typeof(eligibility_rules)='object');

-- Replace the original five-argument creator with a six-argument version.
-- The final argument has a default, so existing account-page calls continue
-- to work without modification.
drop function if exists public.create_access_code(text,text[],timestamptz,integer,text);

create or replace function public.create_access_code(
 campaign_label text,
 granted_access_keys text[],
 code_expires_at timestamptz default null,
 redemption_limit integer default null,
 custom_code text default null,
 eligibility_rules jsonb default '{}'::jsonb
)
returns text
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare new_code text; normalized_code text; key_count integer;
begin
 if auth.uid() is null or not exists(select 1 from public.reader_moderators where user_id=auth.uid()) then
  raise exception 'Not authorised to create access codes';
 end if;
 if campaign_label is null or char_length(trim(campaign_label)) not between 1 and 100 then
  raise exception 'Enter a campaign label between 1 and 100 characters';
 end if;
 if granted_access_keys is null or cardinality(granted_access_keys) not between 1 and 20 then
  raise exception 'Choose between 1 and 20 access permissions';
 end if;
 if exists(select 1 from unnest(granted_access_keys) as k where k !~ '^[a-z0-9][a-z0-9:_-]{0,79}$') then
  raise exception 'Access permissions may contain lowercase letters, numbers, colon, underscore and hyphen only';
 end if;
 select count(distinct k) into key_count from unnest(granted_access_keys) as k;
 if key_count<>cardinality(granted_access_keys) then raise exception 'Access permissions cannot contain duplicates'; end if;
 if redemption_limit is not null and redemption_limit<1 then raise exception 'Redemption limit must be at least 1'; end if;
 if code_expires_at is not null and code_expires_at<=now() then raise exception 'Expiry must be in the future'; end if;
 if eligibility_rules is null or jsonb_typeof(eligibility_rules)<>'object' then raise exception 'Eligibility settings must be a JSON object'; end if;
 if jsonb_typeof(coalesce(eligibility_rules->'required_access_keys','[]'::jsonb))<>'array'
   or jsonb_typeof(coalesce(eligibility_rules->'allowed_email_domains','[]'::jsonb))<>'array' then
  raise exception 'Required permissions and allowed domains must be lists';
 end if;
 if custom_code is not null and trim(custom_code)<>'' then
  if trim(custom_code) !~ '^[A-Za-z0-9]{6,40}$' then raise exception 'Custom codes must be 6–40 letters or numbers'; end if;
  new_code:=trim(custom_code);
 else
  new_code:='ORLONG-'||upper(substr(encode(gen_random_bytes(16),'hex'),1,20));
 end if;
 normalized_code:=regexp_replace(upper(new_code),'[^A-Z0-9]','','g');
 if exists(select 1 from public.access_code_campaigns where code_hash=encode(digest(convert_to(normalized_code,'UTF8'),'sha256'),'hex')) then
  raise exception 'That access code is already in use. Choose a different custom code';
 end if;
 insert into public.access_code_campaigns(label,code_hash,code_prefix,access_keys,expires_at,max_redemptions,created_by,eligibility_rules)
 values(trim(campaign_label),encode(digest(convert_to(normalized_code,'UTF8'),'sha256'),'hex'),
  left(upper(new_code),3),granted_access_keys,code_expires_at,redemption_limit,auth.uid(),eligibility_rules);
 return new_code;
end;
$$;

-- Enforce eligibility at redemption time. Existing redemptions remain valid
-- and their account grants remain permanent.
create or replace function public.redeem_access_code(input_code text)
returns jsonb
language plpgsql security definer
set search_path=public,extensions,pg_temp
as $$
declare
 reader_id uuid:=auth.uid();
 normalized_code text;
 campaign public.access_code_campaigns%rowtype;
 redemption_id uuid;
 was_already_redeemed boolean:=false;
 reader_email text;
 required_key text;
 allowed_domains jsonb;
begin
 if reader_id is null then raise exception 'Please sign in before redeeming an access code'; end if;
 if input_code is null or char_length(trim(input_code))<6 or char_length(trim(input_code))>100 then
  return jsonb_build_object('success',false,'message','Enter a valid access code.');
 end if;
 normalized_code:=regexp_replace(upper(trim(input_code)),'[^A-Z0-9]','','g');
 select * into campaign from public.access_code_campaigns
 where code_hash=encode(digest(convert_to(normalized_code,'UTF8'),'sha256'),'hex') for update;
 if not found then return jsonb_build_object('success',false,'message','That access code was not recognised.'); end if;
 if not campaign.is_active then return jsonb_build_object('success',false,'message','That access code is no longer active.'); end if;
 if campaign.expires_at is not null and campaign.expires_at<=now() then
  return jsonb_build_object('success',false,'message','That access code has expired.');
 end if;
 select r.redemption_id into redemption_id from public.access_code_redemptions r
 where r.campaign_id=campaign.campaign_id and r.user_id=reader_id;
 if redemption_id is not null then
  was_already_redeemed:=true;
 else
  if campaign.max_redemptions is not null and campaign.redemption_count>=campaign.max_redemptions then
   return jsonb_build_object('success',false,'message','That access code has reached its redemption limit.');
  end if;
  if coalesce((campaign.eligibility_rules->>'require_confirmed_email')::boolean,false) then
   if not exists(select 1 from auth.users u where u.id=reader_id and u.email_confirmed_at is not null) then
    return jsonb_build_object('success',false,'message','Please confirm your email address before using this access code.');
   end if;
  end if;
  for required_key in select jsonb_array_elements_text(coalesce(campaign.eligibility_rules->'required_access_keys','[]'::jsonb)) loop
   if not exists(select 1 from public.reader_access_grants g where g.user_id=reader_id and g.access_key=required_key) then
    return jsonb_build_object('success',false,'message','Your account does not meet the access requirements for this code.');
   end if;
  end loop;
  allowed_domains:=coalesce(campaign.eligibility_rules->'allowed_email_domains','[]'::jsonb);
  if jsonb_array_length(allowed_domains)>0 then
   select lower(email) into reader_email from auth.users where id=reader_id;
   if reader_email is null or not exists(
    select 1 from jsonb_array_elements_text(allowed_domains) as domain(value)
    where split_part(reader_email,'@',2)=lower(trim(domain.value))
   ) then
    return jsonb_build_object('success',false,'message','This access code is restricted to eligible email addresses.');
   end if;
  end if;
  insert into public.access_code_redemptions(campaign_id,user_id)
  values(campaign.campaign_id,reader_id)
  returning access_code_redemptions.redemption_id into redemption_id;
  update public.access_code_campaigns set redemption_count=redemption_count+1,updated_at=now()
  where campaign_id=campaign.campaign_id;
 end if;
 insert into public.reader_access_grants(user_id,access_key,campaign_id)
 select reader_id,k,campaign.campaign_id from unnest(campaign.access_keys) as k
 on conflict(user_id,access_key,campaign_id) do nothing;
 return jsonb_build_object(
  'success',true,'already_redeemed',was_already_redeemed,
  'message',case when was_already_redeemed then 'You have already redeemed this code. Your access remains active.'
   else 'Access successfully unlocked. Your permission is saved to your account.' end,
  'access_keys',campaign.access_keys
 );
end;
$$;

create or replace function public.get_moderator_access_code_campaigns()
returns jsonb
language plpgsql stable security definer
set search_path=public,pg_temp
as $$
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'id',c.campaign_id,'label',c.label,'prefix',c.code_prefix,
  'accessKeys',c.access_keys,'expiresAt',c.expires_at,
  'maxRedemptions',c.max_redemptions,'redemptionCount',c.redemption_count,
  'active',c.is_active,'createdAt',c.created_at,'eligibility',c.eligibility_rules,
  'redemptions',(select coalesce(jsonb_agg(jsonb_build_object(
    'email',u.email,'redeemedAt',r.redeemed_at
   ) order by r.redeemed_at desc),'[]'::jsonb)
   from public.access_code_redemptions r join auth.users u on u.id=r.user_id
   where r.campaign_id=c.campaign_id)
 ) order by c.created_at desc) from public.access_code_campaigns c),'[]'::jsonb);
end;
$$;

create or replace function public.update_moderator_access_code_campaign(
 p_campaign_id uuid,
 p_label text,
 p_expires_at timestamptz,
 p_max_redemptions integer,
 p_eligibility_rules jsonb,
 p_is_active boolean
)
returns jsonb
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare v_count integer;
begin
 if not public.is_reader_moderator() then raise exception 'Moderator access required'; end if;
 if nullif(trim(p_label),'') is null or char_length(trim(p_label))>100 then raise exception 'Enter a campaign label of 1–100 characters'; end if;
 if p_max_redemptions is not null and p_max_redemptions<1 then raise exception 'Redemption limit must be at least one'; end if;
 if p_eligibility_rules is null or jsonb_typeof(p_eligibility_rules)<>'object' then raise exception 'Eligibility settings must be an object'; end if;
 if jsonb_typeof(coalesce(p_eligibility_rules->'required_access_keys','[]'::jsonb))<>'array'
  or jsonb_typeof(coalesce(p_eligibility_rules->'allowed_email_domains','[]'::jsonb))<>'array' then
  raise exception 'Required permissions and allowed domains must be lists';
 end if;
 select redemption_count into v_count from public.access_code_campaigns where campaign_id=p_campaign_id for update;
 if not found then raise exception 'Access-code campaign not found'; end if;
 if p_max_redemptions is not null and p_max_redemptions<v_count then raise exception 'The new limit cannot be lower than the number of redemptions already used'; end if;
 update public.access_code_campaigns set label=trim(p_label),expires_at=p_expires_at,
  max_redemptions=p_max_redemptions,eligibility_rules=p_eligibility_rules,
  is_active=coalesce(p_is_active,false),updated_at=now()
 where campaign_id=p_campaign_id;
 return jsonb_build_object('success',true,'campaign_id',p_campaign_id);
end;
$$;

revoke all on function public.create_access_code(text,text[],timestamptz,integer,text,jsonb) from public,anon;
revoke all on function public.redeem_access_code(text) from public,anon;
revoke all on function public.get_moderator_access_code_campaigns() from public,anon;
revoke all on function public.update_moderator_access_code_campaign(uuid,text,timestamptz,integer,jsonb,boolean) from public,anon;
grant execute on function public.create_access_code(text,text[],timestamptz,integer,text,jsonb) to authenticated;
grant execute on function public.redeem_access_code(text) to authenticated;
grant execute on function public.get_moderator_access_code_campaigns() to authenticated;
grant execute on function public.update_moderator_access_code_campaign(uuid,text,timestamptz,integer,jsonb,boolean) to authenticated;

select campaign_id,label,redemption_count,max_redemptions,is_active
from public.access_code_campaigns order by created_at desc;

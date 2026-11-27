-- STAGE 2 — reader avatars in Trading Post offers
-- Run once in Supabase Dashboard -> SQL Editor.
-- The public collection directory already returns reader_profiles.avatar_url.
-- This update adds the same public avatar URL to incoming/outgoing trade rows.

drop function if exists public.get_my_card_trades();

create function public.get_my_card_trades()
returns table (
  offer_id uuid,
  trade_role text,
  other_reader_id uuid,
  other_display_name text,
  other_avatar_url text,
  offered_card_number text,
  offered_card_name text,
  offered_artwork_url text,
  requested_card_number text,
  requested_card_name text,
  requested_artwork_url text,
  status text,
  created_at timestamptz,
  responded_at timestamptz
)
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select t.offer_id,
         case when t.proposer_user_id = auth.uid() then 'outgoing' else 'incoming' end,
         case when t.proposer_user_id = auth.uid() then t.recipient_user_id else t.proposer_user_id end,
         other_profile.display_name,
         other_profile.avatar_url,
         offered.card_number,
         offered.name,
         offered.artwork_url,
         requested.card_number,
         requested.name,
         requested.artwork_url,
         t.status,
         t.created_at,
         t.responded_at
  from public.card_trade_offers t
  join public.reader_profiles other_profile
    on other_profile.user_id = case
      when t.proposer_user_id = auth.uid() then t.recipient_user_id
      else t.proposer_user_id
    end
  join public.reader_card_copies offered_copy
    on offered_copy.copy_id = t.offered_copy_id
  join public.card_catalogue offered on offered.card_id = offered_copy.card_id
  join public.card_catalogue requested on requested.card_id = t.requested_card_id
  where auth.uid() in (t.proposer_user_id, t.recipient_user_id)
  order by t.created_at desc;
$$;

revoke all on function public.get_my_card_trades() from public, anon;
grant execute on function public.get_my_card_trades() to authenticated;

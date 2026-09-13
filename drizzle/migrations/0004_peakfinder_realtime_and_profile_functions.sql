ALTER TABLE public.pvp_duels REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pvp_duels'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.pvp_duels';
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_friendships_requester_id
  ON public.friendships (requester_id);

CREATE INDEX IF NOT EXISTS idx_friendships_addressee_id
  ON public.friendships (addressee_id);

CREATE INDEX IF NOT EXISTS idx_friendships_status
  ON public.friendships (status);

CREATE UNIQUE INDEX IF NOT EXISTS friendships_unordered_pair_key
  ON public.friendships (
    LEAST(requester_id, addressee_id),
    GREATEST(requester_id, addressee_id)
  );

ALTER TABLE public.friendships REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'friendships'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.friendships;
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.search_users(text);
CREATE OR REPLACE FUNCTION public.search_users(_q text)
 RETURNS TABLE(id uuid, username text, avatar_url text, elo_rating integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id,
         COALESCE(NULLIF(p.username, ''), split_part(COALESCE(p.email, ''), '@', 1)) AS username,
         p.avatar_url,
         COALESCE(p.elo_rating, 1200)
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND length(coalesce(_q, '')) >= 2
    AND (
      COALESCE(NULLIF(p.username, ''), split_part(COALESCE(p.email, ''), '@', 1)) ILIKE '%' || _q || '%'
      OR lower(p.email) = lower(_q)
    )
  ORDER BY 2
  LIMIT 20;
$function$;

DROP FUNCTION IF EXISTS public.public_profile(uuid);
CREATE OR REPLACE FUNCTION public.public_profile(_id uuid)
 RETURNS TABLE(id uuid, username text, avatar_url text, bio text, ski_level text, visited_resorts text[], is_friend boolean, elo_rating integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.id,
         COALESCE(NULLIF(p.username, ''), split_part(COALESCE(p.email, ''), '@', 1)) AS username,
         p.avatar_url,
         CASE WHEN public.are_friends(auth.uid(), p.id) THEN p.bio END,
         CASE WHEN public.are_friends(auth.uid(), p.id) THEN p.ski_level END,
         CASE WHEN public.are_friends(auth.uid(), p.id) THEN p.visited_resorts END,
         public.are_friends(auth.uid(), p.id),
         COALESCE(p.elo_rating, 1200)
  FROM public.profiles p
  WHERE p.id = _id;
$function$;

REVOKE ALL ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_profile(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
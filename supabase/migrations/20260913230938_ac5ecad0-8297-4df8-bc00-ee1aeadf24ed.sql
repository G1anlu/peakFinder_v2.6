CREATE OR REPLACE FUNCTION public.pvp_forfeit(_duel_id uuid)
 RETURNS pvp_duels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  duel public.pvp_duels;
  winner uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO duel FROM public.pvp_duels WHERE id = _duel_id FOR UPDATE;
  IF NOT FOUND OR (duel.player_1_id <> uid AND duel.player_2_id <> uid) THEN
    RAISE EXCEPTION 'Sfida non trovata';
  END IF;
  IF duel.status IN ('completed', 'cancelled') THEN
    RETURN duel;
  END IF;

  winner := CASE WHEN duel.player_1_id = uid THEN duel.player_2_id ELSE duel.player_1_id END;

  IF winner IS NULL THEN
    UPDATE public.pvp_duels
    SET status = 'cancelled', ended_at = now()
    WHERE id = _duel_id RETURNING * INTO duel;
    RETURN duel;
  END IF;

  UPDATE public.pvp_duels
  SET status = 'completed', winner_id = winner, ended_at = now()
  WHERE id = _duel_id RETURNING * INTO duel;

  UPDATE public.profiles
  SET elo_rating = GREATEST(COALESCE(elo_rating, 1200) - 15, 0),
      pvp_losses = COALESCE(pvp_losses, 0) + 1
  WHERE id = uid;

  UPDATE public.profiles
  SET elo_rating = COALESCE(elo_rating, 1200) + 25,
      coins = COALESCE(coins, 0) + 100,
      pvp_wins = COALESCE(pvp_wins, 0) + 1
  WHERE id = winner;

  RETURN duel;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pvp_close_stale_duels()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  d public.pvp_duels;
  closed int := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  FOR d IN
    SELECT * FROM public.pvp_duels
    WHERE status NOT IN ('completed', 'cancelled')
      AND (player_1_id = uid OR player_2_id = uid)
  LOOP
    IF d.player_2_id IS NULL THEN
      UPDATE public.pvp_duels SET status = 'cancelled', ended_at = now() WHERE id = d.id;
    ELSIF d.status = 'waiting' OR d.start_time IS NULL THEN
      UPDATE public.pvp_duels SET status = 'cancelled', ended_at = now() WHERE id = d.id;
    ELSE
      PERFORM public.pvp_forfeit(d.id);
    END IF;
    closed := closed + 1;
  END LOOP;

  RETURN closed;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pvp_join_duel()
 RETURNS pvp_duels
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  my_elo int;
  duel public.pvp_duels;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT COALESCE(elo_rating, 1200) INTO my_elo FROM public.profiles WHERE id = uid;
  IF my_elo IS NULL THEN
    RAISE EXCEPTION 'Profilo non trovato';
  END IF;

  PERFORM public.pvp_close_stale_duels();

  UPDATE public.pvp_duels d
  SET player_2_id = uid,
      status = 'matched',
      start_time = now() + interval '5 seconds'
  WHERE d.id = (
    SELECT w.id FROM public.pvp_duels w
    JOIN public.profiles p ON p.id = w.player_1_id
    WHERE w.date = CURRENT_DATE
      AND w.status = 'waiting'
      AND w.player_2_id IS NULL
      AND w.player_1_id <> uid
      AND abs(COALESCE(p.elo_rating, 1200) - my_elo) <= 150
    ORDER BY w.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO duel;

  IF FOUND THEN
    RETURN duel;
  END IF;

  INSERT INTO public.pvp_duels (player_1_id, status)
  VALUES (uid, 'waiting')
  RETURNING * INTO duel;

  RETURN duel;
END;
$function$;

REVOKE ALL ON FUNCTION public.pvp_close_stale_duels() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pvp_close_stale_duels() TO authenticated;

ALTER TABLE public.lifts REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'lifts'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.lifts;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
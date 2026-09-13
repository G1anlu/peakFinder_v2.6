ALTER TABLE public.pvp_duels ADD COLUMN IF NOT EXISTS start_time timestamptz;
ALTER TABLE public.pvp_duels ADD COLUMN IF NOT EXISTS ended_at timestamptz;

CREATE OR REPLACE FUNCTION public.pvp_join_duel()
RETURNS public.pvp_duels
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

  SELECT * INTO duel FROM public.pvp_duels d
  WHERE d.date = CURRENT_DATE
    AND d.status NOT IN ('completed', 'cancelled')
    AND (d.player_1_id = uid OR d.player_2_id = uid)
  ORDER BY d.created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN duel;
  END IF;

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

CREATE OR REPLACE FUNCTION public.pvp_cancel_duel(_duel_id uuid)
RETURNS public.pvp_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  duel public.pvp_duels;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO duel FROM public.pvp_duels WHERE id = _duel_id FOR UPDATE;
  IF NOT FOUND OR (duel.player_1_id <> uid AND duel.player_2_id <> uid) THEN
    RAISE EXCEPTION 'Sfida non trovata';
  END IF;
  IF duel.status <> 'waiting' THEN
    RETURN duel;
  END IF;

  UPDATE public.pvp_duels
  SET status = 'cancelled', ended_at = now()
  WHERE id = _duel_id
  RETURNING * INTO duel;

  RETURN duel;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pvp_finish_duel(_duel_id uuid)
RETURNS public.pvp_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  duel public.pvp_duels;
  winner uuid;
  loser uuid;
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

  IF duel.player_2_id IS NULL THEN
    UPDATE public.pvp_duels SET status = 'cancelled', ended_at = now()
    WHERE id = _duel_id RETURNING * INTO duel;
    RETURN duel;
  END IF;

  IF duel.player_1_score = duel.player_2_score THEN
    UPDATE public.pvp_duels
    SET status = 'completed', winner_id = NULL, ended_at = now()
    WHERE id = _duel_id RETURNING * INTO duel;

    UPDATE public.profiles
    SET coins = COALESCE(coins, 0) + 50
    WHERE id IN (duel.player_1_id, duel.player_2_id);

    RETURN duel;
  END IF;

  IF duel.player_1_score > duel.player_2_score THEN
    winner := duel.player_1_id;
    loser := duel.player_2_id;
  ELSE
    winner := duel.player_2_id;
    loser := duel.player_1_id;
  END IF;

  UPDATE public.pvp_duels
  SET status = 'completed', winner_id = winner, ended_at = now()
  WHERE id = _duel_id RETURNING * INTO duel;

  UPDATE public.profiles
  SET elo_rating = COALESCE(elo_rating, 1200) + 25,
      coins = COALESCE(coins, 0) + 100,
      pvp_wins = COALESCE(pvp_wins, 0) + 1
  WHERE id = winner;

  UPDATE public.profiles
  SET elo_rating = GREATEST(COALESCE(elo_rating, 1200) - 15, 0),
      pvp_losses = COALESCE(pvp_losses, 0) + 1
  WHERE id = loser;

  RETURN duel;
END;
$function$;

REVOKE ALL ON FUNCTION public.pvp_cancel_duel(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pvp_finish_duel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pvp_cancel_duel(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_finish_duel(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
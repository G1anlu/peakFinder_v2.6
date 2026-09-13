ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS elo_rating INT NOT NULL DEFAULT 1200,
  ADD COLUMN IF NOT EXISTS coins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pvp_wins INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pvp_losses INT NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.pvp_duels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  player_1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_1_score NUMERIC NOT NULL DEFAULT 0,
  player_2_score NUMERIC NOT NULL DEFAULT 0,
  player_1_km NUMERIC NOT NULL DEFAULT 0,
  player_2_km NUMERIC NOT NULL DEFAULT 0,
  player_1_lifts INT NOT NULL DEFAULT 0,
  player_2_lifts INT NOT NULL DEFAULT 0,
  winner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gps_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pvp_id UUID REFERENCES public.pvp_duels(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  altitude DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  is_downhill BOOLEAN NOT NULL DEFAULT false,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS pvp_duels_players_idx ON public.pvp_duels (date, status);
CREATE INDEX IF NOT EXISTS gps_tracks_pvp_idx ON public.gps_tracks (pvp_id, user_id, recorded_at);

GRANT SELECT, UPDATE ON public.pvp_duels TO authenticated;
GRANT ALL ON public.pvp_duels TO service_role;
GRANT SELECT, INSERT ON public.gps_tracks TO authenticated;
GRANT ALL ON public.gps_tracks TO service_role;

ALTER TABLE public.pvp_duels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gps_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own pvp duels" ON public.pvp_duels;
CREATE POLICY "Users can read own pvp duels" ON public.pvp_duels
  FOR SELECT TO authenticated
  USING (auth.uid() = player_1_id OR auth.uid() = player_2_id);

DROP POLICY IF EXISTS "Users can update own pvp duels" ON public.pvp_duels;
CREATE POLICY "Users can update own pvp duels" ON public.pvp_duels
  FOR UPDATE TO authenticated
  USING (auth.uid() = player_1_id OR auth.uid() = player_2_id)
  WITH CHECK (auth.uid() = player_1_id OR auth.uid() = player_2_id);

DROP POLICY IF EXISTS "Users can insert own GPS track" ON public.gps_tracks;
CREATE POLICY "Users can insert own GPS track" ON public.gps_tracks
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own GPS track" ON public.gps_tracks;
CREATE POLICY "Users can read own GPS track" ON public.gps_tracks
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_pvp_duels_updated_at ON public.pvp_duels;
CREATE TRIGGER update_pvp_duels_updated_at
  BEFORE UPDATE ON public.pvp_duels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.pvp_join_duel()
RETURNS public.pvp_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
    AND d.status <> 'completed'
    AND (d.player_1_id = uid OR d.player_2_id = uid)
  ORDER BY d.created_at DESC LIMIT 1;
  IF FOUND THEN
    RETURN duel;
  END IF;

  UPDATE public.pvp_duels d
  SET player_2_id = uid, status = 'in_progress'
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
$$;

CREATE OR REPLACE FUNCTION public.pvp_update_progress(_duel_id uuid, _km numeric, _lifts int, _score numeric)
RETURNS public.pvp_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  duel public.pvp_duels;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO duel FROM public.pvp_duels WHERE id = _duel_id;
  IF NOT FOUND OR (duel.player_1_id <> uid AND duel.player_2_id <> uid) THEN
    RAISE EXCEPTION 'Sfida non trovata';
  END IF;
  IF duel.status = 'completed' THEN
    RETURN duel;
  END IF;

  IF duel.player_1_id = uid THEN
    UPDATE public.pvp_duels
    SET player_1_km = GREATEST(_km, 0), player_1_lifts = GREATEST(_lifts, 0), player_1_score = GREATEST(_score, 0)
    WHERE id = _duel_id RETURNING * INTO duel;
  ELSE
    UPDATE public.pvp_duels
    SET player_2_km = GREATEST(_km, 0), player_2_lifts = GREATEST(_lifts, 0), player_2_score = GREATEST(_score, 0)
    WHERE id = _duel_id RETURNING * INTO duel;
  END IF;

  RETURN duel;
END;
$$;

CREATE OR REPLACE FUNCTION public.pvp_finalize(_duel_id uuid)
RETURNS public.pvp_duels
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  IF duel.status = 'completed' THEN
    RETURN duel;
  END IF;
  IF duel.player_2_id IS NULL THEN
    UPDATE public.pvp_duels SET status = 'completed' WHERE id = _duel_id RETURNING * INTO duel;
    RETURN duel;
  END IF;

  IF duel.player_1_score >= duel.player_2_score THEN
    winner := duel.player_1_id;
    loser := duel.player_2_id;
  ELSE
    winner := duel.player_2_id;
    loser := duel.player_1_id;
  END IF;

  UPDATE public.pvp_duels
  SET status = 'completed', winner_id = winner
  WHERE id = _duel_id RETURNING * INTO duel;

  UPDATE public.profiles
  SET elo_rating = COALESCE(elo_rating, 1200) + 25,
      coins = COALESCE(coins, 0) + 50,
      pvp_wins = COALESCE(pvp_wins, 0) + 1
  WHERE id = winner;

  UPDATE public.profiles
  SET elo_rating = GREATEST(COALESCE(elo_rating, 1200) - 15, 0),
      coins = COALESCE(coins, 0) + 10,
      pvp_losses = COALESCE(pvp_losses, 0) + 1
  WHERE id = loser;

  RETURN duel;
END;
$$;

REVOKE ALL ON FUNCTION public.pvp_join_duel() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pvp_update_progress(uuid, numeric, int, numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.pvp_finalize(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pvp_join_duel() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_update_progress(uuid, numeric, int, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pvp_finalize(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
CREATE TABLE IF NOT EXISTS public.user_daily_lift_bonuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lift_id BIGINT NOT NULL,
  lift_name TEXT,
  coins_awarded INT NOT NULL DEFAULT 50,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date DATE NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS user_daily_lift_bonuses_unique
  ON public.user_daily_lift_bonuses (user_id, lift_id, date);

GRANT SELECT, INSERT ON public.user_daily_lift_bonuses TO authenticated;
GRANT ALL ON public.user_daily_lift_bonuses TO service_role;

ALTER TABLE public.user_daily_lift_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own claimed bonuses" ON public.user_daily_lift_bonuses;
CREATE POLICY "Users can insert own claimed bonuses" ON public.user_daily_lift_bonuses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can read own claimed bonuses" ON public.user_daily_lift_bonuses;
CREATE POLICY "Users can read own claimed bonuses" ON public.user_daily_lift_bonuses
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.claim_lift_bonus(_lift_id BIGINT, _lift_name TEXT DEFAULT NULL, _coins INT DEFAULT 50)
RETURNS TABLE(awarded BOOLEAN, coins INT, lift_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  inserted_id uuid;
  new_coins int;
  award int := LEAST(GREATEST(COALESCE(_coins, 50), 0), 50);
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.user_daily_lift_bonuses (user_id, lift_id, lift_name, coins_awarded)
  VALUES (uid, _lift_id, _lift_name, award)
  ON CONFLICT (user_id, lift_id, date) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    SELECT p.coins INTO new_coins FROM public.profiles p WHERE p.id = uid;
    RETURN QUERY SELECT false, COALESCE(new_coins, 0), _lift_name;
    RETURN;
  END IF;

  UPDATE public.profiles p
  SET coins = COALESCE(p.coins, 0) + award
  WHERE p.id = uid
  RETURNING p.coins INTO new_coins;

  RETURN QUERY SELECT true, COALESCE(new_coins, 0), _lift_name;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_lift_bonus(BIGINT, TEXT, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_lift_bonus(BIGINT, TEXT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.add_user_coins(_user_id UUID, _amount INT)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance INT;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() <> _user_id THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF _amount IS NULL OR _amount <= 0 OR _amount > 1000 THEN
    RAISE EXCEPTION 'Invalid amount';
  END IF;
  UPDATE public.profiles
  SET coins = COALESCE(coins, 0) + _amount
  WHERE id = _user_id
  RETURNING coins INTO new_balance;
  RETURN COALESCE(new_balance, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.add_user_coins(UUID, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_user_coins(UUID, INT) TO authenticated, service_role;

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
  IF duel.status = 'completed' THEN
    RETURN duel;
  END IF;

  winner := CASE WHEN duel.player_1_id = uid THEN duel.player_2_id ELSE duel.player_1_id END;

  UPDATE public.pvp_duels
  SET status = 'completed', winner_id = winner
  WHERE id = _duel_id RETURNING * INTO duel;

  UPDATE public.profiles
  SET elo_rating = GREATEST(COALESCE(elo_rating, 1200) - 15, 0),
      pvp_losses = COALESCE(pvp_losses, 0) + 1
  WHERE id = uid;

  IF winner IS NOT NULL THEN
    UPDATE public.profiles
    SET elo_rating = COALESCE(elo_rating, 1200) + 25,
        coins = COALESCE(coins, 0) + 50,
        pvp_wins = COALESCE(pvp_wins, 0) + 1
    WHERE id = winner;
  END IF;

  RETURN duel;
END;
$function$;

REVOKE ALL ON FUNCTION public.pvp_forfeit(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pvp_forfeit(uuid) TO authenticated;

CREATE TABLE IF NOT EXISTS public.lifts (
  id bigint PRIMARY KEY,
  name text,
  type text,
  resort_name text,
  status varchar(20) NOT NULL DEFAULT 'open',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.lifts TO anon;
GRANT SELECT ON public.lifts TO authenticated;
GRANT ALL ON public.lifts TO service_role;

ALTER TABLE public.lifts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lift status readable by everyone" ON public.lifts;
CREATE POLICY "Lift status readable by everyone"
ON public.lifts FOR SELECT
TO anon, authenticated
USING (true);

DROP TRIGGER IF EXISTS update_lifts_updated_at ON public.lifts;
CREATE TRIGGER update_lifts_updated_at
BEFORE UPDATE ON public.lifts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

NOTIFY pgrst, 'reload schema';
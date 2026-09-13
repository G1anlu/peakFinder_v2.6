CREATE TABLE public.hotel_search_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_query text NOT NULL,
  checkin_date date NOT NULL,
  checkout_date date NOT NULL,
  guests integer NOT NULL DEFAULT 2,
  response_data jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (location_query, checkin_date, checkout_date, guests)
);

GRANT ALL ON public.hotel_search_cache TO service_role;
ALTER TABLE public.hotel_search_cache ENABLE ROW LEVEL SECURITY;

CREATE INDEX hotel_search_cache_created_at_idx ON public.hotel_search_cache (created_at);
CREATE INDEX hotel_search_cache_checkin_idx ON public.hotel_search_cache (checkin_date);

CREATE TABLE public.ski_rentals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resort_key text NOT NULL UNIQUE,
  resort_name text,
  lat double precision NOT NULL,
  lng double precision NOT NULL,
  radius_m integer NOT NULL DEFAULT 25000,
  places jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.ski_rentals TO authenticated;
GRANT ALL ON public.ski_rentals TO service_role;
ALTER TABLE public.ski_rentals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Noleggi leggibili dagli utenti autenticati"
ON public.ski_rentals FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_ski_rentals_updated_at
BEFORE UPDATE ON public.ski_rentals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.remove_friend(friend_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.friendships
  WHERE (requester_id = auth.uid() AND addressee_id = friend_user_id)
     OR (addressee_id = auth.uid() AND requester_id = friend_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_own_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  DELETE FROM public.friendships WHERE requester_id = uid OR addressee_id = uid;
  DELETE FROM public.favorites WHERE user_id = uid;
  DELETE FROM public.itineraries WHERE user_id = uid;
  DELETE FROM public.profiles WHERE id = uid;
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_friend(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.delete_own_account() FROM public, anon;
GRANT EXECUTE ON FUNCTION public.remove_friend(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_own_account() TO authenticated;

REVOKE ALL ON FUNCTION public.are_friends(uuid, uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.public_profile(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.search_users(text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
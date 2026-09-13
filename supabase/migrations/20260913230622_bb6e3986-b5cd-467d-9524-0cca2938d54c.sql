CREATE TABLE public.itineraries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_days INTEGER NOT NULL,
  resort_slug TEXT NOT NULL,
  resort_name TEXT NOT NULL,
  resort_lat DOUBLE PRECISION NOT NULL,
  resort_lng DOUBLE PRECISION NOT NULL,
  hotel_provider TEXT NOT NULL,
  hotel_place_id TEXT NOT NULL,
  hotel_name TEXT NOT NULL,
  hotel_rating NUMERIC,
  hotel_address TEXT,
  rental_provider TEXT NOT NULL,
  rental_place_id TEXT NOT NULL,
  rental_name TEXT NOT NULL,
  rental_rating NUMERIC,
  rental_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.itineraries TO authenticated;
GRANT ALL ON public.itineraries TO service_role;
ALTER TABLE public.itineraries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own itineraries" ON public.itineraries FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.resort_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cache_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL,
  kind TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL,
  payload JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + interval '7 days',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT ON public.resort_cache TO authenticated;
GRANT ALL ON public.resort_cache TO service_role;
ALTER TABLE public.resort_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Cache readable by signed-in users" ON public.resort_cache FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER update_itineraries_updated_at BEFORE UPDATE ON public.itineraries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.itineraries
  ADD COLUMN IF NOT EXISTS efficiency_score numeric,
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb;

CREATE TABLE public.favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  resort_slug text NOT NULL,
  resort_name text NOT NULL,
  region text,
  lat double precision,
  lng double precision,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, resort_slug)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.favorites TO authenticated;
GRANT ALL ON public.favorites TO service_role;

ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own favorites" ON public.favorites
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_favorites_updated_at
  BEFORE UPDATE ON public.favorites
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ski_level text NOT NULL DEFAULT 'intermediate',
  visited_resorts text[] NOT NULL DEFAULT '{}',
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own profile" ON public.profiles
  FOR ALL TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS email text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_key
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (NEW.id, NEW.email, split_part(COALESCE(NEW.email, ''), '@', 1))
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DO $$ BEGIN
  CREATE TYPE public.friend_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.friend_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT friendships_distinct CHECK (requester_id <> addressee_id),
  CONSTRAINT friendships_pair_key UNIQUE (requester_id, addressee_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own friendships" ON public.friendships;
CREATE POLICY "Users view own friendships" ON public.friendships
  FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP POLICY IF EXISTS "Users send friend requests" ON public.friendships;
CREATE POLICY "Users send friend requests" ON public.friendships
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users respond to friend requests" ON public.friendships;
CREATE POLICY "Users respond to friend requests" ON public.friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id OR auth.uid() = requester_id)
  WITH CHECK (auth.uid() = addressee_id OR auth.uid() = requester_id);

DROP POLICY IF EXISTS "Users delete own friendships" ON public.friendships;
CREATE POLICY "Users delete own friendships" ON public.friendships
  FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

DROP TRIGGER IF EXISTS update_friendships_updated_at ON public.friendships;
CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.are_friends(_a uuid, _b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.friendships f
    WHERE f.status = 'accepted'
      AND ((f.requester_id = _a AND f.addressee_id = _b)
        OR (f.requester_id = _b AND f.addressee_id = _a))
  );
$$;

CREATE OR REPLACE FUNCTION public.search_users(_q text)
RETURNS TABLE (id uuid, username text, avatar_url text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         COALESCE(NULLIF(p.username, ''), split_part(COALESCE(p.email, ''), '@', 1)) AS username,
         p.avatar_url
  FROM public.profiles p
  WHERE p.id <> auth.uid()
    AND length(coalesce(_q, '')) >= 2
    AND (
      COALESCE(NULLIF(p.username, ''), split_part(COALESCE(p.email, ''), '@', 1)) ILIKE '%' || _q || '%'
      OR lower(p.email) = lower(_q)
    )
  ORDER BY 2
  LIMIT 20;
$$;

CREATE OR REPLACE FUNCTION public.public_profile(_id uuid)
RETURNS TABLE (
  id uuid, username text, avatar_url text, bio text,
  ski_level text, visited_resorts text[], is_friend boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id,
         COALESCE(NULLIF(p.username, ''), split_part(COALESCE(p.email, ''), '@', 1)) AS username,
         p.avatar_url,
         CASE WHEN public.are_friends(auth.uid(), p.id) THEN p.bio END,
         CASE WHEN public.are_friends(auth.uid(), p.id) THEN p.ski_level END,
         CASE WHEN public.are_friends(auth.uid(), p.id) THEN p.visited_resorts END,
         public.are_friends(auth.uid(), p.id)
  FROM public.profiles p
  WHERE p.id = _id;
$$;

DROP POLICY IF EXISTS "Friends view itineraries" ON public.itineraries;
CREATE POLICY "Friends view itineraries" ON public.itineraries
  FOR SELECT TO authenticated USING (public.are_friends(auth.uid(), user_id));

DROP POLICY IF EXISTS "Friends view favorites" ON public.favorites;
CREATE POLICY "Friends view favorites" ON public.favorites
  FOR SELECT TO authenticated USING (public.are_friends(auth.uid(), user_id));

REVOKE EXECUTE ON FUNCTION public.search_users(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.public_profile(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.are_friends(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_users(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.public_profile(uuid) TO authenticated;

ALTER FUNCTION public.are_friends(uuid, uuid) SECURITY DEFINER;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.are_friends(uuid, uuid) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.itineraries TO authenticated;
GRANT ALL ON TABLE public.itineraries TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.favorites TO authenticated;
GRANT ALL ON TABLE public.favorites TO service_role;
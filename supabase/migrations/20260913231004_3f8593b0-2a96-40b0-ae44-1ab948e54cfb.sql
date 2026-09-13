CREATE TABLE IF NOT EXISTS public.news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  abstract text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT '',
  article_url text NOT NULL,
  image_url text,
  published_at timestamptz NOT NULL DEFAULT now(),
  resorts text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT news_article_url_key UNIQUE (article_url)
);

CREATE INDEX IF NOT EXISTS news_published_at_idx ON public.news (published_at DESC);

GRANT SELECT ON public.news TO anon;
GRANT SELECT ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;

ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "news_public_read" ON public.news;
CREATE POLICY "news_public_read" ON public.news FOR SELECT TO anon, authenticated USING (true);

ALTER TABLE public.news REPLICA IDENTITY FULL;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'news'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.news;
  END IF;
END $$;
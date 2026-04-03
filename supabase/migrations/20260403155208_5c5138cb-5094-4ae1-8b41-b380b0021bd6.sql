ALTER TABLE public.weekly_checkins
  ADD COLUMN walking_difficulty integer DEFAULT NULL,
  ADD COLUMN stair_difficulty integer DEFAULT NULL,
  ADD COLUMN daily_activity_score integer DEFAULT NULL;
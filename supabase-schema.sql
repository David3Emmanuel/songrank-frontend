-- SongRank Duels Database Schema
-- This schema supports the "Rank Duel" social feature where users challenge friends

-- Duel Sessions Table
-- Stores information about each duel challenge
CREATE TABLE duel_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id TEXT, -- Optional: link to user account if authenticated
  anonymous_owner_id TEXT, -- For unauthenticated users
  song_pool_ids JSONB NOT NULL, -- Array of song IDs to rank
  playlist_metadata JSONB, -- Playlist name, cover image, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'expired')),
  
  -- Ensure at least one owner identifier exists
  CONSTRAINT owner_check CHECK (owner_id IS NOT NULL OR anonymous_owner_id IS NOT NULL)
);

-- Index for faster lookups
CREATE INDEX idx_duel_sessions_status ON duel_sessions(status);
CREATE INDEX idx_duel_sessions_expires_at ON duel_sessions(expires_at);
CREATE INDEX idx_duel_sessions_owner ON duel_sessions(owner_id);

-- Duel Results Table
-- Stores ranking results from each participant
CREATE TABLE duel_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  duel_id UUID NOT NULL REFERENCES duel_sessions(id) ON DELETE CASCADE,
  user_id TEXT, -- Optional: authenticated user
  anonymous_id TEXT, -- For unauthenticated participants
  ranking_blob JSONB NOT NULL, -- Array of {Song: string, Score: number}
  comparison_history JSONB NOT NULL, -- Array of comparison records
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure at least one identifier exists
  CONSTRAINT participant_check CHECK (user_id IS NOT NULL OR anonymous_id IS NOT NULL),
  
  -- Prevent duplicate submissions from same user for same duel
  UNIQUE(duel_id, user_id),
  UNIQUE(duel_id, anonymous_id)
);

-- Index for faster lookups
CREATE INDEX idx_duel_results_duel_id ON duel_results(duel_id);
CREATE INDEX idx_duel_results_user_id ON duel_results(user_id);

-- Enable Row Level Security
ALTER TABLE duel_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE duel_results ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Anyone can read active sessions (for joining duels)
CREATE POLICY "Anyone can read active duel sessions"
  ON duel_sessions FOR SELECT
  USING (status = 'active' AND expires_at > NOW());

-- Anyone can create a session (for now - can be restricted later)
CREATE POLICY "Anyone can create duel sessions"
  ON duel_sessions FOR INSERT
  WITH CHECK (true);

-- Anyone can read results for duels they're part of
CREATE POLICY "Participants can read duel results"
  ON duel_results FOR SELECT
  USING (true); -- Can be restricted to only show results after both complete

-- Anyone can submit results
CREATE POLICY "Anyone can submit duel results"
  ON duel_results FOR INSERT
  WITH CHECK (true);

-- Function to calculate compatibility score
CREATE OR REPLACE FUNCTION calculate_compatibility(
  ranking_a JSONB,
  ranking_b JSONB
)
RETURNS FLOAT AS $$
DECLARE
  song_a TEXT;
  song_b TEXT;
  rank_a_idx INTEGER;
  rank_b_idx INTEGER;
  sum_distance FLOAT := 0;
  count_common INTEGER := 0;
  max_distance FLOAT;
  similarity FLOAT;
BEGIN
  -- Count common songs and calculate ranking distance
  FOR rank_a_idx IN 0..jsonb_array_length(ranking_a) - 1 LOOP
    song_a := ranking_a->rank_a_idx->>'Song';
    
    -- Find this song in ranking_b
    FOR rank_b_idx IN 0..jsonb_array_length(ranking_b) - 1 LOOP
      song_b := ranking_b->rank_b_idx->>'Song';
      
      IF song_a = song_b THEN
        count_common := count_common + 1;
        sum_distance := sum_distance + ABS(rank_a_idx - rank_b_idx);
        EXIT;
      END IF;
    END LOOP;
  END LOOP;
  
  -- If no common songs, return 0
  IF count_common = 0 THEN
    RETURN 0.0;
  END IF;
  
  -- Calculate normalized similarity (0-1, where 1 is perfect match)
  max_distance := count_common * (jsonb_array_length(ranking_a) - 1);
  
  IF max_distance = 0 THEN
    RETURN 1.0;
  END IF;
  
  similarity := 1.0 - (sum_distance / max_distance);
  RETURN GREATEST(0.0, LEAST(1.0, similarity));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- View to get duel comparison data
CREATE OR REPLACE VIEW duel_comparisons AS
SELECT 
  ds.id AS session_id,
  ds.playlist_metadata,
  ds.created_at,
  r1.id AS result_a_id,
  r1.ranking_blob AS ranking_a,
  r1.completed_at AS completed_a_at,
  r2.id AS result_b_id,
  r2.ranking_blob AS ranking_b,
  r2.completed_at AS completed_b_at,
  calculate_compatibility(r1.ranking_blob, r2.ranking_blob) AS compatibility_score
FROM duel_sessions ds
INNER JOIN duel_results r1 ON r1.duel_id = ds.id
INNER JOIN duel_results r2 ON r2.duel_id = ds.id AND r2.id != r1.id
WHERE ds.status = 'completed';

-- Function to auto-expire old sessions
CREATE OR REPLACE FUNCTION expire_old_sessions()
RETURNS void AS $$
BEGIN
  UPDATE duel_sessions
  SET status = 'expired'
  WHERE expires_at < NOW() AND status = 'active';
END;
$$ LANGUAGE plpgsql;

-- Optional: Create a scheduled job to run expire_old_sessions periodically
-- (Requires pg_cron extension or external cron job)

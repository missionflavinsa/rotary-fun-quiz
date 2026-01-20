-- Migration: Add game_state column for full state persistence
-- This allows saving and resuming games with exact state (tabs, questions, students, timers)

ALTER TABLE game_sessions 
ADD COLUMN IF NOT EXISTS game_state JSONB;

-- Add index for faster queries on paused games
CREATE INDEX IF NOT EXISTS idx_game_sessions_status ON game_sessions(status);
CREATE INDEX IF NOT EXISTS idx_game_sessions_teacher_id ON game_sessions(teacher_id);

-- Adds the batch column to today_word_log.
--
-- Only needed for databases created before batches existed. 0001 now creates
-- the column, and `if not exists` makes this a no-op on a fresh database, so
-- running every migration in order is always correct.
--
-- Batches are what let "Today's words" be reloaded: the current batch is
-- replayed, and asking for more words opens the next one.

alter table today_word_log add column if not exists batch int not null default 1;

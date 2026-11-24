-- The firm-wide Activity log orders every event by time, across all matters.
CREATE INDEX "ActivityEvent_createdAt_idx" ON "ActivityEvent"("createdAt");

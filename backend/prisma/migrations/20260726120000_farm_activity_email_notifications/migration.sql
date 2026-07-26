-- Opt-in: email owners/managers on farm activity (pig/pen added, imports). All plans, default off.
ALTER TABLE "farms" ADD COLUMN "activity_email_notifications" BOOLEAN NOT NULL DEFAULT false;

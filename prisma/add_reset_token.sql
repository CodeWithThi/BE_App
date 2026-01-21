-- Add ResetToken columns for password reset functionality
ALTER TABLE Account 
ADD COLUMN ResetToken VARCHAR(255) NULL,
ADD COLUMN ResetTokenExpires DATETIME NULL;

/*
  # Add Image Support for Inventory Items

  1. Changes
    - Add `image_url` column to `stock_items` table to store inventory item images
    - Column is optional (nullable) to allow existing items without images

  2. Purpose
    - Enable visual identification of inventory items
    - Store public URLs to images uploaded to Supabase Storage
    - Improve user experience with visual inventory management

  3. Notes
    - Images will be stored in Supabase Storage bucket 'inventory-images'
    - URLs will be public and accessible via Supabase CDN
    - Max recommended file size: 5MB
*/

-- Add image_url column to stock_items table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stock_items' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE stock_items ADD COLUMN image_url TEXT;
  END IF;
END $$;

-- Add comment to document the column
COMMENT ON COLUMN stock_items.image_url IS 'Public URL to item image stored in Supabase Storage';

-- CUAgain Phase 3, migration 7 of 7: starting data (categories and placeholder avatars).

insert into public.categories (slug, label, examples, restricts_public_image, sort_order) values
  ('electronics', 'Electronics', 'Phones, earphones, chargers, calculators, flash drives', false, 1),
  ('accessories', 'Accessories', 'Watches, jewelry, glasses, umbrellas', false, 2),
  ('school-supplies', 'School supplies', 'Notebooks, books, pens, bags, tumblers', false, 3),
  ('identification', 'IDs and cards', 'School ID, license, ATM or library cards', true, 4),
  ('clothing', 'Clothing', 'Jackets, uniforms, caps, scarves', false, 5),
  ('personal-belongings', 'Personal belongings', 'Wallets, keys, lunch boxes', false, 6),
  ('others', 'Others', 'Anything that does not fit above', false, 7);

-- Placeholder avatars. image_path stays empty until real artwork is uploaded.
insert into public.avatars (key, label, sort_order) values
  ('avatar-1', 'Avatar 1', 1),
  ('avatar-2', 'Avatar 2', 2),
  ('avatar-3', 'Avatar 3', 3),
  ('avatar-4', 'Avatar 4', 4),
  ('avatar-5', 'Avatar 5', 5),
  ('avatar-6', 'Avatar 6', 6),
  ('avatar-7', 'Avatar 7', 7),
  ('avatar-8', 'Avatar 8', 8);

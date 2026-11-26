import { IdCard, Package, PencilRuler, Shirt, Smartphone, Umbrella, Watch, type LucideIcon } from 'lucide-react';
import type { CategorySlug } from '../types/category';

export type CategoryInfo = {
  label: string;
  examples: string;
  icon: LucideIcon;
  /** Sensitive categories never show their photo publicly. */
  restrictsPublicImage: boolean;
};

/*
  Static copy of the approved categories, used for labels and icons.
  In Phase 3 the real list moves into the `categories` table in Supabase;
  the slugs here should match the slugs stored there.
*/
export const ITEM_CATEGORIES: Record<CategorySlug, CategoryInfo> = {
  electronics: {
    label: 'Electronics',
    examples: 'Phones, chargers, laptops',
    icon: Smartphone,
    restrictsPublicImage: false,
  },
  accessories: {
    label: 'Accessories',
    examples: 'Watches, jewelry, bags',
    icon: Watch,
    restrictsPublicImage: false,
  },
  'school-supplies': {
    label: 'School supplies',
    examples: 'Notebooks, pens, calculators',
    icon: PencilRuler,
    restrictsPublicImage: false,
  },
  identification: {
    label: 'Identification',
    examples: 'IDs and school cards',
    icon: IdCard,
    restrictsPublicImage: true,
  },
  clothing: {
    label: 'Clothing',
    examples: 'Jackets and uniforms',
    icon: Shirt,
    restrictsPublicImage: false,
  },
  'personal-belongings': {
    label: 'Personal belongings',
    examples: 'Umbrellas and water bottles',
    icon: Umbrella,
    restrictsPublicImage: false,
  },
  others: {
    label: 'Others',
    examples: 'Items not covered above',
    icon: Package,
    restrictsPublicImage: false,
  },
};

export const CATEGORY_SLUGS = Object.keys(ITEM_CATEGORIES) as CategorySlug[];

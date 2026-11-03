import { CategoryItem } from '../../types';
import { prisma } from '../prisma';
import { MemoryDb } from '../dbStore';

export const DEFAULT_CATEGORIES: CategoryItem[] = [
  { id: 'cat-1', name: 'Books & Scriptures', description: 'Vedic scriptures, Prabhupada books, and spiritual literature' },
  { id: 'cat-2', name: 'Deity Worship & Paraphernalia', description: 'Deity dresses, altars, crowns, and puja items' },
  { id: 'cat-3', name: 'Clothing & Handlooms', description: 'Dhotis, kurtas, sarees, and silk shawls' },
  { id: 'cat-4', name: 'Organic & Ayurveda', description: 'Pure ghee, herbal oils, and Ayurvedic health products' },
  { id: 'cat-5', name: 'Incense & Dhoop', description: 'Natural incense sticks, dhoop cones, and sambrani' },
  { id: 'cat-6', name: 'Japa & Meditation', description: 'Tulsi japa beads, bead bags, and counter beads' },
  { id: 'cat-7', name: 'Audio & Media', description: 'Kirtan audio, lectures, and digital media' },
  { id: 'cat-8', name: 'Gifts & Souvenirs', description: 'Keychains, photos, framed pictures, and devotional gifts' },
  { id: 'cat-9', name: 'Food & Prasadam', description: 'Maha prasadam, dry fruits, and temple sweets' },
  { id: 'cat-10', name: 'Jewelry & Accessories', description: 'Kanthi malas, pendants, and devotional ornaments' },
  { id: 'cat-11', name: 'Puja Essentials', description: 'Camphor, wicks, tilak, and ghee lamps' },
  { id: 'cat-12', name: 'General Merchandise', description: 'Miscellaneous temple retail goods' }
];

if (!MemoryDb.categories || MemoryDb.categories.length === 0) {
  MemoryDb.categories = [...DEFAULT_CATEGORIES];
}

export async function getCategories(): Promise<CategoryItem[]> {
  try {
    if (process.env.DATABASE_URL && (prisma as any)?.category) {
      const dbCats = await (prisma as any).category.findMany({
        orderBy: { name: 'asc' }
      }).catch(() => null);

      if (dbCats && dbCats.length > 0) {
        return dbCats.map((c: any) => ({
          id: c.id,
          name: c.name,
          description: c.description || '',
          branchId: c.branchId || undefined,
          branchName: c.branchName || undefined,
          createdAt: c.createdAt ? new Date(c.createdAt).toISOString() : undefined
        }));
      }
    }
  } catch (error) {
    console.warn('Prisma getCategories failed, using memory store:', error);
  }

  return MemoryDb.categories && MemoryDb.categories.length > 0 ? MemoryDb.categories : DEFAULT_CATEGORIES;
}

export async function createCategory(data: Partial<CategoryItem>): Promise<CategoryItem> {
  const name = (data.name || '').trim();
  if (!name) {
    throw new Error('Category name is required');
  }

  const existing = (MemoryDb.categories || []).find(c => c.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return existing;
  }

  const newCat: CategoryItem = {
    id: data.id || `cat-${Date.now()}`,
    name,
    description: data.description || '',
    branchId: data.branchId,
    branchName: data.branchName,
    createdAt: new Date().toISOString()
  };

  try {
    if (process.env.DATABASE_URL && (prisma as any)?.category) {
      const created = await (prisma as any).category.create({
        data: {
          id: newCat.id,
          name: newCat.name,
          description: newCat.description || null,
          branchId: newCat.branchId || null,
          branchName: newCat.branchName || null
        }
      }).catch(() => null);

      if (created) {
        newCat.id = created.id;
      }
    }
  } catch (error) {
    console.warn('Prisma createCategory failed, saved to memory store:', error);
  }

  if (!MemoryDb.categories) {
    MemoryDb.categories = [...DEFAULT_CATEGORIES];
  }

  if (!MemoryDb.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
    MemoryDb.categories.push(newCat);
  }

  return newCat;
}

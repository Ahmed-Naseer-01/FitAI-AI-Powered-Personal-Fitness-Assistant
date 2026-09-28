// Per-serving nutrition for common Pakistani / South Asian foods.
// Values are for the stated household serving, from standard composition
// tables. Cite the source you use in the project report (spec section 13).

export type SeedFood = {
  name: string
  nameUrdu?: string
  category: 'grain' | 'protein' | 'dairy' | 'vegetable' | 'fruit' | 'snack' | 'drink' | 'sweet'
  servingLabel: string
  servingGrams: number
  kcal: number
  proteinG: number
  carbsG: number
  fatG: number
  isVeg: boolean
  tags: string[]
}

export const FOODS: SeedFood[] = [
  // ---- grains ----
  { name: 'Roti (whole wheat)', nameUrdu: 'روٹی', category: 'grain', servingLabel: '1 medium', servingGrams: 45, kcal: 120, proteinG: 3.5, carbsG: 25, fatG: 1.5, isVeg: true, tags: ['budget', 'gluten'] },
  { name: 'Naan', nameUrdu: 'نان', category: 'grain', servingLabel: '1 piece', servingGrams: 90, kcal: 260, proteinG: 8, carbsG: 50, fatG: 3, isVeg: true, tags: ['gluten'] },
  { name: 'Paratha', nameUrdu: 'پراٹھا', category: 'grain', servingLabel: '1 piece', servingGrams: 80, kcal: 280, proteinG: 6, carbsG: 36, fatG: 12, isVeg: true, tags: ['gluten'] },
  { name: 'White bread', category: 'grain', servingLabel: '1 slice', servingGrams: 28, kcal: 75, proteinG: 2.5, carbsG: 14, fatG: 1, isVeg: true, tags: ['budget', 'gluten'] },
  { name: 'Plain rice (boiled)', nameUrdu: 'چاول', category: 'grain', servingLabel: '1 cup', servingGrams: 150, kcal: 200, proteinG: 4, carbsG: 44, fatG: 0.5, isVeg: true, tags: ['budget'] },
  { name: 'Chicken biryani', nameUrdu: 'بریانی', category: 'grain', servingLabel: '1 cup', servingGrams: 200, kcal: 350, proteinG: 18, carbsG: 40, fatG: 13, isVeg: false, tags: [] },
  { name: 'Chicken pulao', nameUrdu: 'پلاؤ', category: 'grain', servingLabel: '1 cup', servingGrams: 200, kcal: 300, proteinG: 16, carbsG: 38, fatG: 9, isVeg: false, tags: [] },
  { name: 'Oats (cooked)', category: 'grain', servingLabel: '1 cup', servingGrams: 230, kcal: 160, proteinG: 6, carbsG: 28, fatG: 3, isVeg: true, tags: ['gluten', 'budget'] },
  { name: 'Cornflakes with milk', category: 'grain', servingLabel: '1 bowl', servingGrams: 200, kcal: 210, proteinG: 7, carbsG: 36, fatG: 4, isVeg: true, tags: ['dairy'] },

  // ---- pulses and vegetarian protein ----
  { name: 'Daal chana (cooked)', nameUrdu: 'دال چنا', category: 'protein', servingLabel: '1 cup', servingGrams: 180, kcal: 180, proteinG: 9, carbsG: 28, fatG: 3, isVeg: true, tags: ['budget', 'high-protein'] },
  { name: 'Daal masoor (cooked)', nameUrdu: 'دال مسور', category: 'protein', servingLabel: '1 cup', servingGrams: 180, kcal: 160, proteinG: 9, carbsG: 26, fatG: 2, isVeg: true, tags: ['budget', 'high-protein'] },
  { name: 'Daal mash (cooked)', nameUrdu: 'دال ماش', category: 'protein', servingLabel: '1 cup', servingGrams: 180, kcal: 170, proteinG: 10, carbsG: 26, fatG: 2.5, isVeg: true, tags: ['budget', 'high-protein'] },
  { name: 'Chana chaat', nameUrdu: 'چنا چاٹ', category: 'protein', servingLabel: '1 cup', servingGrams: 160, kcal: 210, proteinG: 10, carbsG: 32, fatG: 5, isVeg: true, tags: ['budget', 'high-protein'] },
  { name: 'Rajma (kidney beans)', category: 'protein', servingLabel: '1 cup', servingGrams: 180, kcal: 190, proteinG: 11, carbsG: 32, fatG: 1.5, isVeg: true, tags: ['budget', 'high-protein'] },
  { name: 'Paneer', nameUrdu: 'پنیر', category: 'dairy', servingLabel: '100 g', servingGrams: 100, kcal: 265, proteinG: 18, carbsG: 3, fatG: 21, isVeg: true, tags: ['dairy', 'high-protein'] },

  // ---- meat and fish ----
  { name: 'Karahi chicken', nameUrdu: 'کڑاہی', category: 'protein', servingLabel: '1 cup', servingGrams: 200, kcal: 320, proteinG: 30, carbsG: 6, fatG: 20, isVeg: false, tags: ['high-protein'] },
  { name: 'Chicken curry', nameUrdu: 'چکن سالن', category: 'protein', servingLabel: '1 cup', servingGrams: 200, kcal: 240, proteinG: 26, carbsG: 6, fatG: 12, isVeg: false, tags: ['high-protein'] },
  { name: 'Chicken tikka', nameUrdu: 'چکن تکہ', category: 'protein', servingLabel: '1 piece', servingGrams: 100, kcal: 190, proteinG: 27, carbsG: 2, fatG: 8, isVeg: false, tags: ['high-protein'] },
  { name: 'Seekh kebab', nameUrdu: 'سیخ کباب', category: 'protein', servingLabel: '1 piece', servingGrams: 60, kcal: 150, proteinG: 12, carbsG: 2, fatG: 10, isVeg: false, tags: ['high-protein'] },
  { name: 'Chapli kebab', category: 'protein', servingLabel: '1 piece', servingGrams: 100, kcal: 290, proteinG: 17, carbsG: 8, fatG: 21, isVeg: false, tags: [] },
  { name: 'Beef nihari', nameUrdu: 'نہاری', category: 'protein', servingLabel: '1 cup', servingGrams: 200, kcal: 380, proteinG: 28, carbsG: 8, fatG: 26, isVeg: false, tags: ['high-protein'] },
  { name: 'Aloo gosht', nameUrdu: 'آلو گوشت', category: 'protein', servingLabel: '1 cup', servingGrams: 200, kcal: 300, proteinG: 20, carbsG: 14, fatG: 18, isVeg: false, tags: [] },
  { name: 'Keema (minced beef)', nameUrdu: 'قیمہ', category: 'protein', servingLabel: '1 cup', servingGrams: 150, kcal: 330, proteinG: 25, carbsG: 5, fatG: 23, isVeg: false, tags: ['high-protein'] },
  { name: 'Haleem', nameUrdu: 'حلیم', category: 'protein', servingLabel: '1 cup', servingGrams: 200, kcal: 280, proteinG: 16, carbsG: 30, fatG: 10, isVeg: false, tags: ['gluten'] },
  { name: 'Fried fish', nameUrdu: 'مچھلی', category: 'protein', servingLabel: '1 piece', servingGrams: 100, kcal: 220, proteinG: 22, carbsG: 6, fatG: 12, isVeg: false, tags: ['high-protein'] },

  // ---- eggs ----
  { name: 'Boiled egg', nameUrdu: 'انڈا', category: 'protein', servingLabel: '1 egg', servingGrams: 50, kcal: 78, proteinG: 6.3, carbsG: 0.6, fatG: 5.3, isVeg: false, tags: ['egg', 'high-protein', 'budget'] },
  { name: 'Fried egg', category: 'protein', servingLabel: '1 egg', servingGrams: 55, kcal: 90, proteinG: 6.3, carbsG: 0.6, fatG: 7, isVeg: false, tags: ['egg', 'budget'] },
  { name: 'Omelette (2 eggs)', nameUrdu: 'آملیٹ', category: 'protein', servingLabel: '1 serving', servingGrams: 120, kcal: 220, proteinG: 13, carbsG: 2, fatG: 18, isVeg: false, tags: ['egg', 'high-protein'] },

  // ---- dairy ----
  { name: 'Dahi (yogurt)', nameUrdu: 'دہی', category: 'dairy', servingLabel: '1 cup', servingGrams: 245, kcal: 150, proteinG: 8.5, carbsG: 11, fatG: 8, isVeg: true, tags: ['dairy', 'high-protein'] },
  { name: 'Lassi (sweet)', nameUrdu: 'لسی', category: 'drink', servingLabel: '1 glass', servingGrams: 250, kcal: 220, proteinG: 8, carbsG: 30, fatG: 8, isVeg: true, tags: ['dairy'] },
  { name: 'Milk (full fat)', nameUrdu: 'دودھ', category: 'dairy', servingLabel: '1 cup', servingGrams: 240, kcal: 150, proteinG: 8, carbsG: 12, fatG: 8, isVeg: true, tags: ['dairy'] },
  { name: 'Raita', nameUrdu: 'رائتہ', category: 'dairy', servingLabel: '1 cup', servingGrams: 200, kcal: 110, proteinG: 6, carbsG: 9, fatG: 6, isVeg: true, tags: ['dairy'] },
  { name: 'Butter', category: 'dairy', servingLabel: '1 tbsp', servingGrams: 14, kcal: 100, proteinG: 0.1, carbsG: 0, fatG: 11.5, isVeg: true, tags: ['dairy'] },

  // ---- vegetables ----
  { name: 'Palak (spinach curry)', nameUrdu: 'پالک', category: 'vegetable', servingLabel: '1 cup', servingGrams: 180, kcal: 120, proteinG: 5, carbsG: 12, fatG: 6, isVeg: true, tags: ['budget'] },
  { name: 'Mixed vegetable sabzi', nameUrdu: 'سبزی', category: 'vegetable', servingLabel: '1 cup', servingGrams: 180, kcal: 90, proteinG: 3, carbsG: 14, fatG: 3, isVeg: true, tags: ['budget'] },
  { name: 'Bhindi (okra) sabzi', nameUrdu: 'بھنڈی', category: 'vegetable', servingLabel: '1 cup', servingGrams: 160, kcal: 110, proteinG: 3, carbsG: 13, fatG: 5, isVeg: true, tags: ['budget'] },
  { name: 'Aloo sabzi', category: 'vegetable', servingLabel: '1 cup', servingGrams: 180, kcal: 180, proteinG: 4, carbsG: 28, fatG: 6, isVeg: true, tags: ['budget'] },
  { name: 'Boiled potato', nameUrdu: 'آلو', category: 'vegetable', servingLabel: '1 medium', servingGrams: 170, kcal: 160, proteinG: 4, carbsG: 37, fatG: 0.2, isVeg: true, tags: ['budget'] },
  { name: 'Salad (cucumber, tomato, onion)', nameUrdu: 'سلاد', category: 'vegetable', servingLabel: '1 bowl', servingGrams: 150, kcal: 30, proteinG: 1.5, carbsG: 6, fatG: 0.2, isVeg: true, tags: ['budget'] },

  // ---- fruit ----
  { name: 'Banana', nameUrdu: 'کیلا', category: 'fruit', servingLabel: '1 medium', servingGrams: 118, kcal: 105, proteinG: 1.3, carbsG: 27, fatG: 0.4, isVeg: true, tags: ['budget'] },
  { name: 'Apple', nameUrdu: 'سیب', category: 'fruit', servingLabel: '1 medium', servingGrams: 182, kcal: 95, proteinG: 0.5, carbsG: 25, fatG: 0.3, isVeg: true, tags: [] },
  { name: 'Mango', nameUrdu: 'آم', category: 'fruit', servingLabel: '1 medium', servingGrams: 200, kcal: 135, proteinG: 1.8, carbsG: 35, fatG: 0.6, isVeg: true, tags: [] },
  { name: 'Orange', nameUrdu: 'سنگترہ', category: 'fruit', servingLabel: '1 medium', servingGrams: 130, kcal: 62, proteinG: 1.2, carbsG: 15, fatG: 0.2, isVeg: true, tags: ['budget'] },
  { name: 'Dates', nameUrdu: 'کھجور', category: 'fruit', servingLabel: '3 pieces', servingGrams: 24, kcal: 66, proteinG: 0.6, carbsG: 18, fatG: 0, isVeg: true, tags: ['budget'] },

  // ---- nuts and snacks ----
  { name: 'Almonds', nameUrdu: 'بادام', category: 'snack', servingLabel: '30 g', servingGrams: 30, kcal: 175, proteinG: 6, carbsG: 6, fatG: 15, isVeg: true, tags: ['nuts'] },
  { name: 'Peanuts', nameUrdu: 'مونگ پھلی', category: 'snack', servingLabel: '30 g', servingGrams: 30, kcal: 170, proteinG: 7, carbsG: 5, fatG: 14, isVeg: true, tags: ['nuts', 'budget'] },
  { name: 'Walnuts', nameUrdu: 'اخروٹ', category: 'snack', servingLabel: '30 g', servingGrams: 30, kcal: 195, proteinG: 4.5, carbsG: 4, fatG: 19, isVeg: true, tags: ['nuts'] },
  { name: 'Samosa', nameUrdu: 'سموسہ', category: 'snack', servingLabel: '1 piece', servingGrams: 60, kcal: 185, proteinG: 4, carbsG: 22, fatG: 9, isVeg: true, tags: ['budget', 'gluten'] },
  { name: 'Pakora', nameUrdu: 'پکوڑا', category: 'snack', servingLabel: '100 g', servingGrams: 100, kcal: 260, proteinG: 7, carbsG: 26, fatG: 14, isVeg: true, tags: ['budget'] },
  { name: 'French fries', category: 'snack', servingLabel: '1 medium', servingGrams: 115, kcal: 340, proteinG: 4, carbsG: 44, fatG: 16, isVeg: true, tags: [] },
  { name: 'Chicken sandwich', category: 'snack', servingLabel: '1 piece', servingGrams: 150, kcal: 320, proteinG: 20, carbsG: 34, fatG: 11, isVeg: false, tags: ['gluten'] },
  { name: 'Anda paratha roll', category: 'snack', servingLabel: '1 roll', servingGrams: 180, kcal: 420, proteinG: 14, carbsG: 42, fatG: 22, isVeg: false, tags: ['egg', 'gluten'] },
  { name: 'Beef burger', category: 'snack', servingLabel: '1 piece', servingGrams: 200, kcal: 500, proteinG: 25, carbsG: 40, fatG: 26, isVeg: false, tags: ['gluten'] },

  // ---- sweets ----
  { name: 'Gajar halwa', nameUrdu: 'گاجر حلوہ', category: 'sweet', servingLabel: '1 cup', servingGrams: 150, kcal: 350, proteinG: 5, carbsG: 48, fatG: 16, isVeg: true, tags: ['dairy'] },
  { name: 'Kheer', nameUrdu: 'کھیر', category: 'sweet', servingLabel: '1 cup', servingGrams: 200, kcal: 280, proteinG: 7, carbsG: 42, fatG: 9, isVeg: true, tags: ['dairy'] },
  { name: 'Jalebi', nameUrdu: 'جلیبی', category: 'sweet', servingLabel: '2 pieces', servingGrams: 50, kcal: 190, proteinG: 1, carbsG: 36, fatG: 5, isVeg: true, tags: [] },

  // ---- drinks ----
  { name: 'Chai with sugar', nameUrdu: 'چائے', category: 'drink', servingLabel: '1 cup', servingGrams: 200, kcal: 110, proteinG: 3, carbsG: 14, fatG: 4, isVeg: true, tags: ['dairy', 'budget'] },
  { name: 'Chai without sugar', category: 'drink', servingLabel: '1 cup', servingGrams: 200, kcal: 60, proteinG: 3, carbsG: 4, fatG: 4, isVeg: true, tags: ['dairy', 'budget'] },
  { name: 'Green tea', category: 'drink', servingLabel: '1 cup', servingGrams: 200, kcal: 2, proteinG: 0, carbsG: 0.5, fatG: 0, isVeg: true, tags: ['budget'] },
  { name: 'Soft drink (cola)', category: 'drink', servingLabel: '1 glass', servingGrams: 250, kcal: 105, proteinG: 0, carbsG: 27, fatG: 0, isVeg: true, tags: [] },
]

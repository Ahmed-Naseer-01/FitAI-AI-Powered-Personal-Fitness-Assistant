import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { FOODS } from './data/foods'
import { EXERCISES } from './data/exercises'

const db = new PrismaClient()

async function main() {
  // Reference data only. User data is never touched by the seed.
  await db.mealPlanItem.deleteMany()
  await db.food.deleteMany()
  await db.exercise.deleteMany()

  await db.food.createMany({
    data: FOODS.map((f) => ({ ...f, tags: f.tags.join(',') })),
  })

  await db.exercise.createMany({
    data: EXERCISES.map((e) => ({ ...e, repUnit: e.repUnit ?? 'reps' })),
  })

  console.log(`Seeded ${FOODS.length} foods and ${EXERCISES.length} exercises.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())

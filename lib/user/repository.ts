import { eq } from "drizzle-orm"
import { db } from "@/lib/db/client"
import { user } from "@/lib/db/schema"

export const userRepository = {
  getById: async (id: string) => {
    const rows = await db.select().from(user).where(eq(user.id, id)).limit(1)
    return rows[0] ?? null
  },

  updateWebhookUrl: async (id: string, webhookUrl: string | null) => {
    const rows = await db
      .update(user)
      .set({
        webhookUrl,
        updatedAt: new Date(),
      })
      .where(eq(user.id, id))
      .returning()

    return rows[0] ?? null
  },
}

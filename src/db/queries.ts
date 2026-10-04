import { db } from './index.ts';
import { messages, users, typing } from './schema.ts';
import { desc, asc, sql, eq } from 'drizzle-orm';

export interface FormattedMessage {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  text: string;
  createdAt: { seconds: number; nanoseconds: number };
}

// Fetch all chat history from Google Cloud SQL
export async function getDbMessages(): Promise<FormattedMessage[]> {
  try {
    const rows = await db
      .select()
      .from(messages)
      .orderBy(asc(messages.createdAt))
      .limit(300);

    return rows.map((r) => ({
      id: String(r.id),
      userId: r.userId,
      displayName: r.displayName,
      photoURL: r.photoURL || undefined,
      text: r.text,
      createdAt: {
        seconds: Math.floor(new Date(r.createdAt).getTime() / 1000),
        nanoseconds: 0,
      },
    }));
  } catch (error) {
    console.error('Error fetching messages from Cloud SQL:', error);
    return [];
  }
}

// Insert new message into Google Cloud SQL
export async function insertDbMessage(
  userId: string,
  displayName: string,
  text: string,
  photoURL?: string
): Promise<FormattedMessage | null> {
  try {
    const inserted = await db
      .insert(messages)
      .values({
        userId,
        displayName,
        text,
        photoURL: photoURL || null,
      })
      .returning();

    if (!inserted || inserted.length === 0) return null;

    const r = inserted[0];
    return {
      id: String(r.id),
      userId: r.userId,
      displayName: r.displayName,
      photoURL: r.photoURL || undefined,
      text: r.text,
      createdAt: {
        seconds: Math.floor(new Date(r.createdAt).getTime() / 1000),
        nanoseconds: 0,
      },
    };
  } catch (error) {
    console.error('Error inserting message into Cloud SQL:', error);
    return null;
  }
}

// Update user presence in Google Cloud SQL
export async function upsertDbPresence(userId: string, displayName: string) {
  try {
    await db
      .insert(users)
      .values({
        userId,
        displayName,
        lastActive: new Date(),
      })
      .onConflictDoUpdate({
        target: users.userId,
        set: {
          displayName,
          lastActive: new Date(),
        },
      });
  } catch (error) {
    console.error('Error updating presence in Cloud SQL:', error);
  }
}

// Get online users from Google Cloud SQL (active in last 45 seconds)
export async function getDbOnlineUsers() {
  try {
    const threshold = new Date(Date.now() - 45000);
    const rows = await db
      .select()
      .from(users)
      .where(sql`${users.lastActive} > ${threshold}`);

    return rows.map((u) => ({
      userId: u.userId,
      displayName: u.displayName,
      lastActive: {
        seconds: Math.floor(new Date(u.lastActive).getTime() / 1000),
        nanoseconds: 0,
      },
    }));
  } catch (error) {
    console.error('Error fetching online users from Cloud SQL:', error);
    return [];
  }
}

// Update typing status in Google Cloud SQL
export async function upsertDbTyping(userId: string, displayName: string, isTyping: boolean) {
  try {
    await db
      .insert(typing)
      .values({
        userId,
        displayName,
        isTyping,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: typing.userId,
        set: {
          displayName,
          isTyping,
          updatedAt: new Date(),
        },
      });
  } catch (error) {
    console.error('Error updating typing in Cloud SQL:', error);
  }
}

// Get active typing users from Google Cloud SQL (last 5 seconds)
export async function getDbTypers() {
  try {
    const threshold = new Date(Date.now() - 6000);
    const rows = await db
      .select()
      .from(typing)
      .where(sql`${typing.isTyping} = true AND ${typing.updatedAt} > ${threshold}`);

    return rows.map((t) => ({
      userId: t.userId,
      displayName: t.displayName,
      isTyping: true,
      timestamp: new Date(t.updatedAt).getTime(),
    }));
  } catch (error) {
    console.error('Error fetching typers from Cloud SQL:', error);
    return [];
  }
}

// Clear all chat history from Google Cloud SQL
export async function clearDbMessages() {
  try {
    await db.delete(messages);
    return true;
  } catch (error) {
    console.error('Error clearing messages in Cloud SQL:', error);
    throw error;
  }
}

// Clear everything including users and typing
export async function clearDbEverything() {
  try {
    await db.delete(messages);
    await db.delete(users);
    await db.delete(typing);
    return true;
  } catch (error) {
    console.error('Error clearing all data in Cloud SQL:', error);
    throw error;
  }
}

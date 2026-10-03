import type { Timestamp } from 'firebase/firestore';

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  text: string;
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | null;
}

export interface ChatUser {
  uid: string;
  displayName: string;
  avatarColor?: string;
  photoURL?: string;
}

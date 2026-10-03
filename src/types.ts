import type { Timestamp } from 'firebase/firestore';

export interface SeenUser {
  userId: string;
  displayName: string;
  seenAt?: number;
}

export interface ChatMessage {
  id: string;
  userId: string;
  displayName: string;
  photoURL?: string;
  text: string;
  createdAt: Timestamp | { seconds: number; nanoseconds: number } | null;
  readBy?: string[];
  seenBy?: SeenUser[];
}

export interface ChatUser {
  uid: string;
  displayName: string;
  photoURL?: string;
}

export interface OnlineUser {
  userId: string;
  displayName: string;
  lastActive?: Timestamp | { seconds: number; nanoseconds: number } | null;
}

export interface TypingUser {
  userId: string;
  displayName: string;
  isTyping: boolean;
  timestamp: number;
}


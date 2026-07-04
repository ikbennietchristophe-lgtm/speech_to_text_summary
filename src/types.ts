export interface Recording {
  id: string;
  userId: string;
  title: string;
  createdAt: number; // millisecond timestamp
  duration: number; // in seconds
  audioBase64?: string; // base64 representation of audio
  transcript: string;
  summary: string;
  category: string;
  tags: string[];
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  createdAt: number;
}

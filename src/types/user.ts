export type UserStatus = 'safe' | 'sos' | 'offline-suspected';

export interface AppUser {
  uid: string;
  fullName: string;
  studentId: string;
  university: string;
  email: string;
  phone?: string;
  photoUrl?: string;
  verified: boolean;
  currentStatus: UserStatus;
  lastActiveAt: any;
  lastKnownLocation?: { lat: number; lng: number; accuracy: number };
  silentAlertMode: boolean;
  autoSosOnFall: boolean;
  hasOnboarded: boolean;
  pushToken?: string;
}

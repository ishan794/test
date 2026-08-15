export interface TrustedContact {
  id: string;
  name: string;
  phone: string;
  relationship: string;
  autoShare: boolean;
  status: 'verified' | 'pending';
  isSystemContact: boolean;
  priority: 'primary' | 'secondary';
}

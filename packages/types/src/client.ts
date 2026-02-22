/** Individual client profile */
export interface ClientProfile {
  id: string;
  userId: string;
  totalOrders: number;
  totalSpent: number;
  averageRating: number;
  defaultPaymentMethodId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Business client account */
export interface BusinessAccount {
  id: string;
  userId: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  registrationNumber: string | null;
  billingAddress: string | null;
  industry: string | null;
  totalOrders: number;
  totalSpent: number;
  webhookUrl: string | null;
  webhookSecret: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Saved address for clients */
export interface SavedAddress {
  id: string;
  userId: string;
  label: string; // e.g., "Home", "Office"
  address: string;
  latitude: number;
  longitude: number;
  instructions: string | null;
  isDefault: boolean;
  createdAt: Date;
}

export type TransactionType = 'income' | 'expense';

export type IconName =
  | 'Utensils'
  | 'Car'
  | 'ShoppingBag'
  | 'Gamepad2'
  | 'Wallet'
  | 'MoreHorizontal';

export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string; // ISO string
  note?: string;
}

export interface Category {
  id: string;
  name: string;
  icon: IconName;
  color: string;
}

export const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'Ăn uống', icon: 'Utensils', color: '#ef4444' },
  { id: '2', name: 'Di chuyển', icon: 'Car', color: '#3b82f6' },
  { id: '3', name: 'Mua sắm', icon: 'ShoppingBag', color: '#f59e0b' },
  { id: '4', name: 'Giải trí', icon: 'Gamepad2', color: '#8b5cf6' },
  { id: '5', name: 'Lương', icon: 'Wallet', color: '#10b981' },
  { id: '6', name: 'Khác', icon: 'MoreHorizontal', color: '#6b7280' },
];

export interface User{
  id: string;
  email: string;
  fullName: string;
  password?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}
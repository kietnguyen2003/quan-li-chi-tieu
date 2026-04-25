export type TransactionType = 'income' | 'expense';


export interface Transaction {
  id: string;
  amount: number;
  type: TransactionType;
  categoryId: string;
  date: string; // ISO string
  note?: string;
}
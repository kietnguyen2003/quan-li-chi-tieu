import { format, parseISO } from 'date-fns';
import type { Transaction } from './types.ts';

export const groupTransactionsByDate = (transactions: Transaction[]): Record<string, Transaction[]> => {
  const groups: Record<string, Transaction[]> = {};

  transactions.forEach((transaction) => {
    const dateKey = format(parseISO(transaction.date), 'yyyy-MM-dd');

    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }

    groups[dateKey].push(transaction);
  });

  return groups;
};
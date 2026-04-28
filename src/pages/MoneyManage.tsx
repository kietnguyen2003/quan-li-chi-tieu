import { useState, useEffect, useMemo } from 'react'

import { Calendar } from '../components/Calendar'
import { Header } from '../components/Header'
import { FloatingButton } from '../components/FloatingButton'
import { TransactionList } from '../components/TransactionList'
import { TextTransactionTools } from '../components/TextTransactionTools.tsx'
import { ClearMonthTransactions } from '../components/ClearMonthTransactions.tsx'

import { formatCurrency, loadStoredValue } from '../lib/utils.ts';

import { 
  addMonths, 
  subMonths,
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isWithinInterval,
  parseISO,
} from 'date-fns';

import { groupTransactionsByDate } from '../lib/helper.ts';
import { type Transaction, type Category } from '../lib/types.ts';
import { DEFAULT_CATEGORIES } from '../lib/types.ts';
import { AnimatePresence } from 'framer-motion'
import { AddTransaction } from '../components/AddTransaction.tsx'
import { useAuth } from '../context/AuthContext.tsx'

function MoneyManage() {
    const { user } = useAuth();

  const STORAGE_KEY_TRANSACTIONS = `kitdev_${user?.id}_transactions`;
  const STORAGE_KEY_CATEGORIES = `kitdev_${user?.id}_categories`;

  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>(() =>
    loadStoredValue<Transaction[]>(STORAGE_KEY_TRANSACTIONS, [])
  );
  const [categories, setCategories] = useState<Category[]>(() =>
    loadStoredValue<Category[]>(STORAGE_KEY_CATEGORIES, DEFAULT_CATEGORIES)
  );

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);


  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

  console.log('Transactions:', transactions);
  console.log('Categories:', categories);

  // Save Data
  useEffect(() => {
    if (transactions.length === 0) {
      localStorage.removeItem(STORAGE_KEY_TRANSACTIONS);
      return;
    }

    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
  }, [STORAGE_KEY_TRANSACTIONS, transactions]);

  useEffect(() => {
    if (categories.length > DEFAULT_CATEGORIES.length) {
      localStorage.setItem(STORAGE_KEY_CATEGORIES, JSON.stringify(categories));
    }
  }, [STORAGE_KEY_CATEGORIES, categories]);


  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });


  const dayTransactions = useMemo(() => groupTransactionsByDate(transactions), [transactions]);
  const monthSummary = useMemo(() => {
    return transactions.reduce(
      (summary, transaction) => {
        const transactionDate = parseISO(transaction.date);

        if (!isWithinInterval(transactionDate, { start: monthStart, end: monthEnd })) {
          return summary;
        }

        if (transaction.type === 'income') {
          summary.income += transaction.amount;
        } else {
          summary.expense += transaction.amount;
        }

        return summary;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions, monthStart, monthEnd]);

  return (
    <div className="min-h-screen bg-natural-bg text-natural-text font-sans selection:bg-natural-accent/20 pb-20">
      <Header currentDate={currentDate} onPrevMonth={prevMonth} onNextMonth={nextMonth} /> 

        
      <main className="max-w-4xl mx-auto p-3 md:p-6">
        <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          {/* Legend */}
          <div className="flex gap-4 text-[9px] font-bold uppercase tracking-[0.15em] text-natural-text/40 justify-center md:justify-start">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-natural-accent"></div> Thu nhập
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-natural-warning"></div> Chi tiêu
            </div>
          </div>

          <div className="flex flex-col sm:flex-row justify-center md:justify-end gap-3">
            <TextTransactionTools
              transactions={transactions}
              categories={categories}
              onImportTransactions={(newTransactions) => {
                setTransactions((currentTransactions) => [...currentTransactions, ...newTransactions]);
              }}
            />
            <ClearMonthTransactions
              currentDate={currentDate}
              transactions={transactions}
              onClearMonthTransactions={() => {
                setTransactions((currentTransactions) =>
                  currentTransactions.filter((transaction) => {
                    const transactionDate = parseISO(transaction.date);

                    return !isWithinInterval(transactionDate, { start: monthStart, end: monthEnd });
                  }),
                );
              }}
            />
          </div>
        </div>

        <Calendar
          calendarDays={calendarDays}
          dayTransactions={dayTransactions}
          monthStart={monthStart}
          monthIncome={formatCurrency(monthSummary.income)}
          monthExpense={formatCurrency(monthSummary.expense)}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setIsDayListOpen(true);
          }} />
      </main>  

      <FloatingButton
        setSelectedDay={setSelectedDay}
        setIsModalOpen={(open) => {
          if (open) {
            setEditingTransaction(null);
          }
          setIsModalOpen(open);
        }}
      />

      <AnimatePresence>
        <TransactionList
          isDayListOpen={isDayListOpen}
          selectedDay={selectedDay}
          dayTransactions={dayTransactions}
          categories={categories}
          setIsDayListOpen={setIsDayListOpen}
          setIsModalOpen={setIsModalOpen}
          onEditTransaction={(transaction) => {
            setEditingTransaction(transaction);
            setSelectedDay(parseISO(transaction.date));
            setIsDayListOpen(false);
            setIsModalOpen(true);
          }}
        />
      </AnimatePresence>

      <AnimatePresence>
          <AddTransaction
            isModalOpen={isModalOpen}
            selectedDay={selectedDay}
            categories={categories}
            setIsModalOpen={(open) => {
              setIsModalOpen(open);
              if (!open) {
                setEditingTransaction(null);
              }
            }}
            setCategories={setCategories}
            editingTransaction={editingTransaction}
            onAddTransaction={(transaction) => {
                console.log('New Transaction:', transaction);
                setTransactions([...transactions, transaction]);
              }
            }
            onUpdateTransaction={(updatedTransaction) => {
              setTransactions((currentTransactions) =>
                currentTransactions.map((transaction) =>
                  transaction.id === updatedTransaction.id ? updatedTransaction : transaction,
                ),
              );
              setEditingTransaction(null);
            }}
          />
      </AnimatePresence>
    </div>
  )
}

export default MoneyManage

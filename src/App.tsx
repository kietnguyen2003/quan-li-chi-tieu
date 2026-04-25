import { useState, useMemo } from 'react'

import { Calendar } from './components/Calendar'
import { Header } from './components/Header'
import { FloatingButton } from './components/FloatingButton'

import { 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
} from 'date-fns';

import { groupTransactionsByDate } from './helper.ts';
import type { Transaction } from './types.ts';

function App() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);



  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });


  const dayTransactions = useMemo(() => groupTransactionsByDate(transactions), [transactions]);


  return (
    <div className="min-h-screen bg-natural-bg text-natural-text font-sans selection:bg-natural-accent/20 pb-20">
      <Header currentDate={new Date()} onPrevMonth={() => {}} onNextMonth={() => {}} /> 
      <main className="max-w-4xl mx-auto p-3 md:p-6">
        <Calendar
          calendarDays={calendarDays}
          dayTransactions={dayTransactions}
          monthStart={monthStart}
          onSelectDay={(day) => {
            setSelectedDay(day);
            setIsDayListOpen(true);
          }} />
      </main>  

      <FloatingButton
        setSelectedDay={setSelectedDay}
        setIsModalOpen={setIsModalOpen}
      />
    </div>
  )
}

export default App

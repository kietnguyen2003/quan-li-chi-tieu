import { BrowserRouter, Route, Routes } from 'react-router';
import { AttendanceProvider } from './context/AttendanceContext';
import { CalendarPage } from './pages/CalendarPage';
import { StatisticPage } from './pages/StatisticPage';

export default function App() {
  return (
    <BrowserRouter>
      <AttendanceProvider>
        <Routes>
          <Route path="/" element={<CalendarPage />} />
          <Route path="/statistic" element={<StatisticPage />} />
          <Route path="/thong-ke" element={<StatisticPage />} />
        </Routes>
      </AttendanceProvider>
    </BrowserRouter>
  );
}

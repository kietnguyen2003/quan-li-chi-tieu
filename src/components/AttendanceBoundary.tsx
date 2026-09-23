import type { ReactNode } from 'react';
import { LoaderCircle, X } from 'lucide-react';
import { useAttendance } from '../context/useAttendance';
import { Header } from './Header';

export function AttendanceBoundary({ children }: { children: ReactNode }) {
  const { loading, hasLoaded, saving, loadError, dataError, isCloud, reload, clearDataError } = useAttendance();
  if (!hasLoaded && (loading || loadError)) return <>
    <Header showMonthPicker={false} />
    <main className="mx-auto max-w-lg px-6 py-16 text-center text-natural-heading">
      {loading ? <p role="status" className="flex items-center justify-center gap-3"><LoaderCircle className="motion-safe:animate-spin" size={20} />Đang tải lịch dạy…</p> : <><p role="alert" className="mb-5">{loadError}</p><button className="hallmark-button-primary" onClick={() => void reload()}>Tải lại dữ liệu</button></>}
    </main>
  </>;
  return <>
    {children}
    {(loadError || loading) && <div className="fixed inset-0 z-[120] grid place-items-center bg-natural-overlay/40 p-6"><div className="w-full max-w-md rounded-2xl bg-natural-surface p-6 text-natural-heading shadow-xl">{loading ? <p role="status">Đang tải lịch dạy…</p> : <><p role="alert">{loadError}</p><button className="hallmark-button-primary mt-4" onClick={() => void reload()}>Tải lại dữ liệu</button></>}</div></div>}
    {dataError && !loadError && <div className="fixed inset-x-4 top-4 z-[110] mx-auto flex max-w-lg items-start gap-3 rounded-xl border border-natural-warning bg-natural-surface p-4 text-sm text-natural-heading shadow-lg"><p role="alert" className="flex-1">{dataError}</p><button type="button" onClick={clearDataError} aria-label="Đóng thông báo lỗi" className="p-1"><X size={18} /></button></div>}
    {saving && <div className="fixed inset-0 z-[100] grid place-items-center bg-natural-overlay/20" role="status" aria-live="polite"><span className="flex items-center gap-3 rounded-2xl bg-natural-surface px-6 py-4 text-sm text-natural-heading shadow-xl"><LoaderCircle size={18} className="motion-safe:animate-spin" />{isCloud ? 'Đang lưu lên Supabase…' : 'Đang lưu…'}</span></div>}
  </>;
}

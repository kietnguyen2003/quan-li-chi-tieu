import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { addMonths, subMonths } from 'date-fns';
import type { ClassCheckIn, SalaryPayment, TeachingClass } from '../types';
import { loadStoredValue } from '../utils';
import { AttendanceContext } from './attendanceContextShared';
import * as repository from '../data/attendance-repository';
import type { AttendanceData } from '../data/attendance-repository';

const emptyData = (): AttendanceData => ({ classes: [], checkIns: [], salaryPayments: [] });

function loadGuestData(): AttendanceData {
  const classes = loadStoredValue<TeachingClass[]>('class_checkin_classes', []);
  return {
    classes: classes.map((item) => ({ ...item, note: item.note ?? '', durationHours: item.durationHours ?? 1 })),
    checkIns: loadStoredValue<ClassCheckIn[]>('class_checkin_records', []),
    salaryPayments: loadStoredValue<SalaryPayment[]>('class_checkin_salary_payments', []),
  };
}

function persistGuestData(data: AttendanceData) {
  localStorage.setItem('class_checkin_classes', JSON.stringify(data.classes));
  localStorage.setItem('class_checkin_records', JSON.stringify(data.checkIns));
  localStorage.setItem('class_checkin_salary_payments', JSON.stringify(data.salaryPayments));
}

// Keyed by user ID in App: account changes discard data and pending UI state.
// Signed-in data never initializes from or writes to localStorage snapshots.
export function AttendanceProvider({ children, storageScope }: { children: ReactNode; storageScope?: string }) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [data, setData] = useState<AttendanceData>(() => storageScope ? emptyData() : loadGuestData());
  const currentData = useRef(data);
  const [loading, setLoading] = useState(Boolean(storageScope));
  const [hasLoaded, setHasLoaded] = useState(!storageScope);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataError, setDataError] = useState<string | null>(null);
  const mounted = useRef(false);
  const version = useRef(0);
  const mutationPending = useRef(false);
  const ready = useRef(!storageScope);
  const pendingClass = useRef<{ fingerprint: string; item: TeachingClass } | null>(null);
  const pendingPayment = useRef<{ fingerprint: string; item: SalaryPayment } | null>(null);

  const fetchCloud = useCallback(async () => {
    if (!storageScope) return false;
    const ticket = ++version.current;
    let loaded: AttendanceData;
    try { loaded = await repository.loadAttendance(storageScope); }
    catch (error) {
      if (!mounted.current || ticket !== version.current) return false;
      throw error;
    }
    if (!mounted.current || ticket !== version.current) return false;
    currentData.current = loaded;
    setData(loaded);
    setHasLoaded(true);
    setLoadError(null);
    ready.current = true;
    return true;
  }, [storageScope]);

  const reload = useCallback(async () => {
    if (!storageScope || mutationPending.current) return;
    ready.current = false;
    setLoading(true);
    setLoadError(null);
    try { if (!await fetchCloud()) return; }
    catch (error) {
      if (mounted.current) setLoadError(repository.getDataErrorMessage(error));
    }
    if (mounted.current) setLoading(false);
  }, [storageScope, fetchCloud]);

  useEffect(() => {
    mounted.current = true;
    void Promise.resolve().then(() => { if (mounted.current) return reload(); });
    return () => { mounted.current = false; version.current += 1; };
  }, [reload]);

  async function mutate<T>(remote: () => Promise<T>, local: (previous: AttendanceData) => { data: AttendanceData; result: T }): Promise<T> {
    if (mutationPending.current || !ready.current) throw new Error('Dữ liệu chưa sẵn sàng.');
    mutationPending.current = true;
    setSaving(true);
    setDataError(null);
    try {
      if (storageScope) {
        const result = await remote();
        try { await fetchCloud(); }
        catch {
          ready.current = false;
          if (mounted.current) setLoadError('Đã lưu thay đổi, nhưng chưa tải lại được dữ liệu. Hãy tải lại trước khi tiếp tục.');
        }
        return result;
      }
      const next = local(currentData.current);
      persistGuestData(next.data);
      currentData.current = next.data;
      setData(next.data);
      return next.result;
    } catch (error) {
      if (mounted.current) setDataError(repository.getDataErrorMessage(error));
      // Multi-table writes may partially succeed: re-read actual server data.
      if (storageScope && mounted.current) {
        try { await fetchCloud(); }
        catch {
          ready.current = false;
          if (mounted.current) setLoadError('Chưa thể xác nhận dữ liệu trên máy chủ. Hãy tải lại trước khi tiếp tục.');
        }
      }
      throw error;
    } finally {
      mutationPending.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  const addClass = async (input: Omit<TeachingClass, 'id'>) => {
    // Reuse the ID when retrying a partially completed class/schedule save.
    const fingerprint = JSON.stringify(input);
    const item = pendingClass.current?.fingerprint === fingerprint
      ? pendingClass.current.item : { ...input, id: crypto.randomUUID() };
    pendingClass.current = { fingerprint, item };
    const result = await mutate(async () => { await repository.saveClass(storageScope!, item); return item; },
      (previous) => ({ data: { ...previous, classes: [...previous.classes, item] }, result: item }));
    pendingClass.current = null;
    return result;
  };
  const updateClass = (item: TeachingClass) => mutate(() => repository.saveClass(storageScope!, item),
    (previous) => ({ data: { ...previous, classes: previous.classes.map((entry) => entry.id === item.id ? item : entry) }, result: undefined }));
  const deleteClass = (id: string) => mutate(() => repository.deleteClass(storageScope!, id), (previous) => {
    if (previous.checkIns.some((entry) => entry.classId === id)) throw new Error('Lớp vẫn còn lịch sử chấm công.');
    return { data: { ...previous, classes: previous.classes.filter((entry) => entry.id !== id) }, result: undefined };
  });
  const addCheckIn = (input: Omit<ClassCheckIn, 'id'>) => {
    const item = { ...input, id: crypto.randomUUID() };
    return mutate(() => {
      const target = currentData.current.classes.find((entry) => entry.id === item.classId);
      if (!target) throw new Error('Không tìm thấy lớp học.');
      return repository.addCheckIn(storageScope!, item, target);
    }, (previous) => ({ data: { ...previous, checkIns: [...previous.checkIns, item] }, result: undefined }));
  };
  const deleteCheckIn = (id: string) => mutate(() => repository.deleteCheckIn(storageScope!, id),
    (previous) => ({ data: { ...previous, checkIns: previous.checkIns.filter((entry) => entry.id !== id) }, result: undefined }));
  const addSalaryPayment = async (input: Omit<SalaryPayment, 'id'>) => {
    const fingerprint = JSON.stringify(input);
    const item = pendingPayment.current?.fingerprint === fingerprint
      ? pendingPayment.current.item : { ...input, id: crypto.randomUUID() };
    pendingPayment.current = { fingerprint, item };
    await mutate(() => repository.saveSalaryPayment(storageScope!, item),
      (previous) => ({ data: { ...previous, salaryPayments: [...previous.salaryPayments, item] }, result: undefined }));
    pendingPayment.current = null;
  };
  const deleteSalaryPayment = (id: string) => mutate(() => repository.deleteSalaryPayment(storageScope!, id),
    (previous) => ({ data: { ...previous, salaryPayments: previous.salaryPayments.filter((entry) => entry.id !== id) }, result: undefined }));
  const importSchedule = (classes: TeachingClass[], checkIns: ClassCheckIn[]) => mutate(async () => {
    const byId = new Map([...currentData.current.classes, ...classes].map((item) => [item.id, item]));
    for (const item of classes) await repository.saveClass(storageScope!, item);
    for (const item of checkIns) {
      const target = byId.get(item.classId);
      if (!target) throw new Error('Không tìm thấy lớp học.');
      await repository.addCheckIn(storageScope!, item, target);
    }
  }, (previous) => ({ data: {
    ...previous,
    classes: [...new Map([...previous.classes, ...classes].map((item) => [item.id, item])).values()],
    checkIns: [...previous.checkIns, ...checkIns],
  }, result: undefined }));

  return <AttendanceContext.Provider value={{
    currentDate, setCurrentDate,
    nextMonth: () => setCurrentDate((date) => addMonths(date, 1)),
    prevMonth: () => setCurrentDate((date) => subMonths(date, 1)),
    ...data, loading, hasLoaded, saving, loadError, dataError, isCloud: Boolean(storageScope), reload,
    clearDataError: () => setDataError(null),
    addClass, updateClass, deleteClass, addCheckIn, deleteCheckIn, addSalaryPayment, deleteSalaryPayment, importSchedule,
  }}>{children}</AttendanceContext.Provider>;
}

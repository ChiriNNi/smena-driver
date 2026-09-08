'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { ChecklistPhase } from '@/lib/checklist-data';
import {
  cloneChecklist,
  SEED_ACKS,
  SEED_ASSIGNMENTS,
  SEED_CARS,
  SEED_DRIVERS,
  SEED_EXPENSES,
  SEED_QUIZ,
  SEED_REMINDERS,
  SEED_RULES,
  SEED_SHIFTS,
  type ProtoAck,
  type ProtoAssignment,
  type ProtoCar,
  type ProtoDriver,
  type ProtoExpense,
  type ProtoReminder,
  type ProtoRule,
  type ProtoShift,
  type QuizQuestion,
} from '@/lib/proto-data';

// Единое состояние прототипа. В реальном приложении на месте каждого сеттера
// будет запрос к своему API-роуту, а здесь всё живёт в памяти страницы, чтобы
// админка и кабинет водителя работали с одними и теми же данными.

type Store = {
  cars: ProtoCar[];
  drivers: ProtoDriver[];
  shifts: ProtoShift[];
  expenses: ProtoExpense[];
  reminders: ProtoReminder[];
  assignments: ProtoAssignment[];
  rules: ProtoRule[];
  quiz: QuizQuestion[];
  acks: ProtoAck[];
  checklist: ChecklistPhase[];

  addCar: (car: ProtoCar) => void;
  updateCar: (id: string, patch: Partial<ProtoCar>) => void;
  removeCar: (id: string) => void;

  addDriver: (driver: ProtoDriver) => void;
  updateDriver: (id: string, patch: Partial<ProtoDriver>) => void;
  removeDriver: (id: string) => void;

  addShift: (shift: ProtoShift) => void;

  addExpense: (expense: ProtoExpense) => void;
  removeExpense: (id: string) => void;

  addReminder: (reminder: ProtoReminder) => void;
  updateReminder: (id: string, patch: Partial<ProtoReminder>) => void;
  removeReminder: (id: string) => void;

  addAssignment: (assignment: ProtoAssignment) => void;
  removeAssignment: (id: string) => void;

  addRule: (rule: ProtoRule) => void;
  updateRule: (id: string, patch: Partial<ProtoRule>) => void;
  removeRule: (id: string) => void;

  addQuestion: (q: QuizQuestion) => void;
  updateQuestion: (id: string, patch: Partial<QuizQuestion>) => void;
  removeQuestion: (id: string) => void;

  addAck: (ack: ProtoAck) => void;

  setChecklist: (next: ChecklistPhase[]) => void;
};

const StoreContext = createContext<Store | null>(null);

export function ProtoStoreProvider({ children }: { children: ReactNode }) {
  const [cars, setCars] = useState<ProtoCar[]>(SEED_CARS);
  const [drivers, setDrivers] = useState<ProtoDriver[]>(SEED_DRIVERS);
  const [shifts, setShifts] = useState<ProtoShift[]>(SEED_SHIFTS);
  const [expenses, setExpenses] = useState<ProtoExpense[]>(SEED_EXPENSES);
  const [reminders, setReminders] = useState<ProtoReminder[]>(SEED_REMINDERS);
  const [assignments, setAssignments] = useState<ProtoAssignment[]>(SEED_ASSIGNMENTS);
  const [rules, setRules] = useState<ProtoRule[]>(SEED_RULES);
  const [quiz, setQuiz] = useState<QuizQuestion[]>(SEED_QUIZ);
  const [acks, setAcks] = useState<ProtoAck[]>(SEED_ACKS);
  const [checklist, setChecklist] = useState<ChecklistPhase[]>(() => cloneChecklist());

  const value = useMemo<Store>(
    () => ({
      cars,
      drivers,
      shifts,
      expenses,
      reminders,
      assignments,
      rules,
      quiz,
      acks,
      checklist,

      addCar: (car) => setCars((prev) => [...prev, car]),
      updateCar: (id, patch) => setCars((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c))),
      removeCar: (id) => setCars((prev) => prev.filter((c) => c.id !== id)),

      addDriver: (driver) => setDrivers((prev) => [...prev, driver]),
      updateDriver: (id, patch) => setDrivers((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d))),
      removeDriver: (id) => setDrivers((prev) => prev.filter((d) => d.id !== id)),

      addShift: (shift) => setShifts((prev) => [shift, ...prev]),

      addExpense: (expense) => setExpenses((prev) => [expense, ...prev]),
      removeExpense: (id) => setExpenses((prev) => prev.filter((e) => e.id !== id)),

      addReminder: (reminder) => setReminders((prev) => [...prev, reminder]),
      updateReminder: (id, patch) => setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
      removeReminder: (id) => setReminders((prev) => prev.filter((r) => r.id !== id)),

      addAssignment: (assignment) => setAssignments((prev) => [...prev, assignment]),
      removeAssignment: (id) => setAssignments((prev) => prev.filter((a) => a.id !== id)),

      addRule: (rule) => setRules((prev) => [...prev, rule]),
      updateRule: (id, patch) => setRules((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r))),
      removeRule: (id) => setRules((prev) => prev.filter((r) => r.id !== id)),

      addQuestion: (q) => setQuiz((prev) => [...prev, q]),
      updateQuestion: (id, patch) => setQuiz((prev) => prev.map((q) => (q.id === id ? { ...q, ...patch } : q))),
      removeQuestion: (id) => setQuiz((prev) => prev.filter((q) => q.id !== id)),

      // Новая попытка вытесняет прошлую по этому водителю — в журнале
      // администратора остаётся актуальный результат.
      addAck: (ack) => setAcks((prev) => [...prev.filter((a) => a.driverId !== ack.driverId), ack]),

      setChecklist,
    }),
    [cars, drivers, shifts, expenses, reminders, assignments, rules, quiz, acks, checklist]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore вызван вне ProtoStoreProvider');
  return store;
}

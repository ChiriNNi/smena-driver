'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as api from '@/lib/api';
import type {
  Assignment,
  Car,
  Driver,
  Expense,
  QuizAttempt,
  QuizQuestionAdmin,
  Reminder,
  Rule,
  Shift,
  TemplatePhase,
} from '@/lib/model';

// Единое состояние кабинета поверх API.
//
// Компоненты не делают запросов сами: они читают уже загруженные списки и
// вызывают действия вроде addCar — внутри идёт запрос, а локальный список
// обновляется ответом сервера. Так экран и база не расходятся, и не нужно
// перезагружать всё после каждой правки.
//
// Объём загрузки зависит от роли: водителю не нужны (и не положены) списки
// коллег, расходов и графика — сервер их ему и не отдаст.

type Store = {
  /** Идёт первая загрузка данных — экраны показывают заглушку. */
  loading: boolean;
  /** Последняя ошибка запроса: показывается плашкой, снимается закрытием. */
  error: string | null;
  dismissError: () => void;
  reload: () => Promise<void>;

  cars: Car[];
  drivers: Driver[];
  shifts: Shift[];
  expenses: Expense[];
  reminders: Reminder[];
  assignments: Assignment[];
  rules: Rule[];
  quiz: QuizQuestionAdmin[];
  acks: QuizAttempt[];
  checklist: TemplatePhase[];

  addCar: (data: { model: string; plate: string; active?: boolean }) => Promise<void>;
  updateCar: (id: string, patch: Partial<Pick<Car, 'model' | 'plate' | 'active'>>) => Promise<void>;
  removeCar: (id: string) => Promise<void>;

  addDriver: (data: api.DriverInput) => Promise<void>;
  updateDriver: (id: string, patch: Partial<api.DriverInput> & { active?: boolean; resetPin?: boolean }) => Promise<void>;
  removeDriver: (id: string) => Promise<void>;

  finishShift: (data: api.FinishShiftInput) => Promise<Shift | null>;

  addExpense: (data: { carId: string; driverId?: string; date?: string; category: string; amount: number; comment?: string }) => Promise<void>;
  removeExpense: (id: string) => Promise<void>;

  addReminder: (data: { carId: string; kind: string; dueDate: string; note?: string }) => Promise<void>;
  updateReminder: (id: string, patch: Partial<{ carId: string; kind: string; dueDate: string; note: string }>) => Promise<void>;
  removeReminder: (id: string) => Promise<void>;

  addAssignment: (data: { date: string; driverId: string; carId: string; timeStart: string; timeEnd: string }) => Promise<void>;
  removeAssignment: (id: string) => Promise<void>;

  addRule: (data: api.RuleInput) => Promise<void>;
  updateRule: (id: string, patch: Partial<api.RuleInput>) => Promise<void>;
  removeRule: (id: string) => Promise<void>;

  addQuestion: (data: api.QuestionInput) => Promise<void>;
  updateQuestion: (id: string, data: api.QuestionInput) => Promise<void>;
  removeQuestion: (id: string) => Promise<void>;

  saveChecklist: (next: TemplatePhase[]) => Promise<void>;
  /** Обновить журнал ознакомления после попытки водителя. */
  refreshAcks: () => Promise<void>;
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ role, children }: { role: 'driver' | 'admin'; children: ReactNode }) {
  const isAdmin = role === 'admin';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [cars, setCars] = useState<Car[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [quiz, setQuiz] = useState<QuizQuestionAdmin[]>([]);
  const [acks, setAcks] = useState<QuizAttempt[]>([]);
  const [checklist, setChecklist] = useState<TemplatePhase[]>([]);

  /**
   * Оборачивает действие: ошибку показываем плашкой, наружу отдаём признак
   * успеха. Из-за этого ни один обработчик в компонентах не обязан помнить
   * про try/catch, но и не «проглатывает» неудачу молча.
   */
  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | null> => {
    try {
      setError(null);
      return await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось выполнить действие.');
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    await run(async () => {
      // Запросы идут параллельно: на мобильной связи последовательная
      // загрузка десятка списков заметна на глаз.
      const [carsData, driversData, shiftsData, rulesData, checklistData] = await Promise.all([
        api.cars.list(),
        api.drivers.list(),
        api.shifts.list(),
        api.rules.list(),
        api.checklist.get(),
      ]);

      setCars(carsData);
      setDrivers(driversData);
      setShifts(shiftsData);
      setRules(rulesData);
      setChecklist(checklistData.checklist);

      if (isAdmin) {
        const [expensesData, remindersData, assignmentsData, quizData, acksData] = await Promise.all([
          api.expenses.list(),
          api.reminders.list(),
          api.assignments.list(),
          api.quiz.list<QuizQuestionAdmin>(),
          api.quiz.attempts(),
        ]);
        setExpenses(expensesData);
        setReminders(remindersData);
        setAssignments(assignmentsData);
        setQuiz(quizData);
        setAcks(acksData);
      }
      return true;
    });
    setLoading(false);
  }, [isAdmin, run]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- первичная загрузка данных с сервера: результат по определению приходит в состояние
    void load();
  }, [load]);

  const value = useMemo<Store>(() => {
    return {
      loading,
      error,
      dismissError: () => setError(null),
      reload: load,

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

      addCar: async (data) => {
        const car = await run(() => api.cars.create(data));
        if (car) setCars((prev) => [...prev, car]);
      },
      updateCar: async (id, patch) => {
        const car = await run(() => api.cars.update(id, patch));
        if (car) setCars((prev) => prev.map((c) => (c.id === id ? car : c)));
      },
      removeCar: async (id) => {
        const res = await run(() => api.cars.remove(id));
        if (res) setCars((prev) => prev.filter((c) => c.id !== id));
      },

      addDriver: async (data) => {
        const driver = await run(() => api.drivers.create(data));
        if (driver) setDrivers((prev) => [...prev, driver]);
      },
      updateDriver: async (id, patch) => {
        const driver = await run(() => api.drivers.update(id, patch));
        if (driver) setDrivers((prev) => prev.map((d) => (d.id === id ? driver : d)));
      },
      removeDriver: async (id) => {
        const res = await run(() => api.drivers.remove(id));
        if (res) setDrivers((prev) => prev.filter((d) => d.id !== id));
      },

      finishShift: async (data) => {
        const res = await run(() => api.shifts.finish(data));
        if (!res) return null;
        // Смена могла быть уже записана (повтор отправки) — тогда в список её
        // добавлять второй раз не нужно.
        setShifts((prev) => (prev.some((s) => s.id === res.shift.id) ? prev : [res.shift, ...prev]));
        return res.shift;
      },

      addExpense: async (data) => {
        const expense = await run(() => api.expenses.create(data));
        if (expense) setExpenses((prev) => [expense, ...prev]);
      },
      removeExpense: async (id) => {
        const res = await run(() => api.expenses.remove(id));
        if (res) setExpenses((prev) => prev.filter((e) => e.id !== id));
      },

      addReminder: async (data) => {
        const reminder = await run(() => api.reminders.create(data));
        if (reminder) setReminders((prev) => [...prev, reminder]);
      },
      updateReminder: async (id, patch) => {
        const reminder = await run(() => api.reminders.update(id, patch));
        if (reminder) setReminders((prev) => prev.map((r) => (r.id === id ? reminder : r)));
      },
      removeReminder: async (id) => {
        const res = await run(() => api.reminders.remove(id));
        if (res) setReminders((prev) => prev.filter((r) => r.id !== id));
      },

      addAssignment: async (data) => {
        const assignment = await run(() => api.assignments.create(data));
        if (assignment) setAssignments((prev) => [...prev, assignment]);
      },
      removeAssignment: async (id) => {
        const res = await run(() => api.assignments.remove(id));
        if (res) setAssignments((prev) => prev.filter((a) => a.id !== id));
      },

      addRule: async (data) => {
        const rule = await run(() => api.rules.create(data));
        if (rule) setRules((prev) => [...prev, rule]);
      },
      updateRule: async (id, patch) => {
        const rule = await run(() => api.rules.update(id, patch));
        if (rule) setRules((prev) => prev.map((r) => (r.id === id ? rule : r)));
      },
      removeRule: async (id) => {
        const res = await run(() => api.rules.remove(id));
        if (res) setRules((prev) => prev.filter((r) => r.id !== id));
      },

      addQuestion: async (data) => {
        const question = await run(() => api.quiz.create(data));
        if (question) setQuiz((prev) => [...prev, question]);
      },
      updateQuestion: async (id, data) => {
        const question = await run(() => api.quiz.update(id, data));
        if (question) setQuiz((prev) => prev.map((q) => (q.id === id ? question : q)));
      },
      removeQuestion: async (id) => {
        const res = await run(() => api.quiz.remove(id));
        if (res) setQuiz((prev) => prev.filter((q) => q.id !== id));
      },

      saveChecklist: async (next) => {
        const res = await run(() => api.checklist.save(next));
        // Сервер возвращает шаблон с настоящими id новых пунктов — берём его
        // ответ, а не присланную структуру.
        if (res) setChecklist(res.checklist);
      },

      refreshAcks: async () => {
        if (!isAdmin) return;
        const next = await run(() => api.quiz.attempts());
        if (next) setAcks(next);
      },
    };
  }, [
    loading,
    error,
    load,
    run,
    isAdmin,
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
  ]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore вызван вне StoreProvider');
  return store;
}

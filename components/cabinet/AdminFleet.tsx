'use client';

import { useState } from 'react';
import { SegmentedTabs } from './ui';
import FleetCars from './FleetCars';
import FleetExpenses from './FleetExpenses';
import FleetReminders from './FleetReminders';
import FleetSchedule from './FleetSchedule';

type FleetTab = 'cars' | 'expenses' | 'reminders' | 'schedule';

export default function AdminFleet() {
  const [tab, setTab] = useState<FleetTab>('cars');

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <SegmentedTabs<FleetTab>
        items={[
          { id: 'cars', label: 'Автомобили' },
          { id: 'expenses', label: 'Расходы' },
          { id: 'reminders', label: 'Напоминания' },
          { id: 'schedule', label: 'График' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'cars' && <FleetCars />}
      {tab === 'expenses' && <FleetExpenses />}
      {tab === 'reminders' && <FleetReminders />}
      {tab === 'schedule' && <FleetSchedule />}
    </div>
  );
}

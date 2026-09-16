'use client';

import { useState } from 'react';
import { SegmentedTabs } from './ui';
import AdminChecklistEditor from './AdminChecklistEditor';
import AdminRules from './AdminRules';
import AdminQuiz from './AdminQuiz';
import AdminParams from './AdminParams';

type SettingsTab = 'checklist' | 'rules' | 'quiz' | 'params';

export default function AdminSettings() {
  const [tab, setTab] = useState<SettingsTab>('checklist');

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <SegmentedTabs<SettingsTab>
        items={[
          { id: 'checklist', label: 'Чек-лист' },
          { id: 'rules', label: 'Правила' },
          { id: 'quiz', label: 'Тест по ТБ' },
          { id: 'params', label: 'Параметры' },
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'checklist' && <AdminChecklistEditor />}
      {tab === 'rules' && <AdminRules />}
      {tab === 'quiz' && <AdminQuiz />}
      {tab === 'params' && <AdminParams />}
    </div>
  );
}

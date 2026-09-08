'use client';

import { useMemo, useState } from 'react';
import {
  carLabel,
  formatDate,
  initials,
  onlyDigits,
  pinFromPhone,
  formatPhoneInput,
  todayISO,
  uid,
  type ProtoDriver,
  type Role,
} from '@/lib/proto-data';
import { useStore } from './store';
import { Icon } from './icons';
import { ConfirmDialog, EmptyState, Field, IconButton, Pill, SectionHeader, SelectField, Sheet, StatTile } from './ui';

// Учётные записи: администратор заводит водителя, назначает авто по умолчанию
// и роль. PIN по умолчанию — последние 4 цифры номера, его можно сбросить.

export default function AdminDrivers() {
  const { drivers, cars, shifts, acks, addDriver, updateDriver, removeDriver } = useStore();
  const [editing, setEditing] = useState<ProtoDriver | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ProtoDriver | null>(null);
  const [confirmReset, setConfirmReset] = useState<ProtoDriver | null>(null);
  const [createdPin, setCreatedPin] = useState<{ name: string; pin: string } | null>(null);

  const emptyForm = { lastName: '', firstName: '', phone: '', carId: cars[0]?.id ?? '', role: 'driver' as Role };
  const [form, setForm] = useState(emptyForm);

  const stats = useMemo(() => {
    const map: Record<string, { shifts: number; remarks: number; lastShift?: string }> = {};
    drivers.forEach((d) => {
      const own = shifts.filter((s) => s.driverId === d.id).sort((a, b) => (a.date < b.date ? 1 : -1));
      map[d.id] = {
        shifts: own.length,
        remarks: own.reduce((sum, s) => sum + s.remarks.length, 0),
        lastShift: own[0]?.date,
      };
    });
    return map;
  }, [drivers, shifts]);

  const canSubmit = form.lastName.trim() && form.firstName.trim() && onlyDigits(form.phone).length === 11;
  const activeCount = drivers.filter((d) => d.role === 'driver' && d.active).length;
  const adminCount = drivers.filter((d) => d.role === 'admin').length;

  function openNew() {
    setForm(emptyForm);
    setEditing('new');
  }

  function openEdit(d: ProtoDriver) {
    setForm({ lastName: d.lastName, firstName: d.firstName, phone: d.phone, carId: d.carId, role: d.role });
    setEditing(d);
  }

  function save() {
    if (!canSubmit) return;
    const base = {
      lastName: form.lastName.trim(),
      firstName: form.firstName.trim(),
      phone: form.phone,
      carId: form.role === 'admin' ? '' : form.carId,
      role: form.role,
    };
    if (editing === 'new') {
      const pin = pinFromPhone(form.phone);
      addDriver({ id: uid('d'), ...base, pin, active: true, hiredAt: todayISO() });
      setCreatedPin({ name: `${base.lastName} ${base.firstName}`, pin });
    } else if (editing) {
      // Номер поменялся — PIN по умолчанию тоже пересчитываем.
      const pinPatch = onlyDigits(form.phone) !== onlyDigits(editing.phone) ? { pin: pinFromPhone(form.phone) } : {};
      updateDriver(editing.id, { ...base, ...pinPatch });
    }
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-4 px-4 py-4">
      <div className="grid grid-cols-2 gap-3">
        <StatTile icon="users" value={activeCount} label="Активных водителей" />
        <StatTile icon="shield" value={adminCount} label="Администраторов" />
      </div>

      <SectionHeader
        title={`Аккаунты · ${drivers.length}`}
        action={
          <button onClick={openNew} className="p-btn p-btn-primary flex items-center gap-1.5 px-3.5 py-2 text-[11px]">
            <Icon name="plus" size={13} />
            Добавить
          </button>
        }
      />

      {drivers.length === 0 ? (
        <EmptyState icon="id-card" title="Аккаунтов нет" hint="Добавьте водителя — он сможет войти по номеру телефона и PIN." />
      ) : (
        <div className="flex flex-col gap-2">
          {drivers.map((d) => {
            const st = stats[d.id];
            const locked = st?.shifts > 0;
            const ack = acks.filter((a) => a.driverId === d.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
            return (
              <div key={d.id} className={'p-card p-4 ' + (d.active ? '' : 'opacity-60')}>
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#8fc640]/15 text-sm font-bold text-[#5e9128]">
                    {initials(d)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="text-sm font-bold">
                        {d.lastName} {d.firstName}
                      </p>
                      {d.role === 'admin' && <Pill tone="accent">админ</Pill>}
                      {!d.active && <Pill tone="bad">отключён</Pill>}
                    </div>
                    <p className="text-xs tabular-nums text-[#5c6066]">{d.phone}</p>
                    {d.role === 'driver' && <p className="truncate text-xs text-[#9a9d96]">{carLabel(cars, d.carId)}</p>}
                  </div>
                </div>

                {d.role === 'driver' && (
                  <div className="mt-3 grid grid-cols-3 gap-2 border-t border-[#e7e9e2] pt-3">
                    <div>
                      <p className="text-sm font-bold tabular-nums">{st?.shifts ?? 0}</p>
                      <p className="p-eyebrow mt-0.5">Смен</p>
                    </div>
                    <div>
                      <p className={'text-sm font-bold tabular-nums ' + ((st?.remarks ?? 0) > 0 ? 'text-[#96690f]' : '')}>
                        {st?.remarks ?? 0}
                      </p>
                      <p className="p-eyebrow mt-0.5">Замечаний</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold">{st?.lastShift ? formatDate(st.lastShift) : '—'}</p>
                      <p className="p-eyebrow mt-0.5">Последняя</p>
                    </div>
                  </div>
                )}

                {d.role === 'driver' && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    {ack ? (
                      <Pill tone={ack.score === ack.total ? 'good' : 'warn'}>
                        ТБ: {ack.score}/{ack.total} · {formatDate(ack.date)}
                      </Pill>
                    ) : (
                      <Pill tone="bad">ТБ не пройден</Pill>
                    )}
                  </div>
                )}

                <div className="mt-3 flex items-center gap-1 border-t border-[#e7e9e2] pt-2">
                  <IconButton icon="pencil" label="Изменить" onClick={() => openEdit(d)} />
                  <IconButton icon="key" label="Сбросить PIN" onClick={() => setConfirmReset(d)} />
                  <IconButton
                    icon="power"
                    label={d.active ? 'Отключить доступ' : 'Включить доступ'}
                    onClick={() => updateDriver(d.id, { active: !d.active })}
                  />
                  <span className="ml-auto" />
                  <IconButton icon="trash" label="Удалить" tone="danger" disabled={locked} onClick={() => setConfirmDelete(d)} />
                </div>

                {locked && (
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#9a9d96]">
                    По водителю есть смены — удалить нельзя, чтобы не потерять историю. Отключите доступ.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <Sheet
          icon="id-card"
          title={editing === 'new' ? 'Новый аккаунт' : 'Изменить аккаунт'}
          subtitle={editing === 'new' ? 'PIN сгенерируется из номера телефона' : `${editing.lastName} ${editing.firstName}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button onClick={() => setEditing(null)} className="p-btn p-btn-outline flex-1 py-3 text-xs">
                Отмена
              </button>
              <button onClick={save} disabled={!canSubmit} className="p-btn p-btn-primary flex-1 py-3 text-xs">
                Сохранить
              </button>
            </>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label="Фамилия" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="Ахметов" />
            <Field label="Имя" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="Данияр" />
            <Field
              label="Номер телефона"
              inputMode="tel"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
              placeholder="+7 ___ ___ __ __"
              hint={onlyDigits(form.phone).length === 11 ? `PIN для входа будет ${pinFromPhone(form.phone)}` : 'По номеру водитель входит в кабинет'}
            />
            <SelectField label="Роль" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}>
              <option value="driver">Водитель</option>
              <option value="admin">Администратор</option>
            </SelectField>
            {form.role === 'driver' && (
              <SelectField label="Авто по умолчанию" value={form.carId} onChange={(e) => setForm((f) => ({ ...f, carId: e.target.value }))}>
                {cars
                  .filter((c) => c.active)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.model} — {c.plate}
                    </option>
                  ))}
              </SelectField>
            )}
          </div>
        </Sheet>
      )}

      {createdPin && (
        <ConfirmDialog
          title="Аккаунт создан"
          message={`${createdPin.name} входит по своему номеру и PIN ${createdPin.pin}. Сообщите PIN лично.`}
          confirmLabel="Понятно"
          onCancel={() => setCreatedPin(null)}
          onConfirm={() => setCreatedPin(null)}
        />
      )}

      {confirmReset && (
        <ConfirmDialog
          title="Сбросить PIN?"
          message={`PIN станет ${pinFromPhone(confirmReset.phone)} — последние 4 цифры номера ${confirmReset.phone}.`}
          confirmLabel="Сбросить"
          onCancel={() => setConfirmReset(null)}
          onConfirm={() => {
            updateDriver(confirmReset.id, { pin: pinFromPhone(confirmReset.phone) });
            setConfirmReset(null);
          }}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Удалить аккаунт?"
          message={`${confirmDelete.lastName} ${confirmDelete.firstName} потеряет доступ к кабинету. Действие необратимо.`}
          onCancel={() => setConfirmDelete(null)}
          onConfirm={() => {
            removeDriver(confirmDelete.id);
            setConfirmDelete(null);
          }}
        />
      )}
    </div>
  );
}

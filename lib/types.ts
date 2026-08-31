export type Driver = { id: string; name: string; created_at: string };

export type NoteEntry = { text: string; photos: string[] };

export type ShiftInfo = {
  date: string;
  driverId: string;
  driverName: string;
  timeStart: string;
  timeEnd: string;
  placeStart: string;
  placeEnd: string;
  cars: string[];
  cashStart: string;
  cashEnd: string;
  cashExpenses: string;
  cashFines: string;
  odo: Record<string, { start: string; end: string }>;
};

export function emptyShiftInfo(): ShiftInfo {
  return {
    date: new Date().toISOString().slice(0, 10),
    driverId: '', driverName: '', timeStart: '', timeEnd: '', placeStart: '', placeEnd: '',
    cars: [], cashStart: '', cashEnd: '', cashExpenses: '', cashFines: '', odo: {},
  };
}

export type DraftData = {
  checked: Record<string, boolean>;
  notes: Record<string, NoteEntry>;
  shiftInfo: ShiftInfo;
  clientRequestId: string;
};

export function emptyDraft(clientRequestId: string): DraftData {
  return { checked: {}, notes: {}, shiftInfo: emptyShiftInfo(), clientRequestId };
}

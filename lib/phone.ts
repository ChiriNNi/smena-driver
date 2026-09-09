// Единая работа с номером телефона: он же логин водителя, поэтому формат
// должен считаться одинаково на клиенте (форма входа) и на сервере (поиск
// в БД, проверка уникальности при создании профиля).

/** Только цифры: «+7 701 234 56 78» → «77012345678». */
export function onlyDigits(v: string): string {
  return v.replace(/\D/g, '');
}

/**
 * Нормализованный вид для хранения и поиска: 11 цифр, начинается с 7.
 * Принимает +7…, 8…, 7… — водитель вводит как привык.
 * Возвращает null, если номер не похож на казахстанский мобильный.
 */
export function normalizePhone(raw: string): string | null {
  const d = onlyDigits(raw).replace(/^8/, '7');
  return /^7\d{10}$/.test(d) ? d : null;
}

/** «77012345678» → «+7 701 234 56 78» для отображения. */
export function formatPhone(digits: string): string {
  const d = onlyDigits(digits);
  if (!/^7\d{10}$/.test(d)) return digits;
  const r = d.slice(1);
  return `+7 ${r.slice(0, 3)} ${r.slice(3, 6)} ${r.slice(6, 8)} ${r.slice(8, 10)}`;
}

/** Форматирование по ходу набора в поле ввода — допускает неполный номер. */
export function formatPhoneInput(raw: string): string {
  const d = onlyDigits(raw).replace(/^8/, '7').slice(0, 11);
  if (!d) return '';
  let out = '+7';
  const rest = d.startsWith('7') ? d.slice(1) : d;
  if (rest.length > 0) out += ' ' + rest.slice(0, 3);
  if (rest.length > 3) out += ' ' + rest.slice(3, 6);
  if (rest.length > 6) out += ' ' + rest.slice(6, 8);
  if (rest.length > 8) out += ' ' + rest.slice(8, 10);
  return out;
}

/** PIN по умолчанию — последние 4 цифры номера (согласовано в спецификации). */
export function pinFromPhone(phone: string): string {
  return onlyDigits(phone).slice(-4);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

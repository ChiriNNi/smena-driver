import { redirect } from 'next/navigation';

// Кабинет живёт на /proto, пока идёт подключение к базе. После перевода
// прототипа на реальные данные страница станет самим кабинетом, а этот
// редирект уйдёт.
export default function Page() {
  redirect('/proto');
}

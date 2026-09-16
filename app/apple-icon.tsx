import { renderAppIcon } from '@/lib/app-icon';

// Иконка для iPhone: iOS берёт только PNG и сам добавляет скругление, поэтому
// поля нужны свои — без них логотип упирается в края.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return renderAppIcon(size.width);
}

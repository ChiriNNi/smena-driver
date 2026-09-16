import { renderAppIcon } from '@/lib/app-icon';

// Иконка для браузера и манифеста. 512×512 — максимальный размер, который
// просят Android и Chrome; меньшие они уменьшают сами.
export const size = { width: 512, height: 512 };
export const contentType = 'image/png';

export default function Icon() {
  return renderAppIcon(size.width);
}

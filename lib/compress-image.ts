// Единая функция сжатия фото (используется и для фото-заметок чек-листа, и для чеков расходов).
// В исходной версии этот код был продублирован дословно в двух местах.

const MAX_SIDE = 900;
const JPEG_QUALITY = 0.7;

export function compressImageToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Не удалось прочитать файл.'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Не удалось загрузить изображение.'));
      img.onload = () => {
        let { width, height } = img;
        if (width > MAX_SIDE || height > MAX_SIDE) {
          if (width > height) { height = Math.round((height * MAX_SIDE) / width); width = MAX_SIDE; }
          else { width = Math.round((width * MAX_SIDE) / height); height = MAX_SIDE; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas недоступен.')); return; }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
      };
      img.src = String(e.target?.result || '');
    };
    reader.readAsDataURL(file);
  });
}

/**
 * То же сжатие, но результат — файл для отправки на сервер.
 *
 * Фото с телефона весит 3–8 МБ, а по факту нужно показать скол на бампере:
 * после сжатия это 100–200 КБ, что важно и для мобильного интернета водителя,
 * и для места в хранилище.
 */
export async function compressImageToFile(file: File): Promise<File> {
  const dataUrl = await compressImageToDataURL(file);
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], 'photo.jpg', { type: 'image/jpeg' });
}

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { ImageResponse } from 'next/og';

// Иконки приложения на домашнем экране.
//
// В манифесте лежал один файл — логотип 1337×1289 без полей. Браузер его
// уменьшал сам, а на Android иконку обрезают до круга (maskable): прямоугольный
// логотип по краям срезался. Поэтому иконки собираются здесь: логотип
// вписывается в квадрат фирменного фона с полями, и внутри круга остаётся
// целиком.
//
// Картинки генерируются на сборке и дальше отдаются как обычные PNG.

/** Доля стороны под поля. Maskable-иконка гарантированно видна только в центральных 80%. */
const PADDING_RATIO = 0.19;

const LOGO_PATH = path.join(process.cwd(), 'public', 'ic-group-logo.png');

let logoDataUrl: string | undefined;

async function getLogo(): Promise<string> {
  if (!logoDataUrl) {
    const file = await readFile(LOGO_PATH);
    logoDataUrl = `data:image/png;base64,${file.toString('base64')}`;
  }
  return logoDataUrl;
}

/**
 * Квадратная иконка: логотип по центру белого поля.
 *
 * Фон именно белый, а не фирменный зелёный: логотип цветной, и на зелёном
 * подложке он теряет контраст.
 */
export async function renderAppIcon(size: number): Promise<ImageResponse> {
  const padding = Math.round(size * PADDING_RATIO);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
          padding,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse рисует картинку сам, компонент next/image здесь не работает */}
        <img src={await getLogo()} alt="IC Group" width={size - padding * 2} style={{ objectFit: 'contain' }} />
      </div>
    ),
    { width: size, height: size }
  );
}

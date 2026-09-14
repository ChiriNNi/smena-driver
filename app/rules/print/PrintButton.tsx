'use client';

/**
 * Открывает системный диалог печати. На компьютере и на телефоне в нём есть
 * «Сохранить как PDF» — отдельная генерация файла на сервере не нужна.
 */
export default function PrintButton() {
  return (
    <div className="no-print" style={{ marginBottom: 24, display: 'flex', gap: 8 }}>
      <button
        onClick={() => window.print()}
        style={{
          borderRadius: 999,
          background: '#8fc640',
          color: '#fff',
          border: 0,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Сохранить в PDF
      </button>
      <button
        onClick={() => window.close()}
        style={{
          borderRadius: 999,
          background: '#fff',
          color: '#1a1d1e',
          border: '1.5px solid #e7e9e2',
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 600,
          cursor: 'pointer',
        }}
      >
        Закрыть
      </button>
    </div>
  );
}

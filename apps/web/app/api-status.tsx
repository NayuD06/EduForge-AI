'use client';

import type { HealthDto } from '@eduforge/shared';
import { useEffect, useState } from 'react';
import { API_URL, api } from '@/lib/api';

/** Kiểm tra kết nối tới API – xóa khi đã có giao diện thật. */
export function ApiStatus() {
  const [health, setHealth] = useState<HealthDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((e: Error) => setError(e.message));
  }, []);

  return (
    <div className="rounded-lg border border-slate-300/60 p-4 text-sm">
      <p className="font-medium">API: {API_URL}</p>
      {error && <p className="text-red-500">Không kết nối được: {error}</p>}
      {!error && !health && <p className="text-slate-500">Đang kiểm tra…</p>}
      {health && (
        <ul className="mt-2 grid grid-cols-2 gap-1">
          {Object.entries(health.services).map(([name, state]) => (
            <li key={name}>
              {state === 'up' ? '🟢' : '🔴'} {name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

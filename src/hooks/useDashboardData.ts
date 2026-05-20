import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Anmerkungen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [anmerkungen, setAnmerkungen] = useState<Anmerkungen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [anmerkungenData] = await Promise.all([
        LivingAppsService.getAnmerkungen(),
      ]);
      setAnmerkungen(anmerkungenData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [anmerkungenData] = await Promise.all([
          LivingAppsService.getAnmerkungen(),
        ]);
        setAnmerkungen(anmerkungenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  return { anmerkungen, setAnmerkungen, loading, error, fetchAll };
}
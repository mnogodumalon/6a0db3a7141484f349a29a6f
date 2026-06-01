import { useDashboardData } from '@/hooks/useDashboardData';
import type { Anmerkungen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AnmerkungenDialog } from '@/components/dialogs/AnmerkungenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconPencil,
  IconTrash,
  IconFlag,
  IconPhoto,
  IconMessage,
  IconCircleDot,
  IconCircleCheck,
  IconCircleX,
  IconArrowRight,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a0db3a7141484f349a29a6f';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_COLUMNS = [
  { key: 'offen', label: 'Offen', icon: IconCircleDot, color: 'text-gray-400', bg: 'bg-white border-gray-200', badge: 'bg-gray-100 text-gray-600' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', icon: IconArrowRight, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700' },
  { key: 'geloest', label: 'Abgeschlossen', icon: IconCircleCheck, color: 'text-green-500', bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700' },
  { key: 'geschlossen', label: 'On Hold', icon: IconCircleX, color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-500' },
];

const PRIORITY_COLORS: Record<string, string> = {
  kritisch: 'text-red-500',
  hoch: 'text-orange-500',
  mittel: 'text-yellow-500',
  niedrig: 'text-muted-foreground',
};

export default function DashboardOverview() {
  const { anmerkungen, loading, error, fetchAll } = useDashboardData();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<Anmerkungen | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Anmerkungen | null>(null);

  const byStatus = useMemo(() => {
    const map: Record<string, Anmerkungen[]> = {};
    for (const col of STATUS_COLUMNS) map[col.key] = [];
    for (const a of anmerkungen) {
      const key = a.fields.status?.key ?? 'offen';
      if (map[key]) map[key].push(a);
      else map['offen'].push(a);
    }
    return map;
  }, [anmerkungen]);

  const handleCreate = async (fields: Anmerkungen['fields']) => {
    await LivingAppsService.createAnmerkungenEntry(fields);
    fetchAll();
  };

  const handleEdit = async (fields: Anmerkungen['fields']) => {
    if (!editRecord) return;
    await LivingAppsService.updateAnmerkungenEntry(editRecord.record_id, fields);
    fetchAll();
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await LivingAppsService.deleteAnmerkungenEntry(deleteTarget.record_id);
    setDeleteTarget(null);
    fetchAll();
  };

  const handleStatusChange = async (record: Anmerkungen, newStatus: string) => {
    await LivingAppsService.updateAnmerkungenEntry(record.record_id, { ...record.fields, status: newStatus as any });
    fetchAll();
  };

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plattform-Notizen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Feedback & Anmerkungen verwalten</p>
        </div>
        <Button onClick={() => { setEditRecord(null); setDialogOpen(true); }} className="shrink-0">
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          Neue Anmerkung
        </Button>
      </div>

      {/* Kanban Board */}
      {anmerkungen.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <IconMessage size={28} className="text-muted-foreground" stroke={1.5} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Noch keine Anmerkungen</p>
            <p className="text-sm text-muted-foreground mt-1">Erstelle deine erste Anmerkung</p>
          </div>
          <Button variant="outline" onClick={() => { setEditRecord(null); setDialogOpen(true); }}>
            <IconPlus size={16} className="mr-1.5" />Anmerkung erstellen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map(col => {
            const ColIcon = col.icon;
            const items = byStatus[col.key] ?? [];

            return (
              <div key={col.key} className="flex flex-col gap-3">
                {/* Column header */}
                <div className="flex items-center gap-2">
                  <ColIcon size={16} className={`shrink-0 ${col.color}`} />
                  <span className="font-semibold text-sm text-foreground">{col.label}</span>
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${col.badge}`}>{items.length}</span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 min-h-[80px]">
                  {items.length === 0 ? (
                    <div className="rounded-xl border-2 border-dashed border-border/60 flex items-center justify-center py-6 text-xs text-muted-foreground">
                      Keine Einträge
                    </div>
                  ) : (
                    items.map(record => (
                      <AnmerkungCard
                        key={record.record_id}
                        record={record}
                        statusColumns={STATUS_COLUMNS}
                        currentStatusKey={col.key}
                        colBg={col.bg}
                        onEdit={() => { setEditRecord(record); setDialogOpen(true); }}
                        onDelete={() => setDeleteTarget(record)}
                        onStatusChange={(newStatus) => handleStatusChange(record, newStatus)}
                      />
                    ))
                  )}
                </div>

                {/* Add button in each column */}
                <button
                  onClick={() => { setEditRecord(null); setDialogOpen(true); }}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-lg hover:bg-muted/60"
                >
                  <IconPlus size={13} className="shrink-0" />
                  Hinzufügen
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Dialogs */}
      <AnmerkungenDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditRecord(null); }}
        onSubmit={editRecord ? handleEdit : handleCreate}
        defaultValues={editRecord?.fields}
        enablePhotoScan={AI_PHOTO_SCAN['Anmerkungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Anmerkungen']}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Anmerkung löschen"
        description={`Möchtest du "${deleteTarget?.fields.beschreibung?.slice(0, 60) ?? 'diese Anmerkung'}" wirklich löschen?`}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

// ---- Sub-components ----

interface StatusColDef {
  key: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; stroke?: number }>;
  color: string;
  bg: string;
  badge: string;
}

interface AnmerkungCardProps {
  record: Anmerkungen;
  statusColumns: StatusColDef[];
  currentStatusKey: string;
  colBg: string;
  onEdit: () => void;
  onDelete: () => void;
  onStatusChange: (newStatus: string) => void;
}

function AnmerkungCard({ record, statusColumns, currentStatusKey, colBg, onEdit, onDelete, onStatusChange }: AnmerkungCardProps) {
  const prio = record.fields.prioritaet?.key ?? '';
  const prioColor = PRIORITY_COLORS[prio] ?? 'text-muted-foreground';
  const hasScreenshot = !!record.fields.screenshot;

  const title = record.fields.beschreibung
    ? (record.fields.beschreibung.split('\n')[0].trim() || record.fields.beschreibung.slice(0, 60))
    : '(Kein Titel)';

  const nextStatus = (() => {
    const idx = statusColumns.findIndex(c => c.key === currentStatusKey);
    return idx < statusColumns.length - 1 ? statusColumns[idx + 1] : null;
  })();

  return (
    <div className={`rounded-xl border p-3 flex flex-col gap-2 shadow-sm transition-shadow hover:shadow-md ${colBg}`}>
      {/* Top row: priority + date + screenshot icon */}
      <div className="flex items-center gap-2 min-w-0">
        {prio && (
          <div className="flex items-center gap-1 shrink-0">
            <IconFlag size={12} className={`shrink-0 ${prioColor}`} />
            <span className={`text-xs font-medium ${prioColor}`}>{record.fields.prioritaet?.label}</span>
          </div>
        )}
        <span className="ml-auto text-xs text-muted-foreground shrink-0">{formatDate(record.createdat)}</span>
        {hasScreenshot && <IconPhoto size={13} className="text-muted-foreground shrink-0" stroke={1.5} />}
      </div>

      {/* Title only */}
      <p className="text-sm font-medium text-foreground truncate min-w-0">{title}</p>

      {/* Actions row */}
      <div className="flex items-center gap-1.5 flex-wrap mt-1">
        {nextStatus && (
          <button
            onClick={() => onStatusChange(nextStatus.key)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-lg font-medium transition-colors ${nextStatus.badge} hover:opacity-80`}
          >
            <nextStatus.icon size={11} className="shrink-0" />
            {nextStatus.label}
          </button>
        )}
        <div className="flex items-center gap-1 ml-auto">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg hover:bg-black/5 transition-colors text-muted-foreground hover:text-foreground"
            title="Bearbeiten"
          >
            <IconPencil size={13} className="shrink-0" />
          </button>
          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            title="Löschen"
          >
            <IconTrash size={13} className="shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ---- Loading / Error states ----

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
      </div>
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  const [repairing, setRepairing] = useState(false);
  const [repairStatus, setRepairStatus] = useState('');
  const [repairDone, setRepairDone] = useState(false);
  const [repairFailed, setRepairFailed] = useState(false);

  const handleRepair = async () => {
    setRepairing(true);
    setRepairStatus('Reparatur wird gestartet...');
    setRepairFailed(false);

    const errorContext = JSON.stringify({
      type: 'data_loading',
      message: error.message,
      stack: (error.stack ?? '').split('\n').slice(0, 10).join('\n'),
      url: window.location.href,
    });

    try {
      const resp = await fetch(REPAIR_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ appgroup_id: APPGROUP_ID, error_context: errorContext }),
      });

      if (!resp.ok || !resp.body) {
        setRepairing(false);
        setRepairFailed(true);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith('data: ')) continue;
          const content = line.slice(6);
          if (content.startsWith('[STATUS]')) {
            setRepairStatus(content.replace(/^\[STATUS]\s*/, ''));
          }
          if (content.startsWith('[DONE]')) {
            setRepairDone(true);
            setRepairing(false);
          }
          if (content.startsWith('[ERROR]') && !content.includes('Dashboard-Links')) {
            setRepairFailed(true);
          }
        }
      }
    } catch {
      setRepairing(false);
      setRepairFailed(true);
    }
  };

  if (repairDone) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center">
          <IconCheck size={22} className="text-green-500" />
        </div>
        <div className="text-center">
          <h3 className="font-semibold text-foreground mb-1">Dashboard repariert</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Das Problem wurde behoben. Bitte lade die Seite neu.</p>
        </div>
        <Button size="sm" onClick={() => window.location.reload()}>
          <IconRefresh size={14} className="mr-1" />Neu laden
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">
          {repairing ? repairStatus : error.message}
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetry} disabled={repairing}>Erneut versuchen</Button>
        <Button size="sm" onClick={handleRepair} disabled={repairing}>
          {repairing
            ? <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1" />
            : <IconTool size={14} className="mr-1" />}
          {repairing ? 'Reparatur läuft...' : 'Dashboard reparieren'}
        </Button>
      </div>
      {repairFailed && <p className="text-sm text-destructive">Automatische Reparatur fehlgeschlagen. Bitte kontaktiere den Support.</p>}
    </div>
  );
}

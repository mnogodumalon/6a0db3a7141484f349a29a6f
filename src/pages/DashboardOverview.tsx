import { useDashboardData } from '@/hooks/useDashboardData';
import type { Anmerkungen } from '@/types/app';
import { LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, uploadFile } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { useState, useMemo, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AnmerkungenDialog } from '@/components/dialogs/AnmerkungenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  IconAlertCircle,
  IconTool,
  IconRefresh,
  IconCheck,
  IconPlus,
  IconTrash,
  IconFlag,
  IconPhoto,
  IconMessage,
  IconCircleDot,
  IconCircleCheck,
  IconCircleX,
  IconArrowRight,
  IconUpload,
} from '@tabler/icons-react';

const APPGROUP_ID = '6a0db3a7141484f349a29a6f';
const REPAIR_ENDPOINT = '/claude/build/repair';

const STATUS_COLUMNS = [
  { key: 'offen', label: 'Offen', icon: IconCircleDot, color: 'text-gray-400', bg: 'bg-white border-gray-200', badge: 'bg-gray-100 text-gray-600', dropHighlight: 'ring-2 ring-gray-300 bg-gray-50' },
  { key: 'in_bearbeitung', label: 'In Bearbeitung', icon: IconArrowRight, color: 'text-yellow-500', bg: 'bg-yellow-50 border-yellow-200', badge: 'bg-yellow-100 text-yellow-700', dropHighlight: 'ring-2 ring-yellow-300 bg-yellow-50' },
  { key: 'geloest', label: 'Abgeschlossen', icon: IconCircleCheck, color: 'text-green-500', bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', dropHighlight: 'ring-2 ring-green-300 bg-green-50' },
  { key: 'geschlossen', label: 'On Hold', icon: IconCircleX, color: 'text-gray-400', bg: 'bg-gray-50 border-gray-200', badge: 'bg-gray-100 text-gray-500', dropHighlight: 'ring-2 ring-gray-300 bg-gray-100' },
];

const PRIORITY_COLORS: Record<string, string> = {
  kritisch: 'text-red-500',
  hoch: 'text-orange-500',
  mittel: 'text-yellow-500',
  niedrig: 'text-muted-foreground',
};

const PRIO_OPTIONS = LOOKUP_OPTIONS['anmerkungen']?.['prioritaet'] ?? [];
const STATUS_OPTIONS = LOOKUP_OPTIONS['anmerkungen']?.['status'] ?? [];

export default function DashboardOverview() {
  const { anmerkungen, loading, error, fetchAll } = useDashboardData();

  // Create dialog
  const [createOpen, setCreateOpen] = useState(false);

  // Detail panel state
  const [detailRecord, setDetailRecord] = useState<Anmerkungen | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrio, setEditPrio] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editScreenshot, setEditScreenshot] = useState('');
  const [savingDetail, setSavingDetail] = useState(false);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);


  // Drag-and-drop state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

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

  const openDetail = useCallback((record: Anmerkungen) => {
    const lines = (record.fields.beschreibung ?? '').split('\n');
    const title = lines[0]?.trim() ?? '';
    const desc = lines.slice(1).join('\n').trim();
    setEditTitle(title);
    setEditDesc(desc);
    setEditPrio(record.fields.prioritaet?.key ?? '');
    setEditStatus(record.fields.status?.key ?? 'offen');
    setEditScreenshot(record.fields.screenshot ?? '');
    setDetailRecord(record);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailRecord(null);
  }, []);

  const handleCreate = async (fields: Anmerkungen['fields']) => {
    await LivingAppsService.createAnmerkungenEntry({ ...fields, status: 'offen' } as any);
    fetchAll();
  };

  const handleDetailSave = async () => {
    if (!detailRecord) return;
    setSavingDetail(true);
    try {
      const beschreibung = editDesc.trim()
        ? `${editTitle}\n${editDesc}`
        : editTitle;
      await LivingAppsService.updateAnmerkungenEntry(detailRecord.record_id, {
        beschreibung,
        prioritaet: editPrio || undefined,
        status: editStatus || undefined,
        screenshot: editScreenshot || undefined,
      } as any);
      fetchAll();
      setDetailRecord(null);
    } finally {
      setSavingDetail(false);
    }
  };

  const handleDetailDelete = async () => {
    if (!detailRecord) return;
    await LivingAppsService.deleteAnmerkungenEntry(detailRecord.record_id);
    setDetailRecord(null);
    fetchAll();
  };

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingScreenshot(true);
    try {
      const url = await uploadFile(file);
      setEditScreenshot(url);
    } finally {
      setUploadingScreenshot(false);
      e.target.value = '';
    }
  };

  const handleStatusChange = async (record: Anmerkungen, newStatus: string) => {
    await LivingAppsService.updateAnmerkungenEntry(record.record_id, {
      ...record.fields,
      status: newStatus,
    } as any);
    fetchAll();
  };

  const handleDrop = async (colKey: string) => {
    setDragOverCol(null);
    if (!dragId || !colKey) return;
    const record = anmerkungen.find(a => a.record_id === dragId);
    if (!record) return;
    if ((record.fields.status?.key ?? 'offen') === colKey) return;
    setDragId(null);
    await handleStatusChange(record, colKey);
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
        <Button onClick={() => setCreateOpen(true)} className="shrink-0">
          <IconPlus size={16} className="mr-1.5 shrink-0" />
          Ticket hinzufügen
        </Button>
      </div>

      {/* Kanban Board */}
      {anmerkungen.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center">
            <IconMessage size={28} className="text-muted-foreground" stroke={1.5} />
          </div>
          <div className="text-center">
            <p className="font-semibold text-foreground">Noch keine Tickets</p>
            <p className="text-sm text-muted-foreground mt-1">Erstelle dein erstes Ticket</p>
          </div>
          <Button variant="outline" onClick={() => setCreateOpen(true)}>
            <IconPlus size={16} className="mr-1.5" />Ticket erstellen
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUS_COLUMNS.map(col => {
            const ColIcon = col.icon;
            const items = byStatus[col.key] ?? [];
            const isOver = dragOverCol === col.key;

            return (
              <div
                key={col.key}
                className="flex flex-col gap-3"
                onDragOver={(e) => { e.preventDefault(); setDragOverCol(col.key); }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    setDragOverCol(null);
                  }
                }}
                onDrop={(e) => { e.preventDefault(); handleDrop(col.key); }}
              >
                {/* Column header */}
                <div className="flex items-center gap-2">
                  <ColIcon size={16} className={`shrink-0 ${col.color}`} />
                  <span className="font-semibold text-sm text-foreground">{col.label}</span>
                  <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${col.badge}`}>{items.length}</span>
                </div>

                {/* Drop zone */}
                <div className={`flex flex-col gap-2 min-h-[80px] rounded-xl transition-all ${isOver ? col.dropHighlight : ''}`}>
                  {items.length === 0 ? (
                    <div className={`rounded-xl border-2 border-dashed flex items-center justify-center py-6 text-xs text-muted-foreground transition-colors ${isOver ? 'border-primary/40 bg-primary/5' : 'border-border/60'}`}>
                      {isOver ? 'Hierher ziehen' : 'Keine Einträge'}
                    </div>
                  ) : (
                    items.map(record => (
                      <TicketCard
                        key={record.record_id}
                        record={record}
                        colBg={col.bg}
                        isDragging={dragId === record.record_id}
                        onClick={() => openDetail(record)}
                        onDragStart={() => setDragId(record.record_id)}
                        onDragEnd={() => { setDragId(null); setDragOverCol(null); }}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog (default status = offen) */}
      <AnmerkungenDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
        defaultValues={{ status: 'offen' } as any}
        enablePhotoScan={AI_PHOTO_SCAN['Anmerkungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Anmerkungen']}
      />

      {/* Detail Panel (Sheet) */}
      <Sheet open={!!detailRecord} onOpenChange={(open) => { if (!open) closeDetail(); }}>
        <SheetContent side="right" className="w-full sm:max-w-lg flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle className="text-base">Ticket-Details</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Titel */}
            <div className="space-y-1.5">
              <Label htmlFor="detail-titel">Titel</Label>
              <Input
                id="detail-titel"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titel eingeben..."
              />
            </div>

            {/* Beschreibung */}
            <div className="space-y-1.5">
              <Label htmlFor="detail-desc">Beschreibung</Label>
              <Textarea
                id="detail-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Beschreibung eingeben..."
                rows={4}
                className="resize-none"
              />
            </div>

            {/* Screenshot */}
            <div className="space-y-2">
              <Label>Screenshot</Label>
              {editScreenshot ? (
                <div className="relative rounded-xl overflow-hidden border border-border">
                  <img
                    src={editScreenshot}
                    alt="Screenshot"
                    className="w-full object-contain max-h-48"
                  />
                  <button
                    onClick={() => setEditScreenshot('')}
                    className="absolute top-2 right-2 p-1 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    title="Screenshot entfernen"
                  >
                    <IconTrash size={13} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-6 cursor-pointer hover:bg-muted/40 transition-colors">
                  {uploadingScreenshot ? (
                    <span className="inline-block w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                  ) : (
                    <IconUpload size={20} className="text-muted-foreground" stroke={1.5} />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {uploadingScreenshot ? 'Wird hochgeladen...' : 'Screenshot hochladen'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleScreenshotUpload}
                    disabled={uploadingScreenshot}
                  />
                </label>
              )}
            </div>

            <Separator />

            {/* Priorität */}
            <div className="space-y-1.5">
              <Label>Priorität</Label>
              <Select value={editPrio} onValueChange={setEditPrio}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Priorität wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {PRIO_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Status wählen..." />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.key} value={opt.key}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 flex items-center gap-2 flex-wrap">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleDetailDelete}
              disabled={savingDetail}
            >
              <IconTrash size={14} className="mr-1.5 shrink-0" />
              Löschen
            </Button>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={closeDetail} disabled={savingDetail}>
              Abbrechen
            </Button>
            <Button size="sm" onClick={handleDetailSave} disabled={savingDetail}>
              {savingDetail ? (
                <span className="inline-block w-3.5 h-3.5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin mr-1.5" />
              ) : null}
              Speichern
            </Button>
          </div>
        </SheetContent>
      </Sheet>

    </div>
  );
}

// ---- TicketCard ----

interface TicketCardProps {
  record: Anmerkungen;
  colBg: string;
  isDragging: boolean;
  onClick: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

function TicketCard({ record, colBg, isDragging, onClick, onDragStart, onDragEnd }: TicketCardProps) {
  const prio = record.fields.prioritaet?.key ?? '';
  const prioColor = PRIORITY_COLORS[prio] ?? 'text-muted-foreground';
  const hasScreenshot = !!record.fields.screenshot;

  const lines = (record.fields.beschreibung ?? '').split('\n');
  const title = lines[0]?.trim() || '(Kein Titel)';

  return (
    <div
      className={`rounded-xl border p-3 flex flex-col gap-2 shadow-sm cursor-pointer transition-all select-none ${colBg} ${isDragging ? 'opacity-40 scale-95' : 'hover:shadow-md'}`}
      draggable
      onClick={onClick}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', record.record_id);
        e.dataTransfer.effectAllowed = 'move';
        onDragStart();
      }}
      onDragEnd={onDragEnd}
    >
      {/* Top row */}
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

      {/* Title */}
      <p className="text-sm font-medium text-foreground truncate min-w-0">{title}</p>
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

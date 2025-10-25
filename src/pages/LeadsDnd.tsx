
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Pencil, Trash2, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

// Note: This file depends on @dnd-kit packages. Install them to use this page:
// npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type KanbanColumn = { id: number; board_id: number; title: string; position: number };
type KanbanCard = { id: number; column_id: number; title: string; content?: string | null; position: number; metadata?: { phone?: string } | null };

// truncate text to max characters without cutting a word in half if possible
function truncateByWord(text: string | null | undefined, max = 200) {
  const s = (text || "").trim();
  if (!s) return "";
  if (s.length <= max) return s;
  const slice = s.slice(0, max);
  const lastSpace = slice.lastIndexOf(" ");
  if (lastSpace > 0) return slice.slice(0, lastSpace) + "...";
  return slice + "...";
}

function SortableCard({ id, card, onUpdateContent, onOpenEdit, onDelete, isActive, isHighlighted }: { id: string; card: KanbanCard; onUpdateContent: (cardId: number, content: string) => Promise<void>; onOpenEdit: (card: KanbanCard) => void; onDelete: (cardId: number) => void; isActive?: boolean; isHighlighted?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState<string>(card.content || "");
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // keep local value in sync when card changes
  useEffect(() => {
    setValue(card.content || "");
  }, [card.content]);

  async function doSave() {
    await onUpdateContent(card.id, value);
    setEditing(false);
  }

  const activeCls = isActive ? "opacity-80 bg-gradient-to-r from-emerald-50 to-transparent" : "";
  const highlightCls = isHighlighted ? "ring-2 ring-amber-400/80 bg-amber-50/30" : "";

  return (
    <div id={`lead-${card.id}`} ref={setNodeRef} style={style} {...attributes} {...listeners} className={`p-2 rounded-lg relative border-2 border-emerald-600/30 bg-muted ${activeCls} ${highlightCls}`}>
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button type="button" title="Editar" className="p-1 rounded hover:bg-accent/50" onClick={(e) => { e.stopPropagation(); onOpenEdit(card); }}>
          <Pencil className="h-4 w-4 text-muted-foreground" />
        </button>
        <button type="button" title="Ver descrição" className="p-1 rounded hover:bg-accent/50" onClick={(e) => { e.stopPropagation(); setIsPreviewOpen(true); }}>
          <Eye className="h-4 w-4 text-muted-foreground" />
        </button>
        <button type="button" title="Excluir" className="p-1 rounded hover:bg-accent/50" onClick={(e) => { e.stopPropagation(); onDelete(card.id); }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </button>
      </div>
      <div className="font-medium">{card.title}</div>
      {/* show phone under title if present in metadata */}
      {(() => {
        const phone = card.metadata?.phone;
        return phone ? <div className="text-sm text-muted-foreground">{phone}</div> : null;
      })()}
      {editing ? (
        <div className="mt-2 relative">
              <textarea
                maxLength={200}
                className="w-full rounded border px-2 py-1 text-sm resize-y"
                rows={3}
                value={value}
                onChange={(e) => setValue((e.target as HTMLTextAreaElement).value)}
                autoFocus
              />
              <div className="absolute right-2 bottom-2 text-xs">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium transition-colors duration-200 ${value.length > 190 ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : value.length > 160 ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-muted-foreground/70 bg-white/0'}`}>{value.length}/200</span>
              </div>
          <div className="mt-8 flex gap-2">
            <Button size="sm" onClick={doSave}>Salvar</Button>
            <Button size="sm" variant="ghost" onClick={() => { setEditing(false); setValue(card.content || ""); }}>Cancelar</Button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground cursor-text truncate whitespace-nowrap overflow-hidden" onClick={() => setEditing(true)}>
          {card.content || <span className="italic text-slate-400">Adicionar descrição...</span>}
        </div>
      )}

      {/* Preview dialog for full description */}
      <Dialog open={isPreviewOpen} onOpenChange={(open) => setIsPreviewOpen(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descrição</DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-auto">
            <div className="text-sm whitespace-pre-wrap break-words break-all text-muted-foreground">
              {card.content || "(Sem descrição)"}
            </div>
          </div>
          <DialogFooter>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsPreviewOpen(false)}>Fechar</Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const LeadsDnd: React.FC = () => {
  const qc = useQueryClient();
  // each column will manage its own input locally inside Column
  const sensor = useSensor(PointerSensor, { activationConstraint: { distance: 5 } });
  const sensors = useSensors(sensor);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCard, setActiveCard] = useState<KanbanCard | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [highlightCardId, setHighlightCardId] = useState<number | null>(null);

  const { data: columns = [] } = useQuery<KanbanColumn[]>({
    queryKey: ["kanban", "columns"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("kanban_columns").select("*").order("position", { ascending: true });
      return (data || []) as KanbanColumn[];
    },
  });

  const { data: cards = [] } = useQuery<KanbanCard[]>({
    queryKey: ["kanban", "cards"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("kanban_cards").select("*").order("position", { ascending: true });
      return (data || []) as KanbanCard[];
    },
  });

  // handle highlight from URL param (e.g. ?highlight=123)
  useEffect(() => {
    const val = searchParams.get("highlight");
    if (!val) return;
    const id = Number(val);
    if (!id) return;
    // wait a tick for DOM to paint
    setTimeout(() => {
      const el = document.getElementById(`lead-${id}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        setHighlightCardId(id);
        // clear highlight and remove param after a bit
        setTimeout(() => {
          setHighlightCardId(null);
          // remove param
          const sp = new URLSearchParams(searchParams);
          sp.delete("highlight");
          setSearchParams(sp, { replace: true });
        }, 1800);
      }
    }, 120);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const mapping = useMemo(() => {
    const map: Record<number, number[]> = {};
    columns.forEach((c) => (map[c.id] = []));
    cards.forEach((card) => {
      map[card.column_id] = map[card.column_id] || [];
      map[card.column_id].push(card.id);
    });
    return map;
  }, [columns, cards]);

  const [itemsByColumn, setItemsByColumn] = useState<Record<number, number[]>>(mapping);
  useEffect(() => setItemsByColumn(mapping), [mapping]);

  async function persistMove(cardId: number, toColumnId: number, toIndex: number) {
    try {
      await (supabase as any)
        .from("kanban_cards")
        .update({ column_id: toColumnId, position: toIndex, updated_at: new Date().toISOString() })
        .eq("id", cardId);
      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
    } catch (err) {
      console.error(err);
      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const clearActive = () => {
      setActiveId(null);
      setActiveCard(null);
    };

    if (!over) {
      clearActive();
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    // activeId like `card-<id>`, overId can be `card-<id>` or `col-<colId>`
    if (!activeId.startsWith("card-")) {
      clearActive();
      return;
    }
    const activeCardId = Number(activeId.split("-")[1]);

    if (overId.startsWith("col-")) {
      const targetCol = Number(overId.split("-")[1]);
      setItemsByColumn((prev) => {
        const next = Object.fromEntries(Object.entries(prev).map(([k, v]) => [Number(k), [...v]])) as Record<number, number[]>;
        for (const k of Object.keys(next)) {
          const arr = next[Number(k)];
          const idx = arr.indexOf(activeCardId);
          if (idx !== -1) { arr.splice(idx, 1); break; }
        }
        next[targetCol].push(activeCardId);
        persistMove(activeCardId, targetCol, next[targetCol].length - 1);
        return next;
      });
      clearActive();
      return;
    }

    if (overId.startsWith("card-")) {
      const overCardId = Number(overId.split("-")[1]);
      let source = -1;
      let target = -1;
      Object.entries(itemsByColumn).forEach(([k, v]) => {
        if (v.includes(activeCardId)) source = Number(k);
        if (v.includes(overCardId)) target = Number(k);
      });
      if (source === -1 || target === -1) {
        clearActive();
        return;
      }

      setItemsByColumn((prev) => {
        const next = Object.fromEntries(Object.entries(prev).map(([k, v]) => [Number(k), [...v]])) as Record<number, number[]>;
        const fromArr = next[source];
        const toArr = next[target];
        const fromIndex = fromArr.indexOf(activeCardId);
        const toIndex = toArr.indexOf(overCardId);
        if (fromIndex === -1 || toIndex === -1) {
          return prev;
        }
        fromArr.splice(fromIndex, 1);
        toArr.splice(toIndex, 0, activeCardId);
        persistMove(activeCardId, target, toIndex);
        return next;
      });
    }
    // clear active drag state
    clearActive();
  }

  // set active on drag start
  function handleDragStart(event: any) {
    const id = String(event.active.id);
    setActiveId(id);
    // active id is like `card-<id>`; find the underlying card object
    if (id.startsWith("card-")) {
      const cid = Number(id.split("-")[1]);
      const found = cards.find((c) => c.id === cid) || null;
      setActiveCard(found);
    } else {
      setActiveCard(null);
    }
  }

  // modal state for adding
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addingColumnId, setAddingColumnId] = useState<number | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addContent, setAddContent] = useState("");
  const [addPhone, setAddPhone] = useState("");

  async function createCard(columnId: number, title?: string, content?: string, phone?: string) {
    const t = (title || "").trim();
    if (!t) return;
    const payload: any = { column_id: columnId, title: t, content: content || null, position: 9999 };
    if (phone && phone.trim()) payload.metadata = { phone: phone.trim() };
    await (supabase as any).from("kanban_cards").insert(payload);
    qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
  }

  async function updateContent(cardId: number, content: string) {
    try {
      // truncate to limit and optimistic update
      const contentToSave = truncateByWord(content, 200);
      qc.setQueryData<KanbanCard[] | undefined>(["kanban", "cards"], (old) => {
        if (!old) return old;
        return old.map((c) => (c.id === cardId ? { ...c, content: contentToSave } : c));
      });

      await (supabase as any)
        .from("kanban_cards")
        .update({ content: contentToSave, updated_at: new Date().toISOString() })
        .eq("id", cardId);

      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
    } catch (err) {
      console.error(err);
      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
    }
  }

  // edit modal state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<KanbanCard | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editContent, setEditContent] = useState("");

  function openEditModal(card: KanbanCard) {
    setEditingCard(card);
    setEditTitle(card.title || "");
    const meta = card.metadata || {};
    setEditPhone(meta.phone || "");
    setEditContent(card.content || "");
    setIsEditOpen(true);
  }

  async function saveEdit() {
    if (!editingCard) return;
    try {
      const contentToSave = truncateByWord(editContent, 200);
      // sanitize phone to digits-only before saving
      const phoneSan = (editPhone || "").replace(/\D/g, "");
      await (supabase as any)
        .from("kanban_cards")
        .update({ title: editTitle, content: contentToSave, metadata: { ...((editingCard?.metadata || {}) as any), phone: phoneSan }, updated_at: new Date().toISOString() })
        .eq("id", editingCard.id);
      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
    } catch (err) {
      console.error(err);
    } finally {
      setIsEditOpen(false);
      setEditingCard(null);
    }
  }

  const { toast } = useToast();
  // simple phone validation: accept if digits count between 8 and 15
  function isValidPhone(phone: string) {
    const digits = (phone || "").replace(/\D/g, "");
    return digits.length === 0 || (digits.length >= 8 && digits.length <= 15);
  }
  // delete modal state (we use a modal confirmation instead of toast)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [deletingCardId, setDeletingCardId] = useState<number | null>(null);

  async function deleteCard(cardId: number | null) {
    if (cardId == null) return;
    // capture deleted card from cache for undo
    const cached = qc.getQueryData<KanbanCard[] | undefined>(["kanban","cards"]);
    const deletedCard = cached?.find(c => c.id === cardId) || null;

    const { error } = await (supabase as any).from('kanban_cards').delete().eq('id', cardId);
    if (error) {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
      // still invalidate to refresh
      qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
      return;
    }
    // optimistic update: remove the card from the cached cards list so UI updates immediately
    qc.setQueryData<KanbanCard[] | undefined>(["kanban", "cards"], (old) => {
      if (!old) return old;
      return old.filter((c) => c.id !== cardId);
    });
    // also update local column items map to remove the id immediately
    setItemsByColumn((prev) => {
      const next = Object.fromEntries(Object.entries(prev).map(([k, v]) => [k, v.filter((id) => id !== cardId)]));
      return next as Record<number, number[]>;
    });

    // show brief confirmation toast (no undo)
    toast({ title: 'Card excluído', description: 'O lead foi removido.' });
    qc.invalidateQueries({ queryKey: ["kanban", "cards"] });
  }

  function openDeleteModal(cardId: number) {
    setDeletingCardId(cardId);
    setIsDeleteOpen(true);
  }

  function closeDeleteModal() {
    setIsDeleteOpen(false);
    setDeletingCardId(null);
  }

  // Column component with droppable area
  function Column({ col }: { col: KanbanColumn }) {
    const { setNodeRef } = useDroppable({ id: `col-${col.id}` });
    return (
      <div key={col.id} className="w-80 flex-shrink-0">
        <Card className="p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold">{col.title}</h3>
            <span className="text-sm text-muted-foreground">{(itemsByColumn[col.id] || []).length}</span>
          </div>

          <div ref={setNodeRef} className="space-y-2 min-h-[120px]" id={`col-${col.id}`}>
            <SortableContext items={(itemsByColumn[col.id] || []).map((id) => `card-${id}`)} strategy={verticalListSortingStrategy}>
              {(itemsByColumn[col.id] || []).map((cardId) => {
                const card = cards.find((c) => c.id === cardId)!;
                return <SortableCard key={`card-${cardId}`} id={`card-${cardId}`} card={card} onUpdateContent={updateContent} onOpenEdit={(c) => openEditModal(c)} onDelete={(id) => openDeleteModal(id)} isActive={activeId === `card-${cardId}`} isHighlighted={highlightCardId === cardId} />;
              })}
            </SortableContext>
          </div>

          <div className="mt-3">
            <div className="mt-2 flex gap-2">
              <Button onClick={() => { setAddingColumnId(col.id); setIsAddOpen(true); }}>Adicionar</Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Leads (CRM)</h1>
          <p className="text-muted-foreground">Arraste leads entre colunas.</p>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
          <div className="flex gap-4 overflow-x-auto py-4">
            {columns.map((col) => (
              <Column key={col.id} col={col} />
            ))}
          </div>

          <DragOverlay dropAnimation={{ duration: 160, easing: 'ease' }}>
              {activeCard ? (
                <div className="pointer-events-none select-none w-80 p-3 rounded-lg ring-2 ring-emerald-500/65 bg-slate-900 text-white shadow-2xl opacity-100 border border-transparent">
                  <div className="font-medium text-sm mb-1">{activeCard.title}</div>
                  <div className="text-xs text-muted-foreground truncate whitespace-nowrap overflow-hidden">
                    {activeCard.content ? activeCard.content : <span className="italic text-slate-400">Adicionar descrição...</span>}
                  </div>
                </div>
              ) : null}
          </DragOverlay>
        </DndContext>
        <Dialog open={isAddOpen} onOpenChange={(open) => setIsAddOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Lead</DialogTitle>
            </DialogHeader>

              <div className="space-y-2 mt-2">
              <label className="block text-sm font-medium">Nome</label>
              <Input value={addTitle} onChange={(e) => setAddTitle((e.target as HTMLInputElement).value)} />
              <label className="block text-sm font-medium">Telefone</label>
              <Input value={addPhone} onChange={(e) => setAddPhone((e.target as HTMLInputElement).value)} />
              {!isValidPhone(addPhone) && addPhone.trim().length > 0 ? <div className="text-xs text-destructive">Telefone inválido. Use apenas dígitos (8–15 dígitos).</div> : null}
              <label className="block text-sm font-medium">Descrição</label>
                <div className="relative">
                  <textarea maxLength={200} className="w-full rounded border px-2 py-1 text-sm resize-y" rows={5} value={addContent} onChange={(e) => setAddContent((e.target as HTMLTextAreaElement).value)} />
                  <div className="absolute right-2 bottom-2 text-xs">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium transition-colors duration-200 ${addContent.length > 190 ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : addContent.length > 160 ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-muted-foreground/70 bg-white/0'}`}>{addContent.length}/200</span>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <div className="flex gap-2">
                  <Button disabled={!addTitle.trim() || !isValidPhone(addPhone)} onClick={() => { if (addingColumnId) createCard(addingColumnId, addTitle, truncateByWord(addContent, 200), addPhone); setIsAddOpen(false); setAddingColumnId(null); setAddTitle(""); setAddContent(""); setAddPhone(""); }}>Salvar</Button>
                  <Button variant="ghost" onClick={() => { setIsAddOpen(false); setAddingColumnId(null); }}>Cancelar</Button>
                </div>
              </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={isEditOpen} onOpenChange={(open) => setIsEditOpen(open)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Lead</DialogTitle>
            </DialogHeader>

            <div className="space-y-2 mt-2">
              <label className="block text-sm font-medium">Nome</label>
              <Input value={editTitle} onChange={(e) => setEditTitle((e.target as HTMLInputElement).value)} />
              <label className="block text-sm font-medium">Telefone</label>
              <Input value={editPhone} onChange={(e) => setEditPhone((e.target as HTMLInputElement).value)} />
              <label className="block text-sm font-medium">Descrição</label>
              <div className="relative">
                <textarea maxLength={200} className="w-full rounded border px-2 py-1 text-sm resize-y" rows={5} value={editContent} onChange={(e) => setEditContent((e.target as HTMLTextAreaElement).value)} />
                <div className="absolute right-2 bottom-2 text-xs">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium transition-colors duration-200 ${editContent.length > 190 ? 'text-red-500 bg-red-50 dark:bg-red-900/30' : editContent.length > 160 ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20' : 'text-muted-foreground/70 bg-white/0'}`}>{editContent.length}/200</span>
                </div>
              </div>
            </div>

            <DialogFooter>
              <div className="flex gap-2">
                <Button onClick={() => saveEdit()}>Salvar</Button>
                <Button variant="ghost" onClick={() => { setIsEditOpen(false); setEditingCard(null); }}>Cancelar</Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Delete confirmation modal */}
        <Dialog open={isDeleteOpen} onOpenChange={(open) => { if (!open) closeDeleteModal(); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmar exclusão</DialogTitle>
            </DialogHeader>

            <div className="mt-2">
              <p>Tem certeza que deseja excluir este lead? Esta ação não pode ser desfeita.</p>
            </div>

        <DialogFooter>
            <div className="flex gap-2">
              <Button variant="destructive" onClick={() => { closeDeleteModal(); void deleteCard(deletingCardId); }}>Excluir</Button>
              <Button variant="ghost" onClick={() => closeDeleteModal()}>Cancelar</Button>
            </div>
          </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
};

export default LeadsDnd;

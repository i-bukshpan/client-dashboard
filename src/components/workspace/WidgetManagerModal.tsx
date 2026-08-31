'use client'

import { useState, useId } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  GripVertical,
  Pencil,
  Trash2,
  Maximize2,
  Plus,
  Search,
  CreditCard,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Table as TableIcon,
  Layers,
  Sparkles,
  Check,
} from 'lucide-react'
import type { DashboardWidget, WidgetType } from '@/types/dashboard'

interface WidgetManagerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  widgets: DashboardWidget[]
  onReorder: (newWidgets: DashboardWidget[]) => void
  onEditWidget: (widget: DashboardWidget) => void
  onDeleteWidget: (widgetId: string) => void
  onAddWidget: () => void
  onCycleWidth: (widgetId: string) => void
}

const TYPE_CONFIG: Record<
  WidgetType,
  { label: string; icon: any; color: string }
> = {
  stat_card: { label: 'כרטיס מדד', icon: CreditCard, color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  bar_chart: { label: 'תרשים עמודות', icon: BarChart3, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  line_chart: { label: 'תרשים קווי', icon: LineChartIcon, color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  pie_chart: { label: 'תרשים עוגה', icon: PieChartIcon, color: 'bg-purple-50 text-purple-700 border-purple-200' },
  data_table: { label: 'טבלת נתונים', icon: TableIcon, color: 'bg-amber-50 text-amber-700 border-amber-200' },
}

function SortableWidgetItem({
  widget,
  onEdit,
  onDelete,
  onCycleWidth,
}: {
  widget: DashboardWidget
  onEdit: (w: DashboardWidget) => void
  onDelete: (id: string) => void
  onCycleWidth: (id: string) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const typeInfo = TYPE_CONFIG[widget.type] || TYPE_CONFIG.stat_card
  const IconComponent = typeInfo.icon
  const widthVal = widget.position?.w || 1

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        flex items-center justify-between gap-3 p-3 rounded-xl border bg-card transition-all duration-200 select-none
        ${
          isDragging
            ? 'opacity-40 border-violet-500 shadow-xl ring-2 ring-violet-500/30'
            : 'border-border/70 hover:border-border hover:shadow-xs'
        }
      `}
    >
      {/* Drag handle & Main info */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <button
          type="button"
          {...attributes}
          {...listeners}
          className="p-1 text-muted-foreground/50 hover:text-foreground cursor-grab active:cursor-grabbing shrink-0 transition-colors"
          title="גרור כדי לשנות סדר"
        >
          <GripVertical className="w-4 h-4" />
        </button>

        <div className="w-8 h-8 rounded-lg bg-muted/60 flex items-center justify-center shrink-0 border border-border/50">
          <IconComponent className="w-4 h-4 text-foreground/70" />
        </div>

        <div className="min-w-0 flex-1 text-right">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="text-xs font-bold text-foreground truncate">
              {widget.title}
            </h4>
            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 font-medium ${typeInfo.color}`}>
              {typeInfo.label}
            </Badge>
            {widget.tab && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-muted text-muted-foreground">
                טאב: {widget.tab}
              </Badge>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
            מקור: <span className="font-semibold text-foreground/80">{widget.sheet}</span>
            {widget.y_column && ` · עמודה: ${widget.y_column}`}
            {widget.x_column && ` · ציר X: ${widget.x_column}`}
          </p>
        </div>
      </div>

      {/* Action controls on right */}
      <div className="flex items-center gap-1.5 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onCycleWidth(widget.id)}
          className="h-7 px-2 text-[11px] font-bold gap-1 text-foreground hover:bg-muted border-border/80"
          title="שנה רוחב (1 עד 4 עמודות)"
        >
          <Maximize2 className="w-3 h-3 text-violet-600" />
          רוחב {widthVal}
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onEdit(widget)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground hover:bg-muted"
          title="ערוך ווידג'ט"
        >
          <Pencil className="w-3.5 h-3.5 text-amber-600" />
        </Button>

        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => onDelete(widget.id)}
          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
          title="מחק ווידג'ט"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}

export function WidgetManagerModal({
  open,
  onOpenChange,
  widgets,
  onReorder,
  onEditWidget,
  onDeleteWidget,
  onAddWidget,
  onCycleWidth,
}: WidgetManagerModalProps) {
  const dndContextId = useId()
  const [activeId, setActiveId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [selectedTab, setSelectedTab] = useState('all')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const tabs = Array.from(new Set(widgets.map((w) => w.tab || 'ראשי')))

  const filteredWidgets = widgets.filter((w) => {
    const matchSearch =
      !search ||
      w.title.toLowerCase().includes(search.toLowerCase()) ||
      w.sheet.toLowerCase().includes(search.toLowerCase())
    const matchTab = selectedTab === 'all' || (w.tab || 'ראשי') === selectedTab
    return matchSearch && matchTab
  })

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)

    if (over && active.id !== over.id) {
      const oldIndex = widgets.findIndex((w) => w.id === active.id)
      const newIndex = widgets.findIndex((w) => w.id === over.id)
      if (oldIndex >= 0 && newIndex >= 0) {
        const reordered = arrayMove(widgets, oldIndex, newIndex)
        onReorder(reordered)
      }
    }
  }

  const activeWidget = widgets.find((w) => w.id === activeId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="sm:max-w-2xl max-w-2xl w-[92vw] max-h-[85vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                <Layers className="w-4 h-4 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-foreground">
                  סידור וניהול ווידג&apos;טים בגרירה
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  גרור ווידג&apos;טים למעלה או למטה כדי לשנות את סדר ההצגה שלהם בדשבורד
                </DialogDescription>
              </div>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={() => {
                onOpenChange(false)
                onAddWidget()
              }}
              className="h-8 gap-1.5 text-xs font-bold bg-violet-600 hover:bg-violet-700 text-white shadow-xs"
            >
              <Plus className="w-4 h-4" />
              הוסף ווידג&apos;ט
            </Button>
          </div>

          {/* Search & Tabs filter toolbar */}
          <div className="flex items-center gap-2 pt-2.5">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute right-2.5 top-2.5 text-muted-foreground/60" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="חיפוש לפי כותרת או לשונית..."
                className="h-8 pr-8 text-xs bg-muted/30 border-border/60"
              />
            </div>

            {tabs.length > 1 && (
              <select
                value={selectedTab}
                onChange={(e) => setSelectedTab(e.target.value)}
                className="h-8 px-2.5 rounded-md border border-input bg-background text-xs font-medium text-foreground"
              >
                <option value="all">כל הטאבים ({widgets.length})</option>
                {tabs.map((t) => (
                  <option key={t} value={t}>
                    טאב: {t} ({widgets.filter((w) => (w.tab || 'ראשי') === t).length})
                  </option>
                ))}
              </select>
            )}
          </div>
        </DialogHeader>

        {/* Scrollable Drag and drop sortable list */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredWidgets.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs font-semibold">לא נמצאו ווידג&apos;טים</p>
              <p className="text-[11px] mt-1">לחץ על &quot;הוסף ווידג&apos;ט&quot; כדי ליצור את הווידג&apos;ט הראשון</p>
            </div>
          ) : (
            <DndContext
              id={dndContextId}
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={filteredWidgets.map((w) => w.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-2">
                  {filteredWidgets.map((widget) => (
                    <SortableWidgetItem
                      key={widget.id}
                      widget={widget}
                      onEdit={(w) => {
                        onOpenChange(false)
                        onEditWidget(w)
                      }}
                      onDelete={onDeleteWidget}
                      onCycleWidth={onCycleWidth}
                    />
                  ))}
                </div>
              </SortableContext>

              <DragOverlay>
                {activeWidget ? (
                  <div className="p-3 rounded-xl border border-violet-500 bg-card shadow-2xl ring-2 ring-violet-500/40 opacity-95">
                    <div className="flex items-center gap-2">
                      <GripVertical className="w-4 h-4 text-violet-600" />
                      <span className="text-xs font-bold text-foreground">
                        {activeWidget.title}
                      </span>
                    </div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <DialogFooter className="p-3 px-4 border-t border-border/60 bg-muted/20 flex items-center justify-between sm:justify-between">
          <span className="text-xs text-muted-foreground">
            סה&quot;כ <strong className="text-foreground">{widgets.length}</strong> ווידג&apos;טים בדשבורד · השינויים נשמרים אוטומטית בענן
          </span>
          <Button
            type="button"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs font-bold bg-foreground text-background hover:bg-foreground/90 gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            סיום ואישור
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

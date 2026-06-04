import * as React from "react"
import {
  format, addDays, addWeeks, addMonths,
  startOfWeek, endOfWeek,
  isSameDay, isToday, isBefore, isAfter,
} from "date-fns"
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"

interface DateTimePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  showTime?: boolean
  className?: string
  minDate?: Date
  maxDate?: Date
  /** Prevent selecting any date/time in the past */
  disablePast?: boolean
}

// ─── Weekday / day helpers ─────────────────────────────────────────────────────
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]

function buildCalendarDays(month: Date): Date[] {
  const start = startOfWeek(month, { weekStartsOn: 1 })
  const end   = endOfWeek(addDays(month, 34), { weekStartsOn: 1 })
  const days: Date[] = []
  let cur = start
  while (cur <= end) {
    days.push(new Date(cur))
    cur = addDays(cur, 1)
  }
  return days
}

// ─── Main component ────────────────────────────────────────────────────────────
export function DateTimePicker({
  date,
  onDateChange,
  placeholder = "Select date & time",
  disabled    = false,
  showTime    = true,
  className,
  minDate,
  maxDate,
  disablePast = false,
}: DateTimePickerProps) {
  const [selected,     setSelected]     = React.useState<Date | undefined>(date)
  const [currentMonth, setCurrentMonth] = React.useState<Date>(date ?? new Date())
  const [timeValue,    setTimeValue]    = React.useState<string>(
    date ? format(date, "HH:mm") : "09:00"
  )
  const [open, setOpen] = React.useState(false)
  const rootRef         = React.useRef<HTMLDivElement>(null)

  // ── Sync external value ────────────────────────────────────────────────────
  React.useEffect(() => {
    setSelected(date)
    if (date) {
      setTimeValue(format(date, "HH:mm"))
      setCurrentMonth(date)
    }
  }, [date])

  // ── Close on outside click ─────────────────────────────────────────────────
  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // ── Handlers ───────────────────────────────────────────────────────────────
  const applyDateAndTime = (d: Date, t = timeValue): Date => {
    if (showTime) {
      const [h, m] = t.split(":").map(Number)
      d.setHours(h, m, 0, 0)
    }
    return d
  }

  const handleDayClick = (day: Date) => {
    if (minDate && isBefore(day, minDate)) return
    if (maxDate && isAfter(day, maxDate))  return
    const next = applyDateAndTime(new Date(day))
    setSelected(next)
    onDateChange?.(next)
    if (!showTime) setOpen(false)
  }

  const handleTimeChange = (t: string) => {
    setTimeValue(t)
    if (selected) {
      const next = applyDateAndTime(new Date(selected), t)
      setSelected(next)
      onDateChange?.(next)
    }
  }

  const handleQuick = (d: Date) => handleDayClick(d)

  const handleClear = () => {
    setSelected(undefined)
    onDateChange?.(undefined)
    setOpen(false)
  }

  // ── Display label ──────────────────────────────────────────────────────────
  const label = selected
    ? showTime
      ? format(selected, "MMM d, yyyy 'at' h:mm a")
      : format(selected, "MMM d, yyyy")
    : placeholder

  const calendarDays = buildCalendarDays(currentMonth)

  // ── Past-blocking helpers ──────────────────────────────────────────────────
  // startOfToday at midnight — used for whole-day comparison
  const startOfToday = React.useMemo(() => {
    const t = new Date()
    t.setHours(0, 0, 0, 0)
    return t
  }, [])

  // Minimum selectable time string ("HH:mm") — only relevant when today is selected
  const minTimeValue = React.useMemo(() => {
    if (!disablePast || !showTime) return undefined
    if (!selected || !isSameDay(selected, new Date())) return undefined
    return format(new Date(), "HH:mm")
  }, [disablePast, showTime, selected])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={rootRef} className={cn("relative w-full", className)}>

      {/* ── Trigger button ── */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(v => !v)}
        className={cn(
          "w-full flex items-center gap-2 h-10 px-3 rounded-md border-2 text-sm",
          "border-border/50 bg-background hover:border-border transition-colors",
          "focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary",
          !selected && "text-muted-foreground",
          disabled  && "opacity-50 cursor-not-allowed",
        )}
      >
        <CalendarIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 text-left truncate">{label}</span>
        {selected && (
          <span
            role="button"
            aria-label="Clear date"
            className="h-5 w-5 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground"
            onClick={e => { e.stopPropagation(); handleClear() }}
          >
            <X className="h-3 w-3" />
          </span>
        )}
      </button>

      {/* ── Dropdown panel ── */}
      {open && (
        <div
          className={cn(
            "absolute z-50 mt-1 left-0",
            "bg-popover text-popover-foreground",
            "rounded-xl border border-border/60 shadow-xl",
            "p-3 select-none",
          )}
          style={{ width: 280 }}               // fixed pixel width — no Tailwind override
        >
          {/* Quick chips */}
          <div className="flex gap-1 overflow-x-auto pb-2 mb-1 border-b border-border/30"
               style={{ scrollbarWidth: "none" }}>
            {[
              { label: "Today",      date: new Date() },
              { label: "Tomorrow",   date: addDays(new Date(), 1) },
              { label: "Next Week",  date: addWeeks(new Date(), 1) },
              { label: "Next Month", date: addMonths(new Date(), 1) },
            ].map(q => (
              <button
                key={q.label}
                type="button"
                onClick={() => handleQuick(q.date)}
                className="shrink-0 h-6 px-2.5 rounded-full text-[11px] font-medium
                           bg-muted/50 hover:bg-primary/10 hover:text-primary
                           text-muted-foreground transition-colors whitespace-nowrap"
              >
                {q.label}
              </button>
            ))}
          </div>

          {/* Month nav */}
          <div className="flex items-center justify-between mb-2 px-0.5">
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-xs font-semibold text-foreground">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button
              type="button"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="h-7 w-7 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Calendar — explicit table-like layout using inline-block to guarantee 7 cols */}
          <div>
            {/* Weekday headers */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {WEEKDAYS.map(d => (
                <div
                  key={d}
                  style={{ textAlign: "center" }}
                  className="h-7 flex items-center justify-center text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wide"
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
              {calendarDays.map((day, i) => {
                const inMonth    = day.getMonth() === currentMonth.getMonth()
                const isSelected = !!selected && isSameDay(day, selected)
                const todayCell  = isToday(day)
                const isDisabled =
                  (disablePast && isBefore(day, startOfToday)) ||
                  (!!minDate && isBefore(day, minDate)) ||
                  (!!maxDate && isAfter(day, maxDate))

                return (
                  <button
                    key={i}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => handleDayClick(day)}
                    className={cn(
                      "h-8 w-full flex items-center justify-center rounded-full text-xs transition-colors",
                      inMonth ? "text-foreground" : "text-muted-foreground/25",
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold"
                        : todayCell
                          ? "bg-accent text-accent-foreground font-semibold ring-1 ring-primary/30"
                          : "hover:bg-primary/10 hover:text-primary",
                      isDisabled && "opacity-20 cursor-not-allowed hover:bg-transparent hover:text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Time row */}
          {showTime && (
            <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span className="text-xs font-medium">Time</span>
              </div>
              <input
                type="time"
                value={timeValue}
                min={minTimeValue}
                onChange={e => handleTimeChange(e.target.value)}
                className={cn(
                  "h-8 rounded-md px-2 py-1 text-xs font-medium",
                  "bg-muted/40 border border-transparent",
                  "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20",
                  "transition-colors cursor-pointer",
                )}
                style={{ width: 110 }}
              />
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={handleClear}
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-7 px-4 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Date-only picker ──────────────────────────────────────────────────────────
export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  disabled    = false,
  className,
  minDate,
  maxDate,
  disablePast,
}: Omit<DateTimePickerProps, "showTime">) {
  return (
    <DateTimePicker
      date={date}
      onDateChange={onDateChange}
      placeholder={placeholder}
      disabled={disabled}
      showTime={false}
      className={className}
      minDate={minDate}
      maxDate={maxDate}
      disablePast={disablePast}
    />
  )
}
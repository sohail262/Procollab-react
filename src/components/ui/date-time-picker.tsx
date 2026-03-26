import * as React from "react"
import { format, addDays, addWeeks, addMonths, startOfWeek, endOfWeek, isSameDay, isToday, isBefore, isAfter } from "date-fns"
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DateTimePickerProps {
  date?: Date
  onDateChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  showTime?: boolean
  className?: string
  minDate?: Date
  maxDate?: Date
}

export function DateTimePicker({
  date,
  onDateChange,
  placeholder = "Select date & time",
  disabled = false,
  showTime = true,
  className,
  minDate,
  maxDate
}: DateTimePickerProps) {
  const [selectedDate, setSelectedDate] = React.useState<Date | undefined>(date)
  const [currentMonth, setCurrentMonth] = React.useState<Date>(date || new Date())
  const [timeValue, setTimeValue] = React.useState<string>(
    date ? format(date, "HH:mm") : "09:00"
  )
  const [isOpen, setIsOpen] = React.useState(false)

  React.useEffect(() => {
    setSelectedDate(date)
    if (date) {
      setTimeValue(format(date, "HH:mm"))
      setCurrentMonth(date)
    }
  }, [date])

  const handleDateSelect = (newDate: Date) => {
    if (minDate && isBefore(newDate, minDate)) return
    if (maxDate && isAfter(newDate, maxDate)) return

    // Combine with existing time
    if (showTime && timeValue) {
      const [hours, minutes] = timeValue.split(':').map(Number)
      newDate.setHours(hours, minutes, 0, 0)
    }

    setSelectedDate(newDate)
    onDateChange?.(newDate)
    
    if (!showTime) {
      setIsOpen(false)
    }
  }

  const handleTimeChange = (newTime: string) => {
    setTimeValue(newTime)
    
    if (selectedDate) {
      const [hours, minutes] = newTime.split(':').map(Number)
      const newDateTime = new Date(selectedDate)
      newDateTime.setHours(hours, minutes, 0, 0)
      setSelectedDate(newDateTime)
      onDateChange?.(newDateTime)
    }
  }

  const handleClear = () => {
    setSelectedDate(undefined)
    onDateChange?.(undefined)
    setIsOpen(false)
  }

  const quickSelections = [
    { label: "Today", date: new Date() },
    { label: "Tomorrow", date: addDays(new Date(), 1) },
    { label: "Next Week", date: addWeeks(new Date(), 1) },
    { label: "Next Month", date: addMonths(new Date(), 1) },
  ]

  const generateCalendarDays = () => {
    const start = startOfWeek(currentMonth, { weekStartsOn: 1 })
    const end = endOfWeek(addDays(currentMonth, 34), { weekStartsOn: 1 })
    const days = []
    
    let current = start
    while (current <= end) {
      days.push(new Date(current))
      current = addDays(current, 1)
    }
    
    return days
  }

  const generateTimeSlots = () => {
    const slots = []
    for (let hour = 0; hour < 24; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
        slots.push(timeString)
      }
    }
    return slots
  }

  const calendarDays = generateCalendarDays()
  const timeSlots = generateTimeSlots()

  return (
    <div className={cn("relative", className)}>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal h-10 px-3 py-2",
              "border-2 border-border/50 hover:border-border transition-colors",
              "focus:border-primary focus:ring-2 focus:ring-primary/20",
              !selectedDate && "text-muted-foreground",
              disabled && "opacity-50 cursor-not-allowed"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-2 h-4 w-4 text-muted-foreground" />
            {selectedDate ? (
              <span className="flex-1">
                {showTime ? (
                  format(selectedDate, "MMM d, yyyy 'at' h:mm a")
                ) : (
                  format(selectedDate, "MMM d, yyyy")
                )}
              </span>
            ) : (
              <span className="flex-1">{placeholder}</span>
            )}
            {selectedDate && (
              <X 
                className="h-4 w-4 text-muted-foreground hover:text-foreground ml-2" 
                onClick={(e) => {
                  e.stopPropagation()
                  handleClear()
                }}
              />
            )}
          </Button>
        </PopoverTrigger>
        
        <PopoverContent className="w-auto p-0 shadow-lg border-2" align="start">
          <div className="flex">
            {/* Calendar Section */}
            <div className="p-4 border-r">
              {/* Quick Selections */}
              <div className="mb-4">
                <div className="grid grid-cols-2 gap-2">
                  {quickSelections.map((quick) => (
                    <Button
                      key={quick.label}
                      variant="ghost"
                      size="sm"
                      className="h-8 text-xs font-medium hover:bg-primary/10 hover:text-primary"
                      onClick={() => handleDateSelect(quick.date)}
                    >
                      {quick.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Month Navigation */}
              <div className="flex items-center justify-between mb-4">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, -1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="font-semibold text-sm">
                  {format(currentMonth, "MMMM yyyy")}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              {/* Weekday Headers */}
              <div className="grid grid-cols-7 gap-1 mb-2">
                {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((day) => (
                  <div key={day} className="h-8 flex items-center justify-center text-xs font-medium text-muted-foreground">
                    {day}
                  </div>
                ))}
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, index) => {
                  const isCurrentMonth = day.getMonth() === currentMonth.getMonth()
                  const isSelected = selectedDate && isSameDay(day, selectedDate)
                  const isTodayDate = isToday(day)
                  const isDisabled = 
                    (minDate && isBefore(day, minDate)) || 
                    (maxDate && isAfter(day, maxDate))

                  return (
                    <Button
                      key={index}
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 w-8 p-0 text-sm font-normal",
                        "hover:bg-primary/10 hover:text-primary transition-colors",
                        !isCurrentMonth && "text-muted-foreground/50",
                        isSelected && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                        isTodayDate && !isSelected && "bg-accent text-accent-foreground font-semibold",
                        isDisabled && "opacity-30 cursor-not-allowed hover:bg-transparent hover:text-muted-foreground/50"
                      )}
                      onClick={() => !isDisabled && handleDateSelect(day)}
                      disabled={isDisabled}
                    >
                      {format(day, "d")}
                    </Button>
                  )
                })}
              </div>
            </div>

            {/* Time Section */}
            {showTime && (
              <div className="p-4 w-32">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm font-medium">Time</Label>
                </div>
                
                <div className="space-y-2">
                  <Input
                    type="time"
                    value={timeValue}
                    onChange={(e) => handleTimeChange(e.target.value)}
                    className="h-8 text-sm"
                  />
                  
                  <div className="max-h-32 overflow-y-auto space-y-1 border rounded-md p-1">
                    {timeSlots.filter((_, index) => index % 4 === 0).map((time) => (
                      <Button
                        key={time}
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "w-full h-6 text-xs justify-start px-2",
                          timeValue === time && "bg-primary/10 text-primary"
                        )}
                        onClick={() => handleTimeChange(time)}
                      >
                        {format(new Date(`2000-01-01T${time}`), "h:mm a")}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-3 flex justify-between items-center bg-muted/30">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </Button>
            <Button
              size="sm"
              onClick={() => setIsOpen(false)}
              className="text-xs h-7 px-3"
            >
              Done
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Simple date-only picker
export function DatePicker({
  date,
  onDateChange,
  placeholder = "Select date",
  disabled = false,
  className,
  minDate,
  maxDate
}: Omit<DateTimePickerProps, 'showTime'>) {
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
    />
  )
}
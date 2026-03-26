import * as React from "react"
import { Clock, ChevronUp, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface TimePickerProps {
  value?: string
  onChange?: (time: string) => void
  className?: string
  disabled?: boolean
  format12Hour?: boolean
}

export function TimePicker({
  value = "09:00",
  onChange,
  className,
  disabled = false,
  format12Hour = false
}: TimePickerProps) {
  const [hours, setHours] = React.useState<number>(9)
  const [minutes, setMinutes] = React.useState<number>(0)
  const [period, setPeriod] = React.useState<'AM' | 'PM'>('AM')

  React.useEffect(() => {
    if (value) {
      const [h, m] = value.split(':').map(Number)
      if (format12Hour) {
        const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
        setHours(hour12)
        setPeriod(h >= 12 ? 'PM' : 'AM')
      } else {
        setHours(h)
      }
      setMinutes(m)
    }
  }, [value, format12Hour])

  const updateTime = (newHours: number, newMinutes: number, newPeriod?: 'AM' | 'PM') => {
    let finalHours = newHours
    
    if (format12Hour && newPeriod) {
      if (newPeriod === 'PM' && newHours !== 12) {
        finalHours = newHours + 12
      } else if (newPeriod === 'AM' && newHours === 12) {
        finalHours = 0
      }
    }

    const timeString = `${finalHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
    onChange?.(timeString)
  }

  const adjustHours = (increment: boolean) => {
    const maxHours = format12Hour ? 12 : 23
    const minHours = format12Hour ? 1 : 0
    
    let newHours = increment ? hours + 1 : hours - 1
    
    if (newHours > maxHours) newHours = minHours
    if (newHours < minHours) newHours = maxHours
    
    setHours(newHours)
    updateTime(newHours, minutes, period)
  }

  const adjustMinutes = (increment: boolean) => {
    let newMinutes = increment ? minutes + 15 : minutes - 15
    
    if (newMinutes >= 60) {
      newMinutes = 0
      adjustHours(true)
      return
    }
    if (newMinutes < 0) {
      newMinutes = 45
      adjustHours(false)
      return
    }
    
    setMinutes(newMinutes)
    updateTime(hours, newMinutes, period)
  }

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM'
    setPeriod(newPeriod)
    updateTime(hours, minutes, newPeriod)
  }

  return (
    <div className={cn("flex items-center space-x-2", className)}>
      <Clock className="h-4 w-4 text-muted-foreground" />
      
      {/* Hours */}
      <div className="flex flex-col items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-8 p-0 hover:bg-primary/10"
          onClick={() => adjustHours(true)}
          disabled={disabled}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          min={format12Hour ? 1 : 0}
          max={format12Hour ? 12 : 23}
          value={hours}
          onChange={(e) => {
            const newHours = parseInt(e.target.value) || (format12Hour ? 1 : 0)
            setHours(newHours)
            updateTime(newHours, minutes, period)
          }}
          className="h-8 w-12 text-center text-sm border-0 bg-transparent focus:bg-muted rounded"
          disabled={disabled}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-8 p-0 hover:bg-primary/10"
          onClick={() => adjustHours(false)}
          disabled={disabled}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      <span className="text-lg font-mono text-muted-foreground">:</span>

      {/* Minutes */}
      <div className="flex flex-col items-center">
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-8 p-0 hover:bg-primary/10"
          onClick={() => adjustMinutes(true)}
          disabled={disabled}
        >
          <ChevronUp className="h-3 w-3" />
        </Button>
        <Input
          type="number"
          min={0}
          max={59}
          step={15}
          value={minutes}
          onChange={(e) => {
            const newMinutes = parseInt(e.target.value) || 0
            setMinutes(newMinutes)
            updateTime(hours, newMinutes, period)
          }}
          className="h-8 w-12 text-center text-sm border-0 bg-transparent focus:bg-muted rounded"
          disabled={disabled}
        />
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-8 p-0 hover:bg-primary/10"
          onClick={() => adjustMinutes(false)}
          disabled={disabled}
        >
          <ChevronDown className="h-3 w-3" />
        </Button>
      </div>

      {/* AM/PM Toggle */}
      {format12Hour && (
        <Button
          variant="outline"
          size="sm"
          className="h-8 w-12 text-xs font-medium"
          onClick={togglePeriod}
          disabled={disabled}
        >
          {period}
        </Button>
      )}
    </div>
  )
}
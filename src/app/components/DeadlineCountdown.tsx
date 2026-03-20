import { useState, useEffect } from "react";
import { Clock } from "lucide-react";

interface CountdownProps {
  deadline: string | Date;
  minimal?: boolean;
}

export function DeadlineCountdown({ deadline, minimal = false }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<{
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
  } | null>(null);

  useEffect(() => {
    const target = new Date(deadline).getTime();

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = target - now;

      if (distance < 0) {
        setTimeLeft(null);
        return;
      }

      setTimeLeft({
        days: Math.floor(distance / (1000 * 60 * 60 * 24)),
        hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((distance % (1000 * 60)) / 1000),
      });
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [deadline]);

  if (!timeLeft) return null;

  if (minimal) {
    return (
      <div className="flex items-center gap-2 text-rose-500 font-mono text-[10px] uppercase font-bold tracking-widest whitespace-nowrap">
        <Clock size={12} className="animate-pulse" />
        <span>{timeLeft.days}d {timeLeft.hours}h {timeLeft.minutes}m {timeLeft.seconds}s</span>
      </div>
    );
  }

  return (
    <div className="bg-secondary/50 backdrop-blur-sm border border-border p-6 mb-8 mt-4">
      <div className="flex items-center gap-3 mb-4 text-foreground">
        <Clock size={16} className="text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-widest">Application Deadline</span>
      </div>
      
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Days", value: timeLeft.days },
          { label: "Hours", value: timeLeft.hours },
          { label: "Mins", value: timeLeft.minutes },
          { label: "Secs", value: timeLeft.seconds },
        ].map((unit, idx) => (
          <div key={idx} className="text-center">
            <div className="text-2xl font-light text-foreground mb-1">
              {unit.value.toString().padStart(2, '0')}
            </div>
            <div className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">
              {unit.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

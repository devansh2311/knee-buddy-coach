import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Activity, Footprints, ArrowUpDown, Sun, ThermometerSun } from "lucide-react";

interface CheckinData {
  pain_score: number | null;
  stiffness_score: number | null;
  walking_difficulty: number | null;
  stair_difficulty: number | null;
  daily_activity_score: number | null;
  checkin_date: string;
}

interface LatestCheckinSummaryProps {
  checkin: CheckinData | null;
}

const metrics = [
  {
    key: "pain_score" as const,
    label: "Pain Level",
    icon: ThermometerSun,
    max: 10,
    colorClass: "bg-destructive",
    description: "Lower is better",
    invert: true,
  },
  {
    key: "stiffness_score" as const,
    label: "Stiffness",
    icon: Activity,
    max: 10,
    colorClass: "bg-[hsl(30,90%,50%)]",
    description: "Lower is better",
    invert: true,
  },
  {
    key: "walking_difficulty" as const,
    label: "Walking Ease",
    icon: Footprints,
    max: 10,
    colorClass: "bg-secondary",
    description: "Higher is better",
    invert: false,
  },
  {
    key: "stair_difficulty" as const,
    label: "Stair Climbing",
    icon: ArrowUpDown,
    max: 10,
    colorClass: "bg-primary",
    description: "Higher is better",
    invert: false,
  },
  {
    key: "daily_activity_score" as const,
    label: "Daily Activity",
    icon: Sun,
    max: 10,
    colorClass: "bg-accent",
    description: "Higher is better",
    invert: false,
  },
];

const getStatusColor = (value: number, max: number, invert: boolean) => {
  const ratio = value / max;
  if (invert) {
    if (ratio <= 0.3) return "text-secondary";
    if (ratio <= 0.6) return "text-[hsl(30,90%,50%)]";
    return "text-destructive";
  }
  if (ratio >= 0.7) return "text-secondary";
  if (ratio >= 0.4) return "text-[hsl(30,90%,50%)]";
  return "text-destructive";
};

const getStatusLabel = (value: number, max: number, invert: boolean) => {
  const ratio = value / max;
  if (invert) {
    if (ratio <= 0.3) return "Good";
    if (ratio <= 0.6) return "Moderate";
    return "Needs Attention";
  }
  if (ratio >= 0.7) return "Good";
  if (ratio >= 0.4) return "Moderate";
  return "Needs Improvement";
};

const LatestCheckinSummary = ({ checkin }: LatestCheckinSummaryProps) => {
  if (!checkin) return null;

  const date = new Date(checkin.checkin_date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-2xl flex items-center justify-between">
          <span>Latest Check-in Summary</span>
          <span className="text-base font-normal text-muted-foreground">{date}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {metrics.map((metric) => {
            const value = checkin[metric.key];
            if (value === null || value === undefined) return null;

            const Icon = metric.icon;
            const statusColor = getStatusColor(value, metric.max, metric.invert);
            const statusLabel = getStatusLabel(value, metric.max, metric.invert);
            const progressValue = (value / metric.max) * 100;

            return (
              <div
                key={metric.key}
                className="flex flex-col items-center p-4 rounded-xl border bg-muted/30 gap-2"
              >
                <Icon className={`h-8 w-8 ${statusColor}`} />
                <span className="text-sm font-medium text-muted-foreground">{metric.label}</span>
                <span className={`text-3xl font-bold ${statusColor}`}>
                  {value}<span className="text-base font-normal text-muted-foreground">/{metric.max}</span>
                </span>
                <div className="w-full">
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary/20">
                    <div
                      className={`h-full rounded-full transition-all ${metric.colorClass}`}
                      style={{ width: `${progressValue}%` }}
                    />
                  </div>
                </div>
                <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                <span className="text-[10px] text-muted-foreground">{metric.description}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default LatestCheckinSummary;

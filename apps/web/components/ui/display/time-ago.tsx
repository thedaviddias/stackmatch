"use client";

import { formatTimeAgo } from "@stackmatch/utils/formatting";
import { useEffect, useState } from "react";

interface TimeAgoProps {
  timestamp: number;
  className?: string;
}

const ABSOLUTE_DATE_FORMATTER = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

function formatAbsoluteDate(timestamp: number): string {
  return ABSOLUTE_DATE_FORMATTER.format(timestamp);
}

export function TimeAgo({ timestamp, className }: TimeAgoProps) {
  const [nowMs, setNowMs] = useState<number | null>(null);
  const dateTime = new Date(timestamp).toISOString();
  const label = nowMs === null ? formatAbsoluteDate(timestamp) : formatTimeAgo(timestamp, nowMs);

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  return (
    <time dateTime={dateTime} className={className}>
      {label}
    </time>
  );
}

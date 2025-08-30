'use client';

import React from 'react';
import { Box, Typography } from '@mui/material';
import DayCard from './day-card';
import { Period, DaySchedule, ScheduleConfig } from './types';

interface ScheduleGridProps {
  days: DaySchedule[];
  config: ScheduleConfig;
  onEditPeriod: (dayIndex: number, periodIndex: number, period: Period) => void;
  onDeletePeriod: (dayIndex: number, periodIndex: number, period: Period) => void;
}

export default function ScheduleGrid({
  days,
  config,
  onEditPeriod,
  onDeletePeriod,
}: ScheduleGridProps) {
  // Generate time labels based on configurable hours - use 24-hour military time
  const totalHours = config.endHour - config.startHour;
  const timeLabels = Array.from({ length: totalHours + 1 }, (_, i) => {
    const hour = config.startHour + i;
    return `${hour.toString().padStart(2, '0')}:00`; // Always use 24-hour format
  });

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Time Grid Lines */}
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 1, pointerEvents: 'none' }}>
        {/* Hour lines */}
        {Array.from({ length: totalHours + 1 }, (_, i) => (
          <Box
            key={`hour-${i}`}
            sx={{
              position: 'absolute',
              right: '60px', // Start from the left edge of time column in RTL
              left: 0,
              top: `${80 + i * 50}px`,
              height: '1px',
              backgroundColor: '#f5f5f5', // Softer color for hour lines
            }}
          />
        ))}
        
        {/* Quarter hour lines */}
        {Array.from({ length: totalHours * 4 + 1 }, (_, i) => (
          <Box
            key={`quarter-${i}`}
            sx={{
              position: 'absolute',
              right: '60px', // Start from the left edge of time column in RTL
              left: 0,
              top: `${80 + i * 12.5}px`,
              height: '1px',
              backgroundColor: '#fafafa', // Much softer color for quarter hour lines
            }}
          />
        ))}
      </Box>

      {/* Schedule Content */}
      <Box sx={{ display: 'flex', flexWrap: 'nowrap', gap: 0, position: 'relative', zIndex: 2 }}>
        {/* Time Labels Column */}
        <Box sx={{ 
          width: '60px', 
          borderRight: '1px solid #e0e0e0',
          backgroundColor: 'transparent'
        }}>
          {/* Header */}
          <Box sx={{ 
            height: '80px', 
            borderBottom: '1px solid #e0e0e0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#f8f9fa'
          }}>
            <Typography variant="caption" sx={{ fontWeight: 'bold', color: '#000000' }}>
              זמן
            </Typography>
          </Box>
          
          {/* Time labels */}
          {timeLabels.map((time, index) => (
            <Box
              key={time}
              sx={{
                height: '50px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderBottom: '1px solid #e0e0e0',
                fontSize: '0.75rem',
                color: '#000000',
                backgroundColor: '#f8f9fa'
              }}
            >
              {time}
            </Box>
          ))}
        </Box>

        {/* Day Columns */}
        {days.map((day, dayIndex) => (
          <DayCard
            key={day.day}
            day={day.day}
            periods={day.periods}
            dayIndex={dayIndex}
            onEditPeriod={onEditPeriod}
            onDeletePeriod={onDeletePeriod}
          />
        ))}
      </Box>
    </Box>
  );
}

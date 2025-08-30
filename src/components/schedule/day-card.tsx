'use client';

import React from 'react';
import {
  Box,
  Typography,
} from '@mui/material';
import PeriodCard from './period-card';
import { Period } from './types';

interface DayCardProps {
  day: string;
  periods: Period[];
  dayIndex: number;
  onEditPeriod: (dayIndex: number, periodIndex: number, period: Period) => void;
  onDeletePeriod: (dayIndex: number, periodIndex: number, period: Period) => void;
}

export default function DayCard({
  day,
  periods,
  dayIndex,
  onEditPeriod,
  onDeletePeriod,
}: DayCardProps) {
  return (
    <Box sx={{ 
      flex: 1, 
      minWidth: 0, 
      borderRight: dayIndex < 6 ? '1px solid #e0e0e0' : 'none',
      borderLeft: dayIndex > 0 ? '1px solid #e0e0e0' : 'none',
      position: 'relative'
    }}>
      {/* Day Header */}
      <Box sx={{ 
        textAlign: 'center', 
        height: '80px',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center'
      }}>
        <Typography variant="h6" component="h2" sx={{ fontWeight: 'bold' }}>
          {day}
        </Typography>
      </Box>

      {/* Periods Container */}
      <Box sx={{ position: 'relative', minHeight: '650px' }}>
        {/* Periods */}
        {periods.length > 0 && (
          <Box sx={{ position: 'relative', zIndex: 2 }}>
            {periods.map((period, periodIndex) => (
              <PeriodCard
                key={period.id}
                period={period}
                onEdit={() => onEditPeriod(dayIndex, periodIndex, period)}
                onDelete={() => onDeletePeriod(dayIndex, periodIndex, period)}
              />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

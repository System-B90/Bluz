'use client';

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Schedule as ScheduleIcon,
  AccessTime as AccessTimeIcon,
  LocationOn as LocationIcon,
  Lock as LockIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { Period, EVENT_TYPES, DEFAULT_SCHEDULE_CONFIG } from './types';

interface PeriodCardProps {
  period: Period;
  onEdit: () => void;
  onDelete: () => void;
  config?: { startHour: number; endHour: number };
}

export default function PeriodCard({
  period,
  onEdit,
  onDelete,
  config = DEFAULT_SCHEDULE_CONFIG,
}: PeriodCardProps) {
  const getPeriodTypeColor = (type: string) => {
    const periodType = EVENT_TYPES.find(pt => pt.value === type);
    return periodType?.color || 'default';
  };

  const getPeriodTypeLabel = (type: string) => {
    const periodType = EVENT_TYPES.find(pt => pt.value === type);
    return periodType?.label || type;
  };

  // Calculate duration in minutes
  const durationMinutes = period.endTime.diff(period.startTime, 'minute');
  const durationHours = Math.floor(durationMinutes / 60);
  const durationRemainingMinutes = durationMinutes % 60;
  
  // Format duration display
  const formatDuration = () => {
    if (durationHours > 0) {
      return durationRemainingMinutes > 0 
        ? `${durationHours}:${durationRemainingMinutes.toString().padStart(2, '0')}`
        : `${durationHours}h`;
    }
    return `${durationMinutes}דק`;
  };

  // Calculate position and height based on configurable time
  const startHour = period.startTime.hour();
  const startMinute = period.startTime.minute();
  const endHour = period.endTime.hour();
  const endMinute = period.endTime.minute();
  
  // Convert to minutes from configurable start hour
  const startMinutes = (startHour - config.startHour) * 60 + startMinute;
  const endMinutes = (endHour - config.startHour) * 60 + endMinute;
  
  // Position: 50px per hour, so 50/60 = 0.833px per minute
  const top = startMinutes * 0.833;
  const height = (endMinutes - startMinutes) * 0.833;

  return (
    <Paper
      sx={{
        position: 'absolute',
        top: `${top}px`,
        left: '4px',
        right: '4px',
        height: `${height}px`,
        p: 1,
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'white',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        zIndex: 3,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        <Chip
          label={getPeriodTypeLabel(period.type)}
          color={getPeriodTypeColor(period.type) as any}
          size="small"
          icon={<ScheduleIcon />}
        />
        
        {/* Duration indicator */}
        <Chip
          label={formatDuration()}
          size="small"
          variant="outlined"
          sx={{ 
            fontSize: '0.6rem', 
            height: '20px',
            backgroundColor: 'rgba(0,0,0,0.05)',
            borderColor: 'rgba(0,0,0,0.2)'
          }}
        />

        {period.locked && (
          <Chip
            label="נעול"
            color="error"
            size="small"
            icon={<LockIcon />}
          />
        )}

        {period.required && (
          <Chip
            label="פ״א"
            color="warning"
            size="small"
            icon={<WarningIcon />}
          />
        )}
      </Box>

      <Typography variant="subtitle2" fontWeight="bold" sx={{ fontSize: '0.75rem', lineHeight: 1.2 }}>
        {period.name}
      </Typography>

      {period.subject && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          נושא: {period.subject}
        </Typography>
      )}

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <AccessTimeIcon sx={{ fontSize: 12 }} />
        <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
          {period.startTime.format('HH:mm')} - {period.endTime.format('HH:mm')}
        </Typography>
      </Box>

      {period.location && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
          <LocationIcon sx={{ fontSize: 12 }} />
          <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
            {period.location}
          </Typography>
        </Box>
      )}

      {period.instructors && period.instructors.length > 0 && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          מדריכים: {period.instructors.length > 1 ? `${period.instructors.length} מדריכים` : period.instructors[0]}
        </Typography>
      )}

      {period.notes && (
        <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem', fontStyle: 'italic' }}>
          {period.notes}
        </Typography>
      )}

      <Box sx={{ position: 'absolute', top: 2, left: 2 }}>
        <Tooltip title="ערוך מופע">
          <IconButton
            size="small"
            sx={{ width: 20, height: 20 }}
            onClick={onEdit}
          >
            <EditIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
        <Tooltip title="מחק מופע">
          <IconButton
            size="small"
            color="error"
            sx={{ width: 20, height: 20 }}
            onClick={onDelete}
          >
            <DeleteIcon sx={{ fontSize: 12 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}

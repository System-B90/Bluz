'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Box } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import dayjs from 'dayjs';
import 'dayjs/locale/he';

// Import components
import WeekSelector from '@/components/schedule/week-selector';
import ScheduleGrid from '@/components/schedule/schedule-grid';
import PeriodDialog from '@/components/schedule/period-dialog';
import DeleteDialog from '@/components/schedule/delete-dialog';

// Import types
import { Period, DaySchedule, WeekSchedule, DAYS_OF_WEEK, ScheduleConfig, DEFAULT_SCHEDULE_CONFIG } from '@/components/schedule/types';
import Schedule from "@/components/schedule/schedule";
import {momentLocalizer, SlotInfo} from "react-big-calendar";
import moment from "moment";

export default function SchedulePage() {
  const [schedules, setSchedules] = useState<WeekSchedule[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [selectedPeriod, setSelectedPeriod] = useState<Partial<Period>>();
  const [openPeriodDialog, setOpenPeriodDialog] = useState<boolean>(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);
  const [periodDialog, setPeriodDialog] = useState<{
    open: boolean;
    period: Partial<Period> | null;
    dayIndex: number;
    periodIndex?: number;
  }>({
    open: false,
    period: null,
    dayIndex: 0,
  });
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    period: Period | null;
    dayIndex: number;
    periodIndex: number;
  }>({
    open: false,
    period: null,
    dayIndex: 0,
    periodIndex: 0,
  });

  useEffect(() => {
    // Initialize with a default week schedule
    if (schedules.length === 0) {
      const defaultWeek: WeekSchedule = {
        weekNumber: 1,
        days: DAYS_OF_WEEK.map(day => ({
          day,
          periods: [],
        })),
      };
      setSchedules([defaultWeek]);
    }
  }, [schedules.length]);

  // Keyboard shortcut for adding new period
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Use Alt+N (Windows/Linux) or Option+N (Mac) to avoid browser conflicts
      if (event.altKey && event.key === 'n') {
        event.preventDefault(); // Prevent default browser behavior
        handleAddPeriod(0); // Add to first day (Sunday) by default
      }
    };

    // Add event listener
    document.addEventListener('keydown', handleKeyDown);

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []); // Empty dependency array since handleAddPeriod is stable

  const handleAddPeriod = (dayIndex: number) => {
    const newPeriod: Partial<Period> = {
      id: `period-${Date.now()}`,
      name: '',
      subject: '',
      startTime: dayjs().hour(scheduleConfig.startHour).minute(0),
      endTime: dayjs().hour(scheduleConfig.startHour + 1).minute(0),
      type: 'exercise',
      location: '',
      instructors: [],
      notes: '',
      locked: false,
      potentialPA: false,
    };
    
    setPeriodDialog({
      open: true,
      period: newPeriod,
      dayIndex,
    });
  };

  const handleEditPeriod = (dayIndex: number, periodIndex: number, period: Period) => {
    setPeriodDialog({
      open: true,
      period: { ...period },
      dayIndex,
      periodIndex,
    });
  };

  const handleDeletePeriod = (dayIndex: number, periodIndex: number, period: Period) => {
    setDeleteDialog({
      open: true,
      period,
      dayIndex,
      periodIndex,
    });
  };

  const handleSavePeriod = () => {
    if (!periodDialog.period || periodDialog.period.name === '') return;

    const newSchedules = [...schedules];
    const weekIndex = schedules.findIndex(w => w.weekNumber === selectedWeek);
    
    if (weekIndex === -1) return;

    const newPeriod: Period = {
      id: periodDialog.period.id || `period-${Date.now()}`,
      name: periodDialog.period.name || '',
      subject: periodDialog.period.subject || '',
      startTime: periodDialog.period.startTime || dayjs(),
      endTime: periodDialog.period.endTime || dayjs(),
      type: periodDialog.period.type || 'exercise',
      location: periodDialog.period.location || '',
      instructors: periodDialog.period.instructors || [],
      notes: periodDialog.period.notes || '',
      locked: periodDialog.period.locked || false,
      potentialPA: periodDialog.period.potentialPA || false,
    };

    if (periodDialog.periodIndex !== undefined) {
      // Editing existing period
      newSchedules[weekIndex].days[periodDialog.dayIndex].periods[periodDialog.periodIndex] = newPeriod;
    } else {
      // Adding new period
      newSchedules[weekIndex].days[periodDialog.dayIndex].periods.push(newPeriod);
    }

    // Sort periods by start time
    newSchedules[weekIndex].days[periodDialog.dayIndex].periods.sort((a, b) => 
      a.startTime.isBefore(b.startTime) ? -1 : 1
    );

    setSchedules(newSchedules);
    setPeriodDialog({ open: false, period: null, dayIndex: 0 });
  };

  const handleDayChange = (dayIndex: number) => {
    setPeriodDialog({
      ...periodDialog,
      dayIndex,
    });
  };

  const handleConfirmDelete = () => {
    const newSchedules = [...schedules];
    const weekIndex = schedules.findIndex(w => w.weekNumber === selectedWeek);
    
    if (weekIndex === -1) return;

    newSchedules[weekIndex].days[deleteDialog.dayIndex].periods.splice(deleteDialog.periodIndex, 1);
    setSchedules(newSchedules);
    setDeleteDialog({ open: false, period: null, dayIndex: 0, periodIndex: 0 });
  };
  const handleSlotSelect = (slotInfo: SlotInfo) => {
      // if (slotInfo.action == "doubleClick") {
          const newPeriod: Partial<Period> = {
              startTime: dayjs(slotInfo.start),
              endTime: dayjs(slotInfo.end),
          };
          setSelectedPeriod(newPeriod);
          setOpenPeriodDialog(true);
      // }
  };


  const addNewWeek = () => {
    const newWeekNumber = Math.max(...schedules.map(s => s.weekNumber)) + 1;
    const newWeek: WeekSchedule = {
      weekNumber: newWeekNumber,
      days: DAYS_OF_WEEK.map(day => ({
        day,
        periods: [],
      })),
    };
    setSchedules([...schedules, newWeek]);
    setSelectedWeek(newWeekNumber);
  };

  const currentWeek = schedules.find(w => w.weekNumber === selectedWeek);

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="he">
      <Box sx={{ p: 3, maxWidth: '100%', direction: 'rtl' }}>
          <Schedule
              localizer={momentLocalizer(moment)}
              defaultView={"week"}
              events={periods}
              setEventEditOpen={setOpenPeriodDialog}
              setSelectedEvent={setSelectedPeriod}
              onSlotSelect={handleSlotSelect}
              selectable={true}
          />

        {/* Period Dialog */}
        <PeriodDialog
          open={periodDialog.open}
          period={selectedPeriod}
          isEdit={periodDialog.periodIndex !== undefined}
          selectedDayIndex={periodDialog.dayIndex}
          onClose={() => setPeriodDialog({ open: false, period: null, dayIndex: 0 })}
          onSave={handleSavePeriod}
          onPeriodChange={(updates) => setPeriodDialog({
            ...periodDialog,
            period: { ...periodDialog.period, ...updates }
          })}
          onDayChange={handleDayChange}
        />

        {/* Delete Dialog */}
        <DeleteDialog
          open={deleteDialog.open}
          period={deleteDialog.period}
          dayName={currentWeek?.days[deleteDialog.dayIndex]?.day || ''}
          onClose={() => setDeleteDialog({ open: false, period: null, dayIndex: 0, periodIndex: 0 })}
          onConfirm={handleConfirmDelete}
        />
      </Box>
    </LocalizationProvider>
  );
}

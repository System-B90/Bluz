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
import {
    Period,
    DaySchedule,
    WeekSchedule,
    DAYS_OF_WEEK,
    ScheduleConfig,
    DEFAULT_SCHEDULE_CONFIG,
    Room
} from '@/components/schedule/types';
import Schedule from "@/components/schedule/schedule";
import {Calendar, momentLocalizer, SlotInfo, stringOrDate, Views} from "react-big-calendar";
import moment from "moment";
import PlainCalendarTest from "@/components/schedule/test";
import withDragAndDrop from "react-big-calendar/lib/addons/dragAndDrop";

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';
// import 'react-big-calendar/lib/sass/styles.scss';


const DnDCalendar = withDragAndDrop<Period, Room>(Calendar);

export default function SchedulePage() {
  // const [schedules, setSchedules] = useState<WeekSchedule[]>([]);
  const [periods, setPeriods] = useState<Period[]>([]);
  // const [selectedWeek, setSelectedWeek] = useState<number>(1);
  const [scheduleConfig, setScheduleConfig] = useState<ScheduleConfig>(DEFAULT_SCHEDULE_CONFIG);
  const [selectedPeriod, setSelectedPeriod] = useState<Partial<Period>>();
  const [openPeriodDialog, setOpenPeriodDialog] = useState<boolean>(false);
  const [openDeleteDialog, setOpenDeleteDialog] = useState<boolean>(false);


  const handleEditPeriod = (period: Period) => {
    setSelectedPeriod(period)
    setOpenPeriodDialog(true);
  };


  const handleSavePeriod = () => {
    if (!selectedPeriod || selectedPeriod.name === '') return;

    const newPeriod: Period = {
      id: selectedPeriod.id || `period-${Date.now()}`,
      name: selectedPeriod.name || '',
      subject: selectedPeriod.subject || '',
      startTime: selectedPeriod.startTime || dayjs(),
      endTime: selectedPeriod.endTime || dayjs(),
      type: selectedPeriod.type || 'exercise',
      location: selectedPeriod.location || '',
      instructors: selectedPeriod.instructors || [],
      notes: selectedPeriod.notes || '',
      locked: selectedPeriod.locked || false,
      required: selectedPeriod.required || false,
    };

      setPeriods((prev) => [...prev, newPeriod]);
      console.log(periods);
      setOpenPeriodDialog(false);
  };


  const handleSlotSelect = (slotInfo: {
      start: stringOrDate;
      end: stringOrDate;
      slots: Date[] | string[];
      action: 'select' | 'click' | 'doubleClick';
  }): void => {
      console.log("Selected slot");
      // if (slotInfo.action == "doubleClick") {
          const newPeriod: Partial<Period> = {
              startTime: dayjs(slotInfo.start),
              endTime: dayjs(slotInfo.end),
          };
          setSelectedPeriod(newPeriod);
          setOpenPeriodDialog(true);
      // }
  };
    const handleSelectSlot = (slotInfo: SlotInfo) => {
        console.log("Selected slot:", slotInfo);
    };


  // const currentWeek = schedules.find(w => w.weekNumber === selectedWeek);
  return (
    <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="he">
      <Box sx={{ p: 3, maxWidth: '100%', direction: 'rtl' }}>
        <div>
          <Calendar
              localizer={momentLocalizer(moment)}
              events={periods}
              defaultView={"week"}
              views={[Views.DAY, Views.WEEK]} // restrict to day/week
              selectable
              onSelectEvent={setSelectedPeriod}
              onSelectSlot={handleSlotSelect}
              // onDoubleClickEvent={(event: Period)=>{setSelectedEvent(event);setEventEditOpen(true)}}
              startAccessor={(event) => event.startTime.toDate()}
              endAccessor={(event) => event.endTime.toDate()}
              rtl={true}
              style={{ height: "100%" }}
          />
        </div>

        {/* Period Dialog */}
        <PeriodDialog
          open={openPeriodDialog}
          period={selectedPeriod}
          isEdit={true}
          onClose={() => {setOpenPeriodDialog(false); setSelectedPeriod(undefined)}}
          onSave={handleSavePeriod}
          onPeriodChange={(updates) => setSelectedPeriod({ ...selectedPeriod, ...updates })}
        />

        {/* Delete Dialog */}
        {/*<DeleteDialog*/}
        {/*  open={openDeleteDialog}*/}
        {/*  period={selectedPeriod}*/}
        {/*  onClose={() => {setOpenDeleteDialog(false); setSelectedPeriod(undefined)}}*/}
        {/*  onConfirm={handleConfirmDelete}*/}
        {/*/>*/}
      </Box>
    </LocalizationProvider>
  );
}

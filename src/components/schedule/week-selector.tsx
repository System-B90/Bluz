'use client';

import React from 'react';
import {
  Box,
  Paper,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Divider,
} from '@mui/material';
import { Add as AddIcon } from '@mui/icons-material';

interface WeekSelectorProps {
  selectedWeek: number;
  weeks: number[];
  onWeekChange: (week: number) => void;
  onAddWeek: () => void;
  onAddPeriod: () => void;
}

export default function WeekSelector({
  selectedWeek,
  weeks,
  onWeekChange,
  onAddWeek,
  onAddPeriod,
}: WeekSelectorProps) {
  const handleWeekChange = (value: number) => {
    if (value === -1) {
      // Special value for "add week" option
      onAddWeek();
    } else {
      onWeekChange(value);
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3, direction: 'rtl' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
        {/* Add Period Button - Rightmost in RTL */}
        <Button
          variant="contained"
          size="small"
          startIcon={<AddIcon />}
          onClick={onAddPeriod}
          sx={{ height: 36, minWidth: 120 }}
        >
          הוסף מופע
        </Button>

        <Divider orientation="vertical" flexItem />

        {/* Week Selection with Add Week Option - Leftmost in RTL */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>שבוע</InputLabel>
            <Select
              value={selectedWeek}
              label="שבוע"
              onChange={(e) => handleWeekChange(Number(e.target.value))}
              sx={{ height: 36 }}
            >
              {weeks.map((week) => (
                <MenuItem key={week} value={week}>
                  {week}
                </MenuItem>
              ))}
              <Divider />
              <MenuItem value={-1} sx={{ fontStyle: 'italic', color: '#000000' }}>
                + הוסף שבוע חדש
              </MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Future buttons can be added here */}
        {/* <Divider orientation="vertical" flexItem />
        <Button variant="outlined" size="small" sx={{ height: 36 }}>
          Future Button
        </Button> */}
      </Box>
    </Paper>
  );
}

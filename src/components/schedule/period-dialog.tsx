'use client';

import React from 'react';
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  Switch,
  FormControlLabel,
  Button,
  Chip,
  Autocomplete,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { Check as CheckIcon } from '@mui/icons-material';
import dayjs from 'dayjs';
import { Period, EVENT_TYPES, DAYS_OF_WEEK, DEFAULT_INSTRUCTORS } from './types';

interface PeriodDialogProps {
  open: boolean;
  period: Partial<Period> | null;
  isEdit: boolean;
  selectedDayIndex: number;
  onClose: () => void;
  onSave: () => void;
  onPeriodChange: (updates: Partial<Period>) => void;
  onDayChange: (dayIndex: number) => void;
}

export default function PeriodDialog({
  open,
  period,
  isEdit,
  selectedDayIndex,
  onClose,
  onSave,
  onPeriodChange,
  onDayChange,
}: PeriodDialogProps) {
  if (!period) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        {isEdit ? 'ערוך מופע' : 'הוסף מופע חדש'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 1 }}>
          {/* Day Selection (only show when adding new period) */}
          {!isEdit && (
            <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
              <FormControl fullWidth>
                <InputLabel>יום</InputLabel>
                <Select
                  value={selectedDayIndex}
                  label="יום"
                  onChange={(e) => onDayChange(Number(e.target.value))}
                >
                  {DAYS_OF_WEEK.map((day, index) => (
                    <MenuItem key={index} value={index}>
                      {day}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

          <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <TextField
              fullWidth
              label="שם המופע"
              value={period.name || ''}
              onChange={(e) => onPeriodChange({ name: e.target.value })}
              required
            />
          </Box>

          <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <TextField
              fullWidth
              label="נושא"
              value={period.subject || ''}
              onChange={(e) => onPeriodChange({ subject: e.target.value })}
              placeholder="הזן שם הנושא"
            />
          </Box>

          <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <FormControl fullWidth>
              <InputLabel>סוג המופע</InputLabel>
              <Select
                value={period.type || 'exercise'}
                label="סוג המופע"
                onChange={(e) => onPeriodChange({ type: e.target.value as any })}
              >
                {EVENT_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    {type.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <TimePicker
              label="שעת התחלה"
              value={period.startTime || dayjs()}
              onChange={(time) => onPeriodChange({ startTime: time || dayjs() })}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Box>

          <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <TimePicker
              label="שעת סיום"
              value={period.endTime || dayjs()}
              onChange={(time) => onPeriodChange({ endTime: time || dayjs() })}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </Box>

          <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <TextField
              fullWidth
              label="מיקום"
              value={period.location || ''}
              onChange={(e) => onPeriodChange({ location: e.target.value })}
            />
          </Box>

          <Box sx={{ flex: '1 1 300px', minWidth: '300px' }}>
            <Autocomplete
              multiple
              options={DEFAULT_INSTRUCTORS}
              getOptionLabel={(option) => option.name}
              value={DEFAULT_INSTRUCTORS.filter(instructor => 
                period.instructors?.includes(instructor.id)
              )}
              onChange={(_, newValue) => {
                onPeriodChange({ 
                  instructors: newValue.map(instructor => instructor.id)
                });
              }}
              renderInput={(params) => (
                <TextField {...params} label="מדריכים" placeholder="בחר מדריכים" />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option.id}
                    label={option.name}
                    size="small"
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
          </Box>

          <Box sx={{ flex: '1 1 100%', minWidth: '100%' }}>
            <TextField
              fullWidth
              label="הערות"
              multiline
              rows={3}
              value={period.notes || ''}
              onChange={(e) => onPeriodChange({ notes: e.target.value })}
            />
          </Box>

          <Box sx={{ flex: '1 1 100%', minWidth: '100%' }}>
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={period.locked || false}
                    onChange={(e) => onPeriodChange({ locked: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-thumb': {
                        position: 'relative',
                      },
                      '& .MuiSwitch-thumb.Mui-checked': {
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '8px',
                          height: '8px',
                          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>')}")`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                        }
                      }
                    }}
                  />
                }
                label="נעול"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={period.potentialPA || false}
                    onChange={(e) => onPeriodChange({ potentialPA: e.target.checked })}
                    sx={{
                      '& .MuiSwitch-thumb': {
                        position: 'relative',
                      },
                      '& .MuiSwitch-thumb.Mui-checked': {
                        '&::after': {
                          content: '""',
                          position: 'absolute',
                          top: '50%',
                          left: '50%',
                          transform: 'translate(-50%, -50%)',
                          width: '8px',
                          height: '8px',
                          backgroundImage: `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>')}")`,
                          backgroundSize: 'contain',
                          backgroundRepeat: 'no-repeat',
                        }
                      }
                    }}
                  />
                }
                label="פוטנציאל פ״א"
              />
            </Box>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          ביטול
        </Button>
        <Button
          onClick={onSave}
          variant="contained"
          disabled={!period.name}
        >
          שמור מופע
        </Button>
      </DialogActions>
    </Dialog>
  );
}

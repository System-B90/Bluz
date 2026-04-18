"use client";

import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  OutlinedInput,
  Select,
  TextField,
} from "@mui/material";
import { useState } from "react";

import { Group } from "@/components/schedule/types/group";

interface GroupDialogProps {
  open: boolean;
  group: Partial<Group>;
  onClose: () => void;
  onSave: (group: Group) => void;
}

export function GroupDialog({
  open,
  group: _group,
  onClose,
  onSave: _onSave,
}: GroupDialogProps) {
  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [color, setColor] = useState("#1976d2");
  const [groups, setGroups] = useState<string[]>([]);

  const handleSave = () => {
    // onSave({id: "", name, displayName, defaultGroupIDs: groups });
    setName("");
    setDisplayName("");
    setColor("#1976d2");
    setGroups([]);
    onClose();
  };

  return (
    <Dialog fullWidth maxWidth="sm" onClose={onClose} open={open}>
      <DialogTitle>Define New Subject</DialogTitle>
      <DialogContent
        sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}
      >
        <TextField
          fullWidth
          label="Name"
          onChange={(e) => setName(e.target.value)}
          value={name}
        />
        <TextField
          fullWidth
          label="Display Name"
          onChange={(e) => setDisplayName(e.target.value)}
          value={displayName}
        />
        <Box alignItems="center" display="flex" gap={2}>
          <TextField
            label="Color"
            onChange={(e) => setColor(e.target.value)}
            sx={{ width: 120 }}
            type="color"
            value={color}
          />
          <Box sx={{ fontWeight: 500 }}>{color}</Box>
        </Box>
        <FormControl fullWidth>
          <InputLabel>Assigned Groups</InputLabel>
          <Select
            input={<OutlinedInput label="Assigned Groups" />}
            multiple
            onChange={(e) => setGroups(e.target.value as string[])}
            renderValue={(selected) => (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                {selected.map((value) => (
                  <Chip key={value} label={value} />
                ))}
              </Box>
            )}
            value={groups}
          >
            {/*{availableGroups.map((group) => (*/}
            {/*    <MenuItem key={group} value={group}>*/}
            {/*        {group}*/}
            {/*    </MenuItem>*/}
            {/*))}*/}
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained">
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

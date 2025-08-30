'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Instructor, DEFAULT_INSTRUCTORS } from './types';

interface InstructorContextType {
  instructors: Instructor[];
  addInstructor: (name: string, rank?: string) => void;
  updateInstructor: (id: string, updates: Partial<Instructor>) => void;
  deleteInstructor: (id: string) => void;
  getInstructorName: (instructorId: string) => string;
  getInstructorRank: (instructorId: string) => string | undefined;
}

const InstructorContext = createContext<InstructorContextType | undefined>(undefined);

export const useInstructors = () => {
  const context = useContext(InstructorContext);
  if (!context) {
    throw new Error('useInstructors must be used within an InstructorProvider');
  }
  return context;
};

interface InstructorProviderProps {
  children: ReactNode;
}

export const InstructorProvider: React.FC<InstructorProviderProps> = ({ children }) => {
  const [instructors, setInstructors] = useState<Instructor[]>(DEFAULT_INSTRUCTORS);

  // Load instructors from localStorage on mount
  useEffect(() => {
    const savedInstructors = localStorage.getItem('schedule-instructors');
    if (savedInstructors) {
      try {
        const parsed = JSON.parse(savedInstructors);
        setInstructors(parsed);
      } catch (error) {
        console.error('Failed to parse saved instructors:', error);
      }
    }
  }, []);

  // Save instructors to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('schedule-instructors', JSON.stringify(instructors));
  }, [instructors]);

  const addInstructor = (name: string, rank?: string) => {
    const newInstructor: Instructor = {
      id: `instructor-${Date.now()}`,
      name,
      rank,
    };
    setInstructors(prev => [...prev, newInstructor]);
  };

  const updateInstructor = (id: string, updates: Partial<Instructor>) => {
    setInstructors(prev => 
      prev.map(instructor => 
        instructor.id === id ? { ...instructor, ...updates } : instructor
      )
    );
  };

  const deleteInstructor = (id: string) => {
    setInstructors(prev => prev.filter(instructor => instructor.id !== id));
  };

  const getInstructorName = (instructorId: string): string => {
    const instructor = instructors.find(i => i.id === instructorId);
    return instructor?.name || 'לא ידוע';
  };

  const getInstructorRank = (instructorId: string): string | undefined => {
    const instructor = instructors.find(i => i.id === instructorId);
    return instructor?.rank;
  };

  const value: InstructorContextType = {
    instructors,
    addInstructor,
    updateInstructor,
    deleteInstructor,
    getInstructorName,
    getInstructorRank,
  };

  return (
    <InstructorContext.Provider value={value}>
      {children}
    </InstructorContext.Provider>
  );
};

'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Subject, DEFAULT_SUBJECTS } from './types';

interface SubjectContextType {
  subjects: Subject[];
  addSubject: (name: string, color: string) => void;
  updateSubjectColor: (id: string, color: string) => void;
  getSubjectColor: (subjectId: string) => string;
  getSubjectName: (subjectId: string) => string;
}

const SubjectContext = createContext<SubjectContextType | undefined>(undefined);

export const useSubjects = () => {
  const context = useContext(SubjectContext);
  if (!context) {
    throw new Error('useSubjects must be used within a SubjectProvider');
  }
  return context;
};

interface SubjectProviderProps {
  children: ReactNode;
}

export const SubjectProvider: React.FC<SubjectProviderProps> = ({ children }) => {
  const [subjects, setSubjects] = useState<Subject[]>(DEFAULT_SUBJECTS);

  // Load subjects from localStorage on mount
  useEffect(() => {
    const savedSubjects = localStorage.getItem('schedule-subjects');
    if (savedSubjects) {
      try {
        const parsed = JSON.parse(savedSubjects);
        setSubjects(parsed);
      } catch (error) {
        console.error('Failed to parse saved subjects:', error);
      }
    }
  }, []);

  // Save subjects to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('schedule-subjects', JSON.stringify(subjects));
  }, [subjects]);

  const addSubject = (name: string, color: string) => {
    const newSubject: Subject = {
      id: `subject-${Date.now()}`,
      name,
      color,
    };
    setSubjects(prev => [...prev, newSubject]);
  };

  const updateSubjectColor = (id: string, color: string) => {
    setSubjects(prev => 
      prev.map(subject => 
        subject.id === id ? { ...subject, color } : subject
      )
    );
  };

  const getSubjectColor = (subjectId: string): string => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.color || '#e0e0e0'; // Default gray if subject not found
  };

  const getSubjectName = (subjectId: string): string => {
    const subject = subjects.find(s => s.id === subjectId);
    return subject?.name || 'לא ידוע';
  };

  const value: SubjectContextType = {
    subjects,
    addSubject,
    updateSubjectColor,
    getSubjectColor,
    getSubjectName,
  };

  return (
    <SubjectContext.Provider value={value}>
      {children}
    </SubjectContext.Provider>
  );
};

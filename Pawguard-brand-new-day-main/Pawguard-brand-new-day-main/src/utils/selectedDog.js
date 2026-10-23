// src/utils/selectedDog.js
// Remembers which pet is selected on the dashboard so other screens
// (History, etc.) can show data for that same pet.
import { useSyncExternalStore } from 'react';

let selectedDogId = null;
const listeners = new Set();

export const getSelectedDogId = () => selectedDogId;

export const setSelectedDogId = (id) => {
  if (id === selectedDogId) return;
  selectedDogId = id;
  listeners.forEach((listener) => listener());
};

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// Re-renders the component whenever the selected pet changes
export const useSelectedDogId = () =>
  useSyncExternalStore(subscribe, getSelectedDogId, getSelectedDogId);
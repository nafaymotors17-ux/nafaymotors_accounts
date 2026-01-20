"use client";

// Client-side session utilities for localStorage

const SESSION_KEY = "user_session";

export function getSessionFromStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const sessionData = localStorage.getItem(SESSION_KEY);
    if (!sessionData) {
      return null;
    }
    return JSON.parse(sessionData);
  } catch (error) {
    console.error("Error reading session from localStorage:", error);
    return null;
  }
}

export function setSessionInStorage(session) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    console.error("Error saving session to localStorage:", error);
  }
}

export function clearSessionFromStorage() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (error) {
    console.error("Error clearing session from localStorage:", error);
  }
}

"use client";

import { Databases } from "appwrite";
import { getFirebaseAuth } from "@/lib/firebase/config";

export function getBrowserClient(): null {
  return null;
}

export function getBrowserAccount() {
  return getFirebaseAuth();
}

export function getBrowserDatabases(_jwt?: string): Databases {
  void _jwt;
  return new Databases();
}

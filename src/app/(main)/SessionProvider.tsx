"use client";

import { Session } from "lucia";
import { User } from "@prisma/client";
import React, { createContext, useContext } from "react";

// Extend the User type to match what lucia returns
interface SessionUser extends Omit<User, 'balance'> {
  balance: string; // Lucia converts Decimal to string
}

interface SessionContext {
  user: SessionUser;
  session: Session;
  _sessionLoadTime?: number; // Optional timestamp when session was loaded
}

const SessionContext = createContext<SessionContext | null>(null);

export default function SessionProvider({
  children,
  value,
}: React.PropsWithChildren<{ value: { user: any; session: Session; _sessionLoadTime?: number } }>) {
  return (
    <SessionContext.Provider value={value as SessionContext}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}

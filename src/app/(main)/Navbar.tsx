"use client";

import SearchField from "@/components/SearchField";
import UserButton from "@/components/UserButton";
import BalanceMenu from "@/components/BalanceMenu";
import Link from "next/link";
import { useSession } from "./SessionProvider";
import { useState } from "react";

export default function Navbar() {
  const { user } = useSession();
  const [showBalanceMenu, setShowBalanceMenu] = useState(false);

  // Parse the balance string to a number for display
  const displayBalance = user?.balance 
    ? parseFloat(user.balance.toString()).toFixed(2)
    : "0.00";

  return (
    <header className="sticky top-0 z-10 bg-card shadow-sm">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-5 px-5 py-3">
        <Link href="/" className="text-2xl font-bold text-primary">
          KinkyFans
        </Link>
        <SearchField />
        <div className="flex items-center gap-4 sm:ms-auto">
          {user?.balance !== undefined && (
            <div className="relative">
              <button
                onClick={() => setShowBalanceMenu(!showBalanceMenu)}
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                ${displayBalance}
              </button>
              {showBalanceMenu && (
                <BalanceMenu onClose={() => setShowBalanceMenu(false)} />
              )}
            </div>
          )}
          <UserButton />
        </div>
      </div>
    </header>
  );
}
"use client";

import { ETHEREUM_RECIPIENT_ADDRESS } from "@/lib/paymentConfig";

export default function EnvTester() {
  return (
    <div className="p-4 border rounded-md max-w-lg mx-auto my-4 bg-white dark:bg-gray-800">
      <h2 className="text-lg font-semibold mb-2">Environment Variable Tester</h2>
      <div className="space-y-2">
        <div>
          <span className="font-medium mr-2">NEXT_PUBLIC_ETH_RECIPIENT_ADDRESS:</span>
          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded text-sm">
            {process.env.NEXT_PUBLIC_ETH_RECIPIENT_ADDRESS || "Not set"}
          </code>
        </div>
        <div>
          <span className="font-medium mr-2">Current recipient address from config:</span>
          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded text-sm break-all">
            {ETHEREUM_RECIPIENT_ADDRESS}
          </code>
        </div>
        <div className="text-xs mt-4 text-gray-600 dark:text-gray-400">
          <p>This component shows the current Ethereum recipient address that will be used for payments.</p>
          <p>If the address is not what you expect, check your .env file and make sure NEXT_PUBLIC_ETH_RECIPIENT_ADDRESS is set correctly.</p>
        </div>
      </div>
    </div>
  );
}

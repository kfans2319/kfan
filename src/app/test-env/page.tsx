import EnvTester from "@/components/EnvTester";
import { ETHEREUM_RECIPIENT_ADDRESS } from "@/lib/paymentConfig";

export default function TestEnvPage() {
  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Environment Variables Test</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Client-Side Environment Variable</h2>
       
      </div>
      
      <div className="mb-8 p-4 border rounded-md bg-white dark:bg-gray-800">
        <h2 className="text-xl font-semibold mb-2">Server-Side Environment Variable</h2>
        <div>
          <p className="mb-2">Value from server-side:</p>
          <code className="px-2 py-1 bg-gray-100 dark:bg-gray-900 rounded text-sm break-all">
            
          </code>
          <p className="text-xs mt-4 text-gray-600 dark:text-gray-400">
            This shows the server-side rendering of the value, which may not be the same as what the browser uses.
          </p>
        </div>
      </div>
    </div>
  );
}

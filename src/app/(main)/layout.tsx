import { validateRequest } from "@/auth";
import { redirect } from "next/navigation";
import MenuBar from "./MenuBar";
import Navbar from "./Navbar";
import SessionProvider from "./SessionProvider";
import { headers } from "next/headers";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Add a unique cache-busting request ID to ensure fresh session data on each request
  const headersList = headers();
  const userAgent = headersList.get('user-agent') || '';
  const requestTime = Date.now();
  
  // Force a fresh validation of the request after login to ensure session data is up-to-date
  const session = await validateRequest();

  if (!session.user) {
    console.log("Session validation failed: No user found");
    redirect("/login");
  }

  // Ensure session has all required data
  if (!session.user.id) {
    console.error("Session validation failed: Missing user ID");
    redirect("/login");
  }

  // Store the timestamp when the session was validated 
  const sessionValidationTime = Date.now();

  return (
    <SessionProvider value={{
      ...session,
      _sessionLoadTime: sessionValidationTime
    }}>
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <div className="mx-auto flex w-full max-w-7xl grow gap-5 p-5">
          <MenuBar className="sticky top-[5.25rem] hidden h-fit flex-none space-y-3 rounded-2xl bg-card px-3 py-5 shadow-sm sm:block lg:px-5 xl:w-80" />
          {children}
        </div>
        <MenuBar className="sticky bottom-0 flex w-full justify-center gap-5 border-t bg-card p-3 sm:hidden" />
      </div>
    </SessionProvider>
  );
}

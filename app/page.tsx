
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface SessionUser {
  User_ID: number;
  Username: string;
  Email: string;
  Roles: string[];
}

const modules = [
  {
    name: "Customers",
    description: "Manage customer information and profiles",
    icon: "👥",
    color: "bg-blue-50 text-blue-700",
  },
  {
    name: "Vehicles",
    description: "Manage registered customer vehicles",
    icon: "🚗",
    color: "bg-indigo-50 text-indigo-700",
  },
  {
    name: "Bookings",
    description: "Schedule and manage service appointments",
    icon: "📅",
    color: "bg-purple-50 text-purple-700",
  },
  {
    name: "Services",
    description: "Manage available maintenance services",
    icon: "🔧",
    color: "bg-orange-50 text-orange-700",
  },
  {
    name: "Mechanics",
    description: "Manage mechanics and specializations",
    icon: "👨‍🔧",
    color: "bg-teal-50 text-teal-700",
  },
  {
    name: "Invoices",
    description: "Generate and manage customer invoices",
    icon: "📄",
    color: "bg-yellow-50 text-yellow-700",
  },
  {
    name: "Payments",
    description: "Track customer payments and transactions",
    icon: "💳",
    color: "bg-green-50 text-green-700",
  },
  {
    name: "Service Reports",
    description: "View vehicle inspection and service reports",
    icon: "📋",
    color: "bg-pink-50 text-pink-700",
  },
  {
    name: "Vehicle Diagnostics",
    description: "Monitor vehicle health and diagnostics",
    icon: "🩺",
    color: "bg-cyan-50 text-cyan-700",
  },
  {
    name: "Customer Feedback",
    description: "Review customer ratings and feedback",
    icon: "⭐",
    color: "bg-rose-50 text-rose-700",
  },
];

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const isCustomer = user?.Roles.includes("Customer");

const visibleModules = isCustomer
  ? modules.filter((module) =>
      [
        "Customers",
        "Vehicles",
        "Bookings",
        "Invoices",
        "Payments",
        "Customer Feedback",
        "Vehicle Diagnostics",
      ].includes(module.name)
    )
  : modules.filter(
      (module) => module.name !== "Customer Feedback"
    );

const customerLabels: Record<string, string> = {
  Customers: "My Profile",
  Vehicles: "My Vehicles",
  Bookings: "My Bookings",
  Invoices: "My Invoices",
  Payments: "My Payments",
  "Vehicle Diagnostics": "My Vehicle Diagnostics",
  "Customer Feedback": "Customer Feedback",
};
const customerDescriptions: Record<string, string> = {
  Customers: "View your personal profile information",
  Vehicles: "View and manage your registered vehicles",
  Bookings: "Schedule and track your service appointments",
  Invoices: "View invoices generated for your bookings",
  Payments: "View your payment history and submit payment records",
  "Vehicle Diagnostics": "View diagnostic reports for your vehicles",
  "Customer Feedback": "Submit and review your service feedback",
};

  useEffect(() => {
    async function getSession() {
      try {
        const response = await fetch("/api/auth/me", {
          cache: "no-store",
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setError("Unable to connect to the server.");
      } finally {
        setLoading(false);
      }
    }

    getSession();
  }, []);

  async function handleLogout() {
    setLoggingOut(true);
    setError("");

    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      setUser(null);
      router.refresh();
    } catch {
      setError("Unable to logout. Please try again.");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">

      {/* Navigation */}
      <nav className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">

          <div>
            <h1 className="text-xl font-bold text-blue-700">
              AutoCare
            </h1>

            <p className="text-xs text-slate-500">
              Car Service Management System
            </p>
          </div>

          {user && (
            <div className="flex items-center gap-4">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold text-slate-800">
                  {user.Username}
                </p>

                <p className="text-xs text-slate-500">
                  {user.Roles.join(", ")}
                </p>
              </div>

              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          )}

        </div>
      </nav>

      <div className="mx-auto max-w-7xl px-6 py-10">

        {loading ? (
          <div className="py-24 text-center text-slate-500">
            Checking your login session...
          </div>
        ) : !user ? (

          /* Not logged in */
          <div className="mx-auto mt-16 max-w-xl rounded-2xl bg-white p-10 text-center shadow-sm">

            <div className="mb-5 text-5xl">🚗</div>

            <h2 className="text-3xl font-bold text-slate-800">
              Welcome to AutoCare
            </h2>

            <p className="mt-3 text-slate-500">
              Manage vehicle services, bookings, customers and payments
              through one platform.
            </p>

            <div className="mt-8 flex justify-center gap-4">
              <a
                href="/login"
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Login
              </a>

              <a
                href="/register"
                className="rounded-lg border border-slate-300 px-6 py-3 font-semibold text-slate-700 hover:bg-slate-50"
              >
                Register
              </a>
            </div>

          </div>

        ) : (

          /* Logged-in Dashboard */
          <>
            <section className="mb-10 rounded-2xl bg-gradient-to-r from-blue-700 to-indigo-700 p-8 text-white shadow-lg">

              <p className="text-sm font-medium text-blue-100">
                MANAGEMENT DASHBOARD
              </p>

              <h2 className="mt-3 text-3xl font-bold">
                Welcome back, {user.Username}!
              </h2>

              <p className="mt-3 max-w-2xl text-blue-100">
                Manage your car service operations, monitor bookings,
                maintain vehicle records and track payments.
              </p>

              <div className="mt-6 inline-block rounded-full bg-white/20 px-4 py-2 text-sm">
                Logged in as: {user.Roles.join(", ")}
              </div>

            </section>

            {/* Management Modules */}
            <section>
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-slate-800">
                  {isCustomer ? "My Service Portal" : "Management Modules"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Overview of the modules available in your system.
                </p>
              </div>

              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

                {visibleModules.map((module) => (
                  <a
                    key={module.name}
                    href={`/${module.name.toLowerCase().replaceAll(" ", "-")}`}
                    className="block cursor-pointer rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                  >
                    <div
                      className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${module.color}`}
                    >
                      {module.icon}
                    </div>

                    <h3 className="font-bold text-slate-800">
                      {isCustomer
                        ? customerLabels[module.name] || module.name
                        : module.name}
                    </h3>

                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      {isCustomer
                        ? customerDescriptions[module.name] || module.description
                        : module.description}
                    </p>
                  </a>
                ))}

              </div>
            </section>
          </>
        )}

        {error && (
          <p className="mt-6 text-center text-sm text-red-600">
            {error}
          </p>
        )}

        <footer className="mt-16 border-t border-slate-200 py-6 text-center text-sm text-slate-400">
          Car Service Management System © 2026
        </footer>

      </div>
    </main>
  );
}

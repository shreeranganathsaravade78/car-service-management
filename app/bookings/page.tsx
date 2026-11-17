
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

interface Vehicle {
  Vehicle_ID: number;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  First_Name: string;
  Last_Name: string;
}

interface Booking {
  Booking_ID: number;
  Vehicle_ID: number;
  Booking_Date: string;
  Appointment_Date: string;
  Appointment_Time: string;
  Problem_Description: string | null;
  Booking_Status: string;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
}

interface BookingForm {
  Vehicle_ID: string;
  Appointment_Date: string;
  Appointment_Time: string;
  Problem_Description: string;
  Booking_Status: string;
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  bookings?: Booking[];
  vehicles?: Vehicle[];
  user?: {
    Roles?: string[];
    roles?: string[];
  };
  data?: {
    user?: {
      Roles?: string[];
      roles?: string[];
    };
    Roles?: string[];
    roles?: string[];
  };
  Roles?: string[];
  roles?: string[];
}

const emptyForm: BookingForm = {
  Vehicle_ID: "",
  Appointment_Date: "",
  Appointment_Time: "",
  Problem_Description: "",
  Booking_Status: "Pending",
};

const statuses = [
  "Pending",
  "Confirmed",
  "In Progress",
  "Completed",
  "Cancelled",
];

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "-";
}

function formatTime(value: string | null | undefined) {
  return value ? value.slice(0, 5) : "-";
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const [form, setForm] = useState<BookingForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isStaff = roles.some((role) =>
    ["Admin", "Receptionist"].includes(role)
  );

  const isCustomer = roles.includes("Customer") && !isStaff;

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [authResponse, bookingResponse, vehicleResponse] =
        await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/bookings", { cache: "no-store" }),
          fetch("/api/vehicles", { cache: "no-store" }),
        ]);

      const authData = (await authResponse.json()) as ApiResponse;
      const bookingData = (await bookingResponse.json()) as ApiResponse;
      const vehicleData = (await vehicleResponse.json()) as ApiResponse;

      if (!authResponse.ok) {
        throw new Error(authData.message || "Unable to verify your account");
      }

      if (!bookingResponse.ok) {
        throw new Error(bookingData.message || "Unable to fetch bookings");
      }

      if (!vehicleResponse.ok) {
        throw new Error(vehicleData.message || "Unable to fetch vehicles");
      }

      const authUser =
        authData.user ?? authData.data?.user ?? authData.data ?? authData;

      const userRoles = authUser.Roles ?? authUser.roles ?? [];

      if (!Array.isArray(userRoles)) {
        throw new Error("Unable to identify your account role");
      }

      setRoles(userRoles.filter((role): role is string =>
        typeof role === "string"
      ));

      setBookings(bookingData.bookings ?? []);
      setVehicles(vehicleData.vehicles ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load booking data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredBookings = useMemo(() => {
    const term = search.toLowerCase();

    return bookings.filter((booking) =>
      [
        booking.Registration_Number,
        booking.Manufacturer,
        booking.Model,
        booking.First_Name,
        booking.Last_Name,
        booking.Booking_Status,
        String(booking.Booking_ID),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [bookings, search]);

  function handleChange(
    e: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function startEdit(booking: Booking) {
    setEditingId(booking.Booking_ID);

    setForm({
      Vehicle_ID: String(booking.Vehicle_ID),
      Appointment_Date: formatDate(booking.Appointment_Date),
      Appointment_Time: formatTime(booking.Appointment_Time),
      Problem_Description: booking.Problem_Description || "",
      Booking_Status: booking.Booking_Status,
    });

    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setMessage("");
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload: Record<string, string | number> = {
        Appointment_Date: form.Appointment_Date,
        Appointment_Time: form.Appointment_Time,
        Problem_Description: form.Problem_Description,
      };

      // Customers select a vehicle only when creating a booking.
      // Staff can select or change the vehicle for any booking.
      if (!editingId || isStaff) {
        payload.Vehicle_ID = Number(form.Vehicle_ID);
      }

      // Only staff can change booking status.
      if (isStaff && editingId) {
        payload.Booking_Status = form.Booking_Status;
      }

      const response = await fetch(
        editingId ? `/api/bookings/${editingId}` : "/api/bookings",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save booking");
      }

      setMessage(data.message || "Booking saved successfully");
      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save booking"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(bookingId: number) {
    if (!isStaff) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this booking?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/bookings/${bookingId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete booking");
      }

      setMessage(data.message || "Booking deleted successfully");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete booking"
      );
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="/" className="text-sm text-blue-600 hover:underline">
              ← Back to Dashboard
            </a>

            <h1 className="mt-3 text-3xl font-bold text-slate-800">
              {isCustomer ? "My Bookings" : "Booking Management"}
            </h1>

            <p className="mt-2 text-slate-500">
              {isCustomer
                ? "View your service appointments and book a service for your vehicle."
                : "Schedule and manage vehicle service appointments."}
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">
              {isCustomer ? "My Bookings" : "Total Bookings"}
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {bookings.length}
            </p>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="mb-5 rounded-lg bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-5 rounded-lg bg-green-50 p-4 text-sm text-green-700">
            {message}
          </div>
        )}

        {/* Booking Form */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">
            {editingId
              ? isCustomer
                ? "Update Appointment"
                : "Update Booking"
              : isCustomer
                ? "Book a Service"
                : "Create New Booking"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {/* Vehicle selection */}
              {(!isCustomer || editingId === null) && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Select Vehicle *
                  </label>

                  <select
                    name="Vehicle_ID"
                    value={form.Vehicle_ID}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  >
                    <option value="">Select Vehicle</option>

                    {vehicles.map((vehicle) => (
                      <option
                        key={vehicle.Vehicle_ID}
                        value={vehicle.Vehicle_ID}
                      >
                        {vehicle.Registration_Number} — {vehicle.Manufacturer}{" "}
                        {vehicle.Model}
                        {isStaff
                          ? ` (${vehicle.First_Name} ${vehicle.Last_Name})`
                          : ""}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Customer sees their selected vehicle while editing */}
              {isCustomer && editingId !== null && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Vehicle
                  </label>
                  <div className={`${inputClass} bg-slate-50`}>
                    {bookings.find(
                      (booking) => booking.Booking_ID === editingId
                    )?.Registration_Number ?? "Your vehicle"}
                  </div>
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Appointment Date *
                </label>

                <input
                  type="date"
                  name="Appointment_Date"
                  value={form.Appointment_Date}
                  onChange={handleChange}
                  min={new Date().toLocaleDateString("en-CA")}
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Appointment Time *
                </label>

                <input
                  type="time"
                  name="Appointment_Time"
                  value={form.Appointment_Time}
                  onChange={handleChange}
                  required
                  className={inputClass}
                />
              </div>

              {/* Only staff can manage booking status */}
              {isStaff && (
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Booking Status
                  </label>

                  <select
                    name="Booking_Status"
                    value={form.Booking_Status}
                    onChange={handleChange}
                    disabled={!editingId}
                    className={inputClass}
                  >
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>

                  {!editingId && (
                    <p className="mt-1 text-xs text-slate-500">
                      New bookings start as Pending.
                    </p>
                  )}
                </div>
              )}

              <div className="sm:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Problem Description
                </label>

                <textarea
                  name="Problem_Description"
                  value={form.Problem_Description}
                  onChange={handleChange}
                  placeholder="Describe the vehicle problem..."
                  rows={3}
                  className={inputClass}
                />
              </div>
            </div>

            {isCustomer && editingId !== null && (
              <p className="mt-3 text-sm text-slate-500">
                You can update the appointment date, time and problem
                description. Booking status is managed by the service team.
              </p>
            )}

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="submit"
                disabled={
                  saving ||
                  loading ||
                  vehicles.length === 0 ||
                  (!editingId || isStaff
                    ? !form.Vehicle_ID
                    : false)
                }
                className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? isCustomer
                      ? "Update Appointment"
                      : "Update Booking"
                    : isCustomer
                      ? "Book Service"
                      : "Create Booking"}
              </button>

              {editingId !== null && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-lg border border-slate-300 px-6 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              )}
            </div>

            {!loading && vehicles.length === 0 && (
              <p className="mt-3 text-sm text-amber-700">
                Register a vehicle before creating a booking.
              </p>
            )}
          </form>
        </section>

        {/* Booking Records */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800">
              {isCustomer ? "My Booking Records" : "Booking Records"}
            </h2>

            <input
              type="text"
              placeholder="Search customer, vehicle or status..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading bookings...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] text-left text-sm text-slate-800">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">ID</th>
                    {isStaff && <th className="p-3">Customer</th>}
                    <th className="p-3">Vehicle</th>
                    <th className="p-3">Booking Date</th>
                    <th className="p-3">Appointment</th>
                    <th className="p-3">Problem</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredBookings.map((booking) => (
                    <tr
                      key={booking.Booking_ID}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-3">{booking.Booking_ID}</td>

                      {isStaff && (
                        <td className="p-3 font-medium">
                          {booking.First_Name} {booking.Last_Name}
                        </td>
                      )}

                      <td className="p-3">
                        <div className="font-medium">
                          {booking.Registration_Number}
                        </div>
                        <div className="text-xs text-slate-500">
                          {booking.Manufacturer} {booking.Model}
                        </div>
                      </td>

                      <td className="p-3">
                        {formatDate(booking.Booking_Date)}
                      </td>

                      <td className="p-3">
                        <div>{formatDate(booking.Appointment_Date)}</div>
                        <div className="text-xs text-slate-500">
                          {formatTime(booking.Appointment_Time)}
                        </div>
                      </td>

                      <td className="max-w-[180px] truncate p-3">
                        {booking.Problem_Description || "-"}
                      </td>

                      <td className="p-3">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {booking.Booking_Status}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(booking)}
                            className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>

                          {isStaff && (
                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(booking.Booking_ID)
                              }
                              className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredBookings.length === 0 && (
                    <tr>
                      <td
                        colSpan={isStaff ? 8 : 7}
                        className="p-8 text-center text-slate-500"
                      >
                        No bookings found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

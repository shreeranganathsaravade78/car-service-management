
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

interface Diagnostic {
  _id: string;
  vehicle_id: number;
  booking_id: number;
  diagnostic_date: string;
  engine_temperature: number;
  battery_voltage: number;
  oil_level: string;
  brake_condition: string;
  alerts: string[];
  overall_status: string;
}

interface DiagnosticForm {
  vehicle_id: string;
  booking_id: string;
  diagnostic_date: string;
  engine_temperature: string;
  battery_voltage: string;
  oil_level: string;
  brake_condition: string;
  alerts: string;
  overall_status: string;
}

interface AuthUser {
  Roles?: string[];
  roles?: string[];
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  diagnostics?: Diagnostic[];
  diagnostic?: Diagnostic;
  user?: AuthUser;
  data?: {
    user?: AuthUser;
    Roles?: string[];
    roles?: string[];
  };
  Roles?: string[];
  roles?: string[];
}

const emptyForm: DiagnosticForm = {
  vehicle_id: "",
  booking_id: "",
  diagnostic_date: "",
  engine_temperature: "",
  battery_voltage: "",
  oil_level: "Normal",
  brake_condition: "Good",
  alerts: "",
  overall_status: "Healthy",
};

export default function VehicleDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
  const [roles, setRoles] = useState<string[]>([]);
  const [form, setForm] = useState<DiagnosticForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = roles.includes("Admin");
  const isReceptionist = roles.includes("Receptionist");
  const isMechanic = roles.includes("Mechanic");
  const isCustomer = roles.includes("Customer");

  const canViewAll = isAdmin || isReceptionist || isMechanic;
  const canCreate = isAdmin || isMechanic;
  const canViewPage = canViewAll || isCustomer;

  async function loadDiagnostics() {
    setLoading(true);
    setError("");

    try {
      const [authResponse, diagnosticResponse] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/vehicle-diagnostics", { cache: "no-store" }),
      ]);

      const authData = (await authResponse.json()) as ApiResponse;
      const diagnosticData =
        (await diagnosticResponse.json()) as ApiResponse;

      if (!authResponse.ok) {
        throw new Error(authData.message || "Unable to verify your account");
      }

      if (!diagnosticResponse.ok) {
        throw new Error(
          diagnosticData.message || "Unable to fetch diagnostics"
        );
      }

      const authUser =
        authData.user ?? authData.data?.user ?? authData.data ?? authData;

      const userRoles =
        authUser.Roles ??
        authUser.roles ??
        authData.data?.Roles ??
        authData.data?.roles ??
        authData.Roles ??
        authData.roles ??
        [];

      if (!Array.isArray(userRoles)) {
        throw new Error("Unable to identify your account role");
      }

      setRoles(
        userRoles.filter(
          (role): role is string => typeof role === "string"
        )
      );

      setDiagnostics(diagnosticData.diagnostics ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to fetch diagnostics"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDiagnostics();
  }, []);

  const filteredDiagnostics = useMemo(() => {
    const term = search.toLowerCase();

    return diagnostics.filter((item) =>
      [
        item._id,
        String(item.vehicle_id),
        String(item.booking_id),
        item.oil_level,
        item.brake_condition,
        item.overall_status,
        ...(item.alerts ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [diagnostics, search]);

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

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setMessage("");
  }

  // Load an existing diagnostic record into the form.
  // Only Admin can edit diagnostic records.
  function startEdit(item: Diagnostic) {
    if (!isAdmin) return;

    setEditingId(item._id);

    setForm({
      vehicle_id: String(item.vehicle_id),
      booking_id: String(item.booking_id),
      diagnostic_date: item.diagnostic_date
        ? item.diagnostic_date.slice(0, 10)
        : "",
      engine_temperature: String(item.engine_temperature),
      battery_voltage: String(item.battery_voltage),
      oil_level: item.oil_level,
      brake_condition: item.brake_condition,
      alerts: (item.alerts ?? []).join("\n"),
      overall_status: item.overall_status,
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Create or update a diagnostic record.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!canCreate) return;

    // Only Admin can update existing diagnostic records.
    if (editingId !== null && !isAdmin) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        vehicle_id: Number(form.vehicle_id),
        booking_id: Number(form.booking_id),
        ...(form.diagnostic_date
          ? { diagnostic_date: form.diagnostic_date }
          : {}),
        engine_temperature: Number(form.engine_temperature),
        battery_voltage: Number(form.battery_voltage),
        oil_level: form.oil_level,
        brake_condition: form.brake_condition,
        alerts: form.alerts
          .split("\n")
          .map((alert) => alert.trim())
          .filter(Boolean),
        overall_status: form.overall_status,
      };

      const response = await fetch(
        editingId
          ? `/api/vehicle-diagnostics/${editingId}`
          : "/api/vehicle-diagnostics",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "Unable to save diagnostics");
      }

      setMessage(
        data.message ||
          (editingId
            ? "Diagnostics updated successfully"
            : "Diagnostics created successfully")
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadDiagnostics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save diagnostics"
      );
    } finally {
      setSaving(false);
    }
  }

  // Delete a diagnostic record.
  // Only Admin can delete diagnostic records.
  async function handleDelete(id: string) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this diagnostic record?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/vehicle-diagnostics/${id}`,
        {
          method: "DELETE",
        }
      );

      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete diagnostic");
      }

      if (editingId === id) {
        setForm(emptyForm);
        setEditingId(null);
      }

      setMessage(data.message || "Diagnostic deleted successfully");

      await loadDiagnostics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete diagnostic"
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
              {isCustomer ? "My Vehicle Diagnostics" : "Vehicle Diagnostics"}
            </h1>

            <p className="mt-2 text-slate-500">
              {isCustomer
                ? "View diagnostic reports for your vehicles."
                : "Record and monitor vehicle health information."}
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">
              {isCustomer ? "My Diagnostics" : "Total Diagnostics"}
            </p>

            <p className="text-2xl font-bold text-blue-700">
              {diagnostics.length}
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

        {loading ? (
          <div className="rounded-xl bg-white p-10 text-center text-slate-500 shadow-sm">
            Loading diagnostics...
          </div>
        ) : !canViewPage ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm">
            You do not have permission to access vehicle diagnostics.
          </div>
        ) : (
          <>
            {/* Diagnostic Form: Admin and Mechanic only */}
            {canCreate && (
              <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-xl font-bold text-slate-800">
                  {editingId
                    ? "Update Vehicle Diagnostics"
                    : "Record Vehicle Diagnostics"}
                </h2>

                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Vehicle ID *
                      </label>

                      <input
                        type="number"
                        name="vehicle_id"
                        min="1"
                        required
                        value={form.vehicle_id}
                        onChange={handleChange}
                        placeholder="Enter vehicle ID"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Booking ID *
                      </label>

                      <input
                        type="number"
                        name="booking_id"
                        min="1"
                        required
                        value={form.booking_id}
                        onChange={handleChange}
                        placeholder="Enter booking ID"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Diagnostic Date
                      </label>

                      <input
                        type="date"
                        name="diagnostic_date"
                        value={form.diagnostic_date}
                        onChange={handleChange}
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Engine Temperature (°C) *
                      </label>

                      <input
                        type="number"
                        name="engine_temperature"
                        min="0"
                        step="0.1"
                        required
                        value={form.engine_temperature}
                        onChange={handleChange}
                        placeholder="e.g. 90"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Battery Voltage (V) *
                      </label>

                      <input
                        type="number"
                        name="battery_voltage"
                        min="0"
                        step="0.1"
                        required
                        value={form.battery_voltage}
                        onChange={handleChange}
                        placeholder="e.g. 12.6"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Oil Level *
                      </label>

                      <select
                        name="oil_level"
                        value={form.oil_level}
                        onChange={handleChange}
                        required
                        className={inputClass}
                      >
                        <option value="Normal">Normal</option>
                        <option value="Low">Low</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Brake Condition *
                      </label>

                      <select
                        name="brake_condition"
                        value={form.brake_condition}
                        onChange={handleChange}
                        required
                        className={inputClass}
                      >
                        <option value="Good">Good</option>
                        <option value="Average">Average</option>
                        <option value="Poor">Poor</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Overall Status *
                      </label>

                      <select
                        name="overall_status"
                        value={form.overall_status}
                        onChange={handleChange}
                        required
                        className={inputClass}
                      >
                        <option value="Healthy">Healthy</option>
                        <option value="Needs Attention">Needs Attention</option>
                        <option value="Critical">Critical</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2 lg:col-span-3">
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Diagnostic Alerts
                      </label>

                      <textarea
                        name="alerts"
                        value={form.alerts}
                        onChange={handleChange}
                        rows={3}
                        placeholder={
                          "Enter each alert on a new line.\nExample: Battery voltage is low"
                        }
                        className={inputClass}
                      />

                      <p className="mt-1 text-xs text-slate-500">
                        Enter one alert per line. Leave empty if there are no
                        alerts.
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 flex flex-wrap gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      {saving
                        ? "Saving..."
                        : editingId
                          ? "Update Diagnostics"
                          : "Save Diagnostics"}
                    </button>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-lg border border-slate-300 px-6 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {editingId ? "Cancel" : "Reset"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {/* Receptionist message */}
            {isReceptionist && (
              <div className="mb-8 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-sm">
                You have read-only access to vehicle diagnostic records.
                Admins and mechanics can create diagnostic records.
              </div>
            )}

            {/* Customer message */}
            {isCustomer && (
              <div className="mb-8 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-sm">
                These diagnostic reports are associated with your vehicles.
                They are available for viewing only.
              </div>
            )}

            {/* Diagnostic Records */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">
                  {isCustomer ? "My Diagnostic Reports" : "Diagnostic Records"}
                </h2>

                <input
                  type="text"
                  placeholder="Search vehicle, booking or status..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
                />
              </div>

              <div className="overflow-x-auto">
                <table
                  className={`w-full text-left text-sm text-slate-800 ${
                    isAdmin ? "min-w-[1250px]" : "min-w-[1100px]"
                  }`}
                >
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">Diagnostic ID</th>
                      <th className="p-3">Vehicle</th>
                      <th className="p-3">Booking</th>
                      <th className="p-3">Date</th>
                      <th className="p-3">Engine Temp.</th>
                      <th className="p-3">Battery</th>
                      <th className="p-3">Oil Level</th>
                      <th className="p-3">Brakes</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Alerts</th>
                      {isAdmin && <th className="p-3">Actions</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredDiagnostics.map((item) => (
                      <tr
                        key={item._id}
                        className="border-b border-slate-100 align-top hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium">
                          {item._id.slice(-8)}
                        </td>

                        <td className="p-3">#{item.vehicle_id}</td>
                        <td className="p-3">#{item.booking_id}</td>

                        <td className="p-3">
                          {item.diagnostic_date
                            ? new Date(
                                item.diagnostic_date
                              ).toLocaleDateString()
                            : "-"}
                        </td>

                        <td className="p-3">
                          {item.engine_temperature} °C
                        </td>

                        <td className="p-3">
                          {item.battery_voltage} V
                        </td>

                        <td className="p-3">{item.oil_level}</td>
                        <td className="p-3">{item.brake_condition}</td>

                        <td className="p-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              item.overall_status === "Healthy"
                                ? "bg-green-50 text-green-700"
                                : item.overall_status === "Critical"
                                  ? "bg-red-50 text-red-700"
                                  : "bg-yellow-50 text-yellow-700"
                            }`}
                          >
                            {item.overall_status}
                          </span>
                        </td>

                        <td className="p-3">
                          {(item.alerts ?? []).length > 0 ? (
                            <ul className="list-inside list-disc space-y-1 text-red-600">
                              {(item.alerts ?? []).map((alert, index) => (
                                <li key={index}>{alert}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="text-green-700">
                              No alerts
                            </span>
                          )}
                        </td>

                        {/* Admin-only Actions */}
                        {isAdmin && (
                          <td className="p-3">
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(item)}
                                className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => handleDelete(item._id)}
                                className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}

                    {filteredDiagnostics.length === 0 && (
                      <tr>
                        <td
                          colSpan={isAdmin ? 11 : 10}
                          className="p-8 text-center text-slate-500"
                        >
                          {isCustomer
                            ? "No diagnostic reports are available for your vehicles yet."
                            : "No diagnostic records found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

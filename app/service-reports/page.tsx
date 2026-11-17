"use client";

import { useEffect, useState } from "react";
import type { FormEvent } from "react";

interface Observation {
  component: string;
  condition: string;
  remarks: string;
}

interface ServiceReport {
  _id: string;
  booking_id: number;
  vehicle_id: number;
  mechanic_id: number;
  inspection_date: string;
  observations: Observation[];
  recommendations: string[];
  created_at: string;
}

interface AuthUser {
  Roles?: string[];
  roles?: string[];
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  reports?: ServiceReport[];
  user?: AuthUser;
  data?: {
    user?: AuthUser;
    Roles?: string[];
    roles?: string[];
  };
  Roles?: string[];
  roles?: string[];
}

const emptyObservation: Observation = {
  component: "",
  condition: "Good",
  remarks: "",
};

export default function ServiceReportsPage() {
  const [reports, setReports] = useState<ServiceReport[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const [bookingId, setBookingId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [mechanicId, setMechanicId] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [observations, setObservations] = useState<Observation[]>([
    { ...emptyObservation },
  ]);
  const [recommendations, setRecommendations] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const isAdmin = roles.includes("Admin");
  const isMechanic = roles.includes("Mechanic");
  const isReceptionist = roles.includes("Receptionist");

  const canCreate = isAdmin || isMechanic;
  const canViewPage = canCreate || isReceptionist;

  async function loadReports() {
    setLoading(true);
    setError("");

    try {
      const [authResponse, reportResponse] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/service-reports", { cache: "no-store" }),
      ]);

      const authData = (await authResponse.json()) as ApiResponse;
      const reportData = (await reportResponse.json()) as ApiResponse;

      if (!authResponse.ok) {
        throw new Error(authData.message || "Unable to verify your account");
      }

      if (!reportResponse.ok) {
        throw new Error(
          reportData.message || "Unable to fetch service reports"
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
      setReports(reportData.reports ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to fetch service reports"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports();
  }, []);

  const filteredReports = reports.filter((report) =>
    [
      String(report.booking_id),
      String(report.vehicle_id),
      String(report.mechanic_id),
      ...report.observations.map((item) => item.component),
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function updateObservation(
    index: number,
    field: keyof Observation,
    value: string
  ) {
    setObservations((current) =>
      current.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addObservation() {
    setObservations((current) => [...current, { ...emptyObservation }]);
  }

  function removeObservation(index: number) {
    setObservations((current) => current.filter((_, i) => i !== index));
  }

  function resetForm() {
    setBookingId("");
    setVehicleId("");
    setMechanicId("");
    setInspectionDate("");
    setObservations([{ ...emptyObservation }]);
    setRecommendations("");
    setEditingId(null);
  }

  function startEdit(report: ServiceReport) {
    if (!isAdmin) return;

    setEditingId(report._id);
    setBookingId(String(report.booking_id));
    setVehicleId(String(report.vehicle_id));
    setMechanicId(String(report.mechanic_id));
    setInspectionDate(report.inspection_date?.slice(0, 10) ?? "");
    setObservations(
      report.observations.length > 0
        ? report.observations.map((item) => ({ ...item }))
        : [{ ...emptyObservation }]
    );
    setRecommendations(report.recommendations.join("\n"));
    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canCreate || (editingId && !isAdmin)) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        booking_id: Number(bookingId),
        vehicle_id: Number(vehicleId),
        mechanic_id: Number(mechanicId),
        ...(inspectionDate ? { inspection_date: inspectionDate } : {}),
        observations: observations.map((item) => ({
          component: item.component.trim(),
          condition: item.condition.trim(),
          remarks: item.remarks.trim(),
        })),
        recommendations: recommendations
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
      };

      const isEditing = editingId !== null;
      const response = await fetch(
        isEditing ? `/api/service-reports/${editingId}` : "/api/service-reports",
        {
          method: isEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const data = (await response.json()) as ApiResponse;
      if (!response.ok) {
        throw new Error(
          data.message ||
            (isEditing
              ? "Unable to update service report"
              : "Unable to create service report")
        );
      }

      setMessage(
        data.message ||
          (isEditing
            ? "Service report updated successfully"
            : "Service report created successfully")
      );
      resetForm();
      await loadReports();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save service report"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(report: ServiceReport) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete the service report for Booking #${report.booking_id}?`
    );
    if (!confirmed) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/service-reports/${report._id}`, {
        method: "DELETE",
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete service report");
      }

      if (editingId === report._id) resetForm();
      setMessage(data.message || "Service report deleted successfully");
      await loadReports();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete service report"
      );
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100";

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <a href="/" className="text-sm text-blue-600 hover:underline">
              ← Back to Dashboard
            </a>
            <h1 className="mt-3 text-3xl font-bold text-slate-800">
              Service Reports
            </h1>
            <p className="mt-2 text-slate-500">
              {canCreate
                ? "Record vehicle inspections, observations and recommendations."
                : "View vehicle inspection reports and recommendations."}
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Reports</p>
            <p className="text-2xl font-bold text-blue-700">
              {reports.length}
            </p>
          </div>
        </div>

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
            Loading service reports...
          </div>
        ) : !canViewPage ? (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm">
            You do not have permission to access service reports.
          </div>
        ) : (
          <>
            {canCreate && (
              <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
                <h2 className="mb-5 text-xl font-bold text-slate-800">
                  {editingId ? "Edit Service Report" : "Create Service Report"}
                </h2>

                <form onSubmit={handleSubmit}>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Booking ID *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={bookingId}
                        onChange={(e) => setBookingId(e.target.value)}
                        placeholder="Enter booking ID"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Vehicle ID *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={vehicleId}
                        onChange={(e) => setVehicleId(e.target.value)}
                        placeholder="Enter vehicle ID"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Mechanic ID *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={mechanicId}
                        onChange={(e) => setMechanicId(e.target.value)}
                        placeholder="Enter mechanic ID"
                        className={inputClass}
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        Inspection Date
                      </label>
                      <input
                        type="date"
                        value={inspectionDate}
                        onChange={(e) => setInspectionDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>

                  <div className="mt-8">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <h3 className="text-lg font-bold text-slate-800">
                        Component Observations
                      </h3>
                      <button
                        type="button"
                        onClick={addObservation}
                        className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100"
                      >
                        + Add Component
                      </button>
                    </div>

                    <div className="space-y-4">
                      {observations.map((item, index) => (
                        <div
                          key={index}
                          className="rounded-lg border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h4 className="font-semibold text-slate-800">
                              Component {index + 1}
                            </h4>
                            {observations.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeObservation(index)}
                                className="text-sm font-medium text-red-600 hover:underline"
                              >
                                Remove
                              </button>
                            )}
                          </div>

                          <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                              <label className="mb-2 block text-sm text-slate-700">
                                Component *
                              </label>
                              <input
                                required
                                value={item.component}
                                onChange={(e) =>
                                  updateObservation(
                                    index,
                                    "component",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. Engine"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-slate-700">
                                Condition *
                              </label>
                              <input
                                required
                                value={item.condition}
                                onChange={(e) =>
                                  updateObservation(
                                    index,
                                    "condition",
                                    e.target.value
                                  )
                                }
                                placeholder="e.g. Good"
                                className={inputClass}
                              />
                            </div>

                            <div>
                              <label className="mb-2 block text-sm text-slate-700">
                                Remarks
                              </label>
                              <input
                                value={item.remarks}
                                onChange={(e) =>
                                  updateObservation(
                                    index,
                                    "remarks",
                                    e.target.value
                                  )
                                }
                                placeholder="Enter observations"
                                className={inputClass}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8">
                    <label className="mb-2 block text-sm font-semibold text-slate-700">
                      Recommendations
                    </label>
                    <textarea
                      value={recommendations}
                      onChange={(e) => setRecommendations(e.target.value)}
                      rows={4}
                      placeholder={
                        "Enter each recommendation on a new line.\nExample: Check engine oil regularly"
                      }
                      className={inputClass}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Enter one recommendation per line.
                    </p>
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
                          ? "Update Service Report"
                          : "Create Service Report"}
                    </button>

                    <button
                      type="button"
                      onClick={resetForm}
                      disabled={saving}
                      className="rounded-lg border border-slate-300 px-6 py-2.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      {editingId ? "Cancel Edit" : "Reset"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            {isReceptionist && (
              <div className="mb-8 rounded-xl bg-white p-5 text-sm text-slate-600 shadow-sm">
                You have read-only access to service reports. Admins and
                mechanics can create service reports.
              </div>
            )}

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">
                  Service Report Records
                </h2>
                <input
                  type="text"
                  placeholder="Search booking, vehicle, mechanic or component..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1000px] text-left text-sm text-slate-800">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">Report ID</th>
                      <th className="p-3">Booking</th>
                      <th className="p-3">Vehicle</th>
                      <th className="p-3">Mechanic</th>
                      <th className="p-3">Inspection Date</th>
                      <th className="p-3">Observations</th>
                      <th className="p-3">Recommendations</th>
                      {isAdmin && <th className="p-3">Actions</th>}
                    </tr>
                  </thead>

                  <tbody>
                    {filteredReports.map((report) => (
                      <tr
                        key={report._id}
                        className="border-b border-slate-100 align-top hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium">
                          {String(report._id).slice(-8)}
                        </td>
                        <td className="p-3">#{report.booking_id}</td>
                        <td className="p-3">#{report.vehicle_id}</td>
                        <td className="p-3">#{report.mechanic_id}</td>
                        <td className="p-3">
                          {report.inspection_date
                            ? new Date(
                                report.inspection_date
                              ).toLocaleDateString()
                            : "-"}
                        </td>
                        <td className="p-3">
                          <div className="space-y-2">
                            {report.observations.map((item, index) => (
                              <div key={index}>
                                <p className="font-semibold">
                                  {item.component}: {item.condition}
                                </p>
                                <p className="text-xs text-slate-500">
                                  {item.remarks}
                                </p>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="p-3">
                          <ul className="list-inside list-disc space-y-1">
                            {report.recommendations.map((item, index) => (
                              <li key={index}>{item}</li>
                            ))}
                            {report.recommendations.length === 0 && "-"}
                          </ul>
                        </td>
                        {isAdmin && (
                          <td className="p-3">
                            <div className="flex flex-col items-start gap-2">
                              <button
                                type="button"
                                onClick={() => startEdit(report)}
                                disabled={saving}
                                className="rounded-md bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => void handleDelete(report)}
                                disabled={saving}
                                className="rounded-md bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}

                    {filteredReports.length === 0 && (
                      <tr>
                        <td
                          colSpan={isAdmin ? 8 : 7}
                          className="p-8 text-center text-slate-500"
                        >
                          No service reports found.
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

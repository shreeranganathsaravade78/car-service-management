
"use client";

import { useEffect, useMemo, useState } from "react";

interface Mechanic {
  Mechanic_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string | null;
  Specialization: string | null;
  Employment_Status: string;
}

interface MechanicForm {
  First_Name: string;
  Last_Name: string;
  Phone: string;
  Specialization: string;
  Employment_Status: string;
}

const emptyForm: MechanicForm = {
  First_Name: "",
  Last_Name: "",
  Phone: "",
  Specialization: "",
  Employment_Status: "Active",
};

const employmentStatuses = ["Active", "On Leave", "Resigned"];

export default function MechanicsPage() {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [form, setForm] = useState<MechanicForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadMechanics() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/mechanics", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to fetch mechanics");
      }

      setMechanics(data.mechanics);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to fetch mechanics"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadMechanics();
  }, []);

  const filteredMechanics = useMemo(() => {
    const term = search.toLowerCase();

    return mechanics.filter((mechanic) =>
      [
        mechanic.First_Name,
        mechanic.Last_Name,
        mechanic.Phone || "",
        mechanic.Specialization || "",
        mechanic.Employment_Status,
        String(mechanic.Mechanic_ID),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [mechanics, search]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function startEdit(mechanic: Mechanic) {
    setEditingId(mechanic.Mechanic_ID);

    setForm({
      First_Name: mechanic.First_Name,
      Last_Name: mechanic.Last_Name,
      Phone: mechanic.Phone || "",
      Specialization: mechanic.Specialization || "",
      Employment_Status: mechanic.Employment_Status,
    });

    setError("");
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setMessage("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        First_Name: form.First_Name.trim(),
        Last_Name: form.Last_Name.trim(),
        Phone: form.Phone.trim() || null,
        Specialization: form.Specialization.trim() || null,
        Employment_Status: form.Employment_Status,
      };

      const response = await fetch(
        editingId
          ? `/api/mechanics/${editingId}`
          : "/api/mechanics",
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
        throw new Error(data.message || "Unable to save mechanic");
      }

      setMessage(data.message);
      setForm(emptyForm);
      setEditingId(null);

      await loadMechanics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save mechanic"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(mechanicId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this mechanic?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/mechanics/${mechanicId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete mechanic");
      }

      setMessage(data.message);
      await loadMechanics();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete mechanic"
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
              Mechanics Management
            </h1>

            <p className="mt-2 text-slate-500">
              Manage mechanic details, specializations and employment status.
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Mechanics</p>
            <p className="text-2xl font-bold text-blue-700">
              {mechanics.length}
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

        {/* Mechanic Form */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">
            {editingId ? "Update Mechanic" : "Add New Mechanic"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  First Name *
                </label>
                <input
                  name="First_Name"
                  value={form.First_Name}
                  onChange={handleChange}
                  placeholder="Enter first name"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Last Name *
                </label>
                <input
                  name="Last_Name"
                  value={form.Last_Name}
                  onChange={handleChange}
                  placeholder="Enter last name"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Phone Number
                </label>
                <input
                  name="Phone"
                  value={form.Phone}
                  onChange={handleChange}
                  placeholder="Enter phone number"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Specialization
                </label>
                <input
                  name="Specialization"
                  value={form.Specialization}
                  onChange={handleChange}
                  placeholder="e.g. Engine Repair"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Employment Status *
                </label>
                <select
                  name="Employment_Status"
                  value={form.Employment_Status}
                  onChange={handleChange}
                  required
                  className={inputClass}
                >
                  {employmentStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
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
                    ? "Update Mechanic"
                    : "Add Mechanic"}
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
          </form>
        </section>

        {/* Mechanic Records */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800">
              Mechanic Records
            </h2>

            <input
              type="text"
              placeholder="Search name, phone or specialization..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading mechanics...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm text-slate-800">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Mechanic Name</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Specialization</th>
                    <th className="p-3">Employment Status</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMechanics.map((mechanic) => (
                    <tr
                      key={mechanic.Mechanic_ID}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-3">{mechanic.Mechanic_ID}</td>

                      <td className="p-3 font-medium">
                        {mechanic.First_Name} {mechanic.Last_Name}
                      </td>

                      <td className="p-3">
                        {mechanic.Phone || "-"}
                      </td>

                      <td className="p-3">
                        {mechanic.Specialization || "-"}
                      </td>

                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            mechanic.Employment_Status === "Active"
                              ? "bg-green-50 text-green-700"
                              : mechanic.Employment_Status === "On Leave"
                                ? "bg-yellow-50 text-yellow-700"
                                : "bg-red-50 text-red-700"
                          }`}
                        >
                          {mechanic.Employment_Status}
                        </span>
                      </td>

                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(mechanic)}
                            className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(mechanic.Mechanic_ID)}
                            className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredMechanics.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No mechanics found.
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


"use client";

import { useEffect, useMemo, useState } from "react";

interface Service {
  Service_ID: number;
  Service_Name: string;
  Description: string | null;
  Base_Price: number;
  Estimated_Duration: number | null;
}

interface ServiceForm {
  Service_Name: string;
  Description: string;
  Base_Price: string;
  Estimated_Duration: string;
}

const emptyForm: ServiceForm = {
  Service_Name: "",
  Description: "",
  Base_Price: "",
  Estimated_Duration: "",
};

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [form, setForm] = useState<ServiceForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadServices() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/services", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to fetch services");
      }

      setServices(data.services);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to fetch services"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadServices();
  }, []);

  const filteredServices = useMemo(() => {
    const term = search.toLowerCase();

    return services.filter((service) =>
      [
        service.Service_Name,
        service.Description || "",
        String(service.Service_ID),
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [services, search]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function startEdit(service: Service) {
    setEditingId(service.Service_ID);

    setForm({
      Service_Name: service.Service_Name,
      Description: service.Description || "",
      Base_Price: String(service.Base_Price),
      Estimated_Duration:
        service.Estimated_Duration !== null
          ? String(service.Estimated_Duration)
          : "",
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        Service_Name: form.Service_Name.trim(),
        Description: form.Description.trim(),
        Base_Price: Number(form.Base_Price),
        Estimated_Duration: form.Estimated_Duration
          ? Number(form.Estimated_Duration)
          : null,
      };

      const response = await fetch(
        editingId ? `/api/services/${editingId}` : "/api/services",
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
        throw new Error(data.message || "Unable to save service");
      }

      setMessage(data.message);
      setForm(emptyForm);
      setEditingId(null);

      await loadServices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save service"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(serviceId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this service?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/services/${serviceId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete service");
      }

      setMessage(data.message);
      await loadServices();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete service"
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
              Service Management
            </h1>

            <p className="mt-2 text-slate-500">
              Manage available vehicle maintenance and repair services.
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Services</p>
            <p className="text-2xl font-bold text-blue-700">
              {services.length}
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

        {/* Service Form */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">
            {editingId ? "Update Service" : "Add New Service"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Service Name *
                </label>

                <input
                  name="Service_Name"
                  value={form.Service_Name}
                  onChange={handleChange}
                  placeholder="e.g. Oil Change"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Base Price (₹) *
                </label>

                <input
                  type="number"
                  name="Base_Price"
                  value={form.Base_Price}
                  onChange={handleChange}
                  placeholder="e.g. 1500"
                  min="0"
                  step="0.01"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Estimated Duration (Minutes)
                </label>

                <input
                  type="number"
                  name="Estimated_Duration"
                  value={form.Estimated_Duration}
                  onChange={handleChange}
                  placeholder="e.g. 60"
                  min="1"
                  step="1"
                  className={inputClass}
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Service Description
                </label>

                <textarea
                  name="Description"
                  value={form.Description}
                  onChange={handleChange}
                  placeholder="Describe the service..."
                  rows={3}
                  className={inputClass}
                />
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
                    ? "Update Service"
                    : "Add Service"}
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

        {/* Service Records */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800">
              Service Records
            </h2>

            <input
              type="text"
              placeholder="Search service name or description..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading services...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-sm text-slate-800">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Service Name</th>
                    <th className="p-3">Description</th>
                    <th className="p-3">Base Price</th>
                    <th className="p-3">Duration</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredServices.map((service) => (
                    <tr
                      key={service.Service_ID}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-3">{service.Service_ID}</td>

                      <td className="p-3 font-medium">
                        {service.Service_Name}
                      </td>

                      <td className="max-w-[250px] truncate p-3">
                        {service.Description || "-"}
                      </td>

                      <td className="p-3 font-semibold">
                        ₹{Number(service.Base_Price).toFixed(2)}
                      </td>

                      <td className="p-3">
                        {service.Estimated_Duration
                          ? `${service.Estimated_Duration} min`
                          : "-"}
                      </td>

                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(service)}
                            className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(service.Service_ID)}
                            className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredServices.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No services found.
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

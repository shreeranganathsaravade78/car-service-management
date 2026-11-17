
"use client";

import { useEffect, useMemo, useState } from "react";

interface Customer {
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
}

interface Vehicle {
  Vehicle_ID: number;
  Customer_ID: number;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  Manufacturing_Year: number | null;
  Fuel_Type: string | null;
  First_Name: string;
  Last_Name: string;
  Phone: string;
}

interface VehicleForm {
  Customer_ID: string;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  Manufacturing_Year: string;
  Fuel_Type: string;
}

const emptyForm: VehicleForm = {
  Customer_ID: "",
  Registration_Number: "",
  Manufacturer: "",
  Model: "",
  Manufacturing_Year: "",
  Fuel_Type: "",
};

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<VehicleForm>(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const [vehicleResponse, customerResponse] = await Promise.all([
        fetch("/api/vehicles", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
      ]);

      const vehicleData = await vehicleResponse.json();
      const customerData = await customerResponse.json();

      if (!vehicleResponse.ok) {
        throw new Error(vehicleData.message || "Unable to fetch vehicles");
      }

      if (!customerResponse.ok) {
        throw new Error(customerData.message || "Unable to fetch customers");
      }

      setVehicles(vehicleData.vehicles);
      setCustomers(customerData.customers);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load vehicle data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredVehicles = useMemo(() => {
    const term = search.toLowerCase();

    return vehicles.filter((vehicle) =>
      [
        vehicle.Registration_Number,
        vehicle.Manufacturer,
        vehicle.Model,
        vehicle.First_Name,
        vehicle.Last_Name,
        vehicle.Fuel_Type || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [vehicles, search]);

  function handleChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function startEdit(vehicle: Vehicle) {
    setEditingId(vehicle.Vehicle_ID);

    setForm({
      Customer_ID: String(vehicle.Customer_ID),
      Registration_Number: vehicle.Registration_Number,
      Manufacturer: vehicle.Manufacturer,
      Model: vehicle.Model,
      Manufacturing_Year: vehicle.Manufacturing_Year
        ? String(vehicle.Manufacturing_Year)
        : "",
      Fuel_Type: vehicle.Fuel_Type || "",
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
        ...form,
        Customer_ID: Number(form.Customer_ID),
        Manufacturing_Year: form.Manufacturing_Year
          ? Number(form.Manufacturing_Year)
          : null,
        Fuel_Type: form.Fuel_Type || null,
      };

      const response = await fetch(
        editingId ? `/api/vehicles/${editingId}` : "/api/vehicles",
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
        throw new Error(data.message || "Unable to save vehicle");
      }

      setMessage(data.message);
      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save vehicle"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(vehicleId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this vehicle?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/vehicles/${vehicleId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete vehicle");
      }

      setMessage(data.message);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete vehicle"
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
              Vehicle Management
            </h1>

            <p className="mt-2 text-slate-500">
              Register and manage customer vehicles.
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">Total Vehicles</p>
            <p className="text-2xl font-bold text-blue-700">
              {vehicles.length}
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

        {/* Vehicle Form */}
        <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-800">
            {editingId ? "Update Vehicle" : "Register New Vehicle"}
          </h2>

          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Vehicle Owner *
                </label>

                <select
                  name="Customer_ID"
                  value={form.Customer_ID}
                  onChange={handleChange}
                  required
                  className={inputClass}
                >
                  <option value="">Select Customer</option>

                  {customers.map((customer) => (
                    <option
                      key={customer.Customer_ID}
                      value={customer.Customer_ID}
                    >
                      {customer.First_Name} {customer.Last_Name}
                      {" (ID: "}{customer.Customer_ID}{")"}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Registration Number *
                </label>

                <input
                  name="Registration_Number"
                  value={form.Registration_Number}
                  onChange={handleChange}
                  placeholder="e.g. KA01AB1234"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Manufacturer *
                </label>

                <input
                  name="Manufacturer"
                  value={form.Manufacturer}
                  onChange={handleChange}
                  placeholder="e.g. Maruti Suzuki"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Model *
                </label>

                <input
                  name="Model"
                  value={form.Model}
                  onChange={handleChange}
                  placeholder="e.g. Swift"
                  required
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Manufacturing Year
                </label>

                <input
                  type="number"
                  name="Manufacturing_Year"
                  value={form.Manufacturing_Year}
                  onChange={handleChange}
                  placeholder="e.g. 2023"
                  min="1886"
                  max={new Date().getFullYear() + 1}
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">
                  Fuel Type
                </label>

                <input
                  name="Fuel_Type"
                  value={form.Fuel_Type}
                  onChange={handleChange}
                  placeholder="e.g. Petrol, Diesel, Electric"
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
                    ? "Update Vehicle"
                    : "Register Vehicle"}
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

        {/* Vehicle Records */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-slate-800">
              Vehicle Records
            </h2>

            <input
              type="text"
              placeholder="Search registration, model or owner..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading vehicles...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[950px] text-left text-sm text-slate-800">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">ID</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">Registration</th>
                    <th className="p-3">Manufacturer</th>
                    <th className="p-3">Model</th>
                    <th className="p-3">Year</th>
                    <th className="p-3">Fuel Type</th>
                    <th className="p-3">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredVehicles.map((vehicle) => (
                    <tr
                      key={vehicle.Vehicle_ID}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-3">{vehicle.Vehicle_ID}</td>

                      <td className="p-3 font-medium">
                        {vehicle.First_Name} {vehicle.Last_Name}
                      </td>

                      <td className="p-3 font-medium">
                        {vehicle.Registration_Number}
                      </td>

                      <td className="p-3">{vehicle.Manufacturer}</td>
                      <td className="p-3">{vehicle.Model}</td>
                      <td className="p-3">
                        {vehicle.Manufacturing_Year || "-"}
                      </td>
                      <td className="p-3">{vehicle.Fuel_Type || "-"}</td>

                      <td className="p-3">
                        <div className="flex gap-2">
                          <button
                            onClick={() => startEdit(vehicle)}
                            className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                          >
                            Edit
                          </button>

                          <button
                            onClick={() => handleDelete(vehicle.Vehicle_ID)}
                            className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {filteredVehicles.length === 0 && (
                    <tr>
                      <td colSpan={8} className="p-8 text-center text-slate-500">
                        No vehicles found.
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


"use client";

import { useEffect, useState } from "react";

interface Customer {
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
  Email: string | null;
  House_Number: string | null;
  Street: string | null;
  Area: string | null;
  City: string | null;
  State: string | null;
  Postal_Code: string | null;
}

const emptyForm = {
  First_Name: "",
  Last_Name: "",
  Phone: "",
  Email: "",
  House_Number: "",
  Street: "",
  Area: "",
  City: "",
  State: "",
  Postal_Code: "",
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [isStaff, setIsStaff] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadCustomers() {
    setLoading(true);
    setError("");

    try {
      const [sessionResponse, customerResponse] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/customers", { cache: "no-store" }),
      ]);

      const sessionData = await sessionResponse.json();
      const customerData = await customerResponse.json();

      if (!sessionResponse.ok) {
        throw new Error("Please log in to access this page.");
      }

      if (!customerResponse.ok) {
        throw new Error(customerData.message || "Unable to fetch customers");
      }

      const roles: string[] = sessionData.user?.Roles || [];

      setIsStaff(
        roles.includes("Admin") || roles.includes("Receptionist")
      );

      setCustomers(customerData.customers || []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load customer data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCustomers();
  }, []);

  const filteredCustomers = customers.filter((customer) =>
    [
      customer.First_Name,
      customer.Last_Name,
      customer.Phone,
      customer.Email || "",
    ]
      .join(" ")
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function startEdit(customer: Customer) {
    setEditingId(customer.Customer_ID);

    setForm({
      First_Name: customer.First_Name,
      Last_Name: customer.Last_Name,
      Phone: customer.Phone,
      Email: customer.Email || "",
      House_Number: customer.House_Number || "",
      Street: customer.Street || "",
      Area: customer.Area || "",
      City: customer.City || "",
      State: customer.State || "",
      Postal_Code: customer.Postal_Code || "",
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
      const response = await fetch(
        editingId
          ? `/api/customers/${editingId}`
          : "/api/customers",
        {
          method: editingId ? "PUT" : "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(form),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to save customer");
      }

      setMessage(data.message);
      resetForm();
      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save customer"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(customerId: number) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this customer?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete customer");
      }

      setMessage(data.message);
      await loadCustomers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete customer"
      );
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600";

  const customer = customers[0];

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
              {isStaff ? "Customer Management" : "My Profile"}
            </h1>

            <p className="mt-2 text-slate-500">
              {isStaff
                ? "Manage customer information and contact details."
                : "View your personal information and contact details."}
            </p>
          </div>

          {isStaff && (
            <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
              <p className="text-sm text-slate-500">Total Customers</p>
              <p className="text-2xl font-bold text-blue-700">
                {customers.length}
              </p>
            </div>
          )}
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
          <div className="rounded-xl bg-white p-10 text-center text-slate-500">
            Loading customer information...
          </div>
        ) : !isStaff ? (

          /* CUSTOMER PERSONAL PROFILE */
          customer ? (
            <section className="rounded-xl bg-white p-8 shadow-sm">
              <div className="mb-8 flex items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 text-3xl">
                  👤
                </div>

                <div>
                  <h2 className="text-2xl font-bold text-slate-800">
                    {customer.First_Name} {customer.Last_Name}
                  </h2>
                  <p className="text-sm text-slate-500">
                    Customer ID: #{customer.Customer_ID}
                  </p>
                </div>
              </div>

              <h3 className="mb-5 text-xl font-bold text-slate-800">
                Personal Information
              </h3>

              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: "First Name", value: customer.First_Name },
                  { label: "Last Name", value: customer.Last_Name },
                  { label: "Phone Number", value: customer.Phone },
                  { label: "Email Address", value: customer.Email },
                  { label: "House Number", value: customer.House_Number },
                  { label: "Street", value: customer.Street },
                  { label: "Area", value: customer.Area },
                  { label: "City", value: customer.City },
                  { label: "State", value: customer.State },
                  { label: "Postal Code", value: customer.Postal_Code },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg border border-slate-200 p-4"
                  >
                    <p className="text-sm text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-2 font-semibold text-slate-900">
                      {item.value || "Not provided"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          ) : (
            <section className="rounded-xl bg-white p-10 text-center shadow-sm">
              <h2 className="text-xl font-bold text-slate-800">
                Customer profile not found
              </h2>
              <p className="mt-2 text-slate-500">
                Please contact the Receptionist to link your account.
              </p>
            </section>
          )
        ) : (

          /* ADMIN / RECEPTIONIST MANAGEMENT */
          <>
            <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xl font-bold text-slate-800">
                {editingId ? "Update Customer" : "Add New Customer"}
              </h2>

              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    { name: "First_Name", label: "First Name", required: true },
                    { name: "Last_Name", label: "Last Name", required: true },
                    { name: "Phone", label: "Phone Number", required: true },
                    { name: "Email", label: "Email Address" },
                    { name: "House_Number", label: "House Number" },
                    { name: "Street", label: "Street" },
                    { name: "Area", label: "Area" },
                    { name: "City", label: "City" },
                    { name: "State", label: "State" },
                    { name: "Postal_Code", label: "Postal Code" },
                  ].map((field) => (
                    <div key={field.name}>
                      <label className="mb-2 block text-sm font-medium text-slate-700">
                        {field.label}{field.required && " *"}
                      </label>

                      <input
                        name={field.name}
                        value={form[field.name as keyof typeof form]}
                        onChange={handleChange}
                        required={field.required}
                        type={field.name === "Email" ? "email" : "text"}
                        className={inputClass}
                      />
                    </div>
                  ))}
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
                        ? "Update Customer"
                        : "Add Customer"}
                  </button>

                  {editingId !== null && (
                    <button
                      type="button"
                      onClick={resetForm}
                      className="rounded-lg border border-slate-300 px-6 py-2.5 font-semibold text-slate-700"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>

            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">
                  Customer Records
                </h2>

                <input
                  type="text"
                  placeholder="Search name, phone or email..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 sm:w-80"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[750px] text-left text-sm text-slate-800">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">ID</th>
                      <th className="p-3">Customer Name</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">City</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredCustomers.map((item) => (
                      <tr
                        key={item.Customer_ID}
                        className="border-b border-slate-100 hover:bg-slate-50"
                      >
                        <td className="p-3">{item.Customer_ID}</td>
                        <td className="p-3 font-medium">
                          {item.First_Name} {item.Last_Name}
                        </td>
                        <td className="p-3">{item.Phone}</td>
                        <td className="p-3">{item.Email || "-"}</td>
                        <td className="p-3">{item.City || "-"}</td>

                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => startEdit(item)}
                              className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700"
                            >
                              Edit
                            </button>

                            <button
                              onClick={() => handleDelete(item.Customer_ID)}
                              className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredCustomers.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          No customers found.
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

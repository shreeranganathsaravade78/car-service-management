
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

interface Booking {
  Booking_ID: number;
  Vehicle_ID: number;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  First_Name: string;
  Last_Name: string;
}

interface Invoice {
  Invoice_ID: number;
  Booking_ID: number;
  Invoice_Date: string;
  Labor_Charge: number | string;
  Tax_Amount: number | string;
  Discount_Amount: number | string;
  Invoice_Status: string;
  Vehicle_ID: number;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
}

interface InvoiceForm {
  Booking_ID: string;
  Labor_Charge: string;
  Tax_Amount: string;
  Discount_Amount: string;
}

interface AuthUser {
  Roles?: string[];
  roles?: string[];
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  invoices?: Invoice[];
  bookings?: Booking[];
  user?: AuthUser;
  data?: {
    user?: AuthUser;
    Roles?: string[];
    roles?: string[];
  };
  Roles?: string[];
  roles?: string[];
}

const emptyForm: InvoiceForm = {
  Booking_ID: "",
  Labor_Charge: "",
  Tax_Amount: "0",
  Discount_Amount: "0",
};

function calculateTotal(
  labor: number | string,
  tax: number | string,
  discount: number | string
) {
  return (
    Number(labor || 0) +
    Number(tax || 0) -
    Number(discount || 0)
  );
}

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "-";
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const [form, setForm] = useState<InvoiceForm>(emptyForm);
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
      const [authResponse, invoiceResponse] = await Promise.all([
        fetch("/api/auth/me", { cache: "no-store" }),
        fetch("/api/invoices", { cache: "no-store" }),
      ]);

      const authData = (await authResponse.json()) as ApiResponse;
      const invoiceData = (await invoiceResponse.json()) as ApiResponse;

      if (!authResponse.ok) {
        throw new Error(authData.message || "Unable to verify your account");
      }

      if (!invoiceResponse.ok) {
        throw new Error(invoiceData.message || "Unable to fetch invoices");
      }

      const authUser =
        authData.user ?? authData.data?.user ?? authData.data ?? authData;

      const userRoles = authUser.Roles ?? authUser.roles ?? [];

      if (!Array.isArray(userRoles)) {
        throw new Error("Unable to identify your account role");
      }

      const currentRoles = userRoles.filter(
        (role): role is string => typeof role === "string"
      );

      setRoles(currentRoles);
      setInvoices(invoiceData.invoices ?? []);

      const staffAccount = currentRoles.some((role) =>
        ["Admin", "Receptionist"].includes(role)
      );

      // Only staff need booking data to generate invoices.
      if (staffAccount) {
        const bookingResponse = await fetch("/api/bookings", {
          cache: "no-store",
        });

        const bookingData = (await bookingResponse.json()) as ApiResponse;

        if (!bookingResponse.ok) {
          throw new Error(
            bookingData.message || "Unable to fetch bookings"
          );
        }

        setBookings(bookingData.bookings ?? []);
      } else {
        setBookings([]);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load invoice data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const availableBookings = useMemo(() => {
    const invoicedBookingIds = new Set(
      invoices.map((invoice) => invoice.Booking_ID)
    );

    return bookings.filter(
      (booking) => !invoicedBookingIds.has(booking.Booking_ID)
    );
  }, [bookings, invoices]);

  const filteredInvoices = useMemo(() => {
    const term = search.toLowerCase();

    return invoices.filter((invoice) =>
      [
        String(invoice.Invoice_ID),
        String(invoice.Booking_ID),
        invoice.First_Name,
        invoice.Last_Name,
        invoice.Registration_Number,
        invoice.Manufacturer,
        invoice.Model,
        invoice.Invoice_Status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [invoices, search]);

  const currentTotal = calculateTotal(
    form.Labor_Charge,
    form.Tax_Amount,
    form.Discount_Amount
  );

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function startEdit(invoice: Invoice) {
    if (!isStaff) return;

    setEditingId(invoice.Invoice_ID);

    setForm({
      Booking_ID: String(invoice.Booking_ID),
      Labor_Charge: String(invoice.Labor_Charge),
      Tax_Amount: String(invoice.Tax_Amount),
      Discount_Amount: String(invoice.Discount_Amount),
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

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isStaff) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...(editingId === null
          ? { Booking_ID: Number(form.Booking_ID) }
          : {}),
        Labor_Charge: Number(form.Labor_Charge),
        Tax_Amount: Number(form.Tax_Amount),
        Discount_Amount: Number(form.Discount_Amount),
      };

      const response = await fetch(
        editingId ? `/api/invoices/${editingId}` : "/api/invoices",
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
        throw new Error(data.message || "Unable to save invoice");
      }

      setMessage(data.message || "Invoice saved successfully");
      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save invoice"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(invoiceId: number) {
    if (!isStaff) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this invoice?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/invoices/${invoiceId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete invoice");
      }

      setMessage(data.message || "Invoice deleted successfully");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete invoice"
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
              {isCustomer ? "My Invoices" : "Invoice Management"}
            </h1>

            <p className="mt-2 text-slate-500">
              {isCustomer
                ? "View invoices generated for your vehicle service bookings."
                : "Generate and manage customer service invoices."}
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">
              {isCustomer ? "My Invoices" : "Total Invoices"}
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {invoices.length}
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

        {/* Invoice Form: Staff only */}
        {isStaff && (
          <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-slate-800">
              {editingId ? "Update Invoice" : "Generate New Invoice"}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Select Booking *
                  </label>

                  {editingId !== null ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                      Booking ID: #{form.Booking_ID}
                      <p className="mt-1 text-xs text-slate-500">
                        The booking associated with an invoice cannot be changed.
                      </p>
                    </div>
                  ) : (
                    <select
                      name="Booking_ID"
                      value={form.Booking_ID}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    >
                      <option value="">
                        Select a booking without an invoice
                      </option>

                      {availableBookings.map((booking) => (
                        <option
                          key={booking.Booking_ID}
                          value={booking.Booking_ID}
                        >
                          Booking #{booking.Booking_ID} — {booking.First_Name}{" "}
                          {booking.Last_Name} — {booking.Registration_Number}
                        </option>
                      ))}
                    </select>
                  )}

                  {editingId === null && availableBookings.length === 0 && (
                    <p className="mt-2 text-sm text-amber-700">
                      No bookings are available for invoicing. Create a new
                      booking first.
                    </p>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Labor Charge (₹) *
                  </label>
                  <input
                    type="number"
                    name="Labor_Charge"
                    value={form.Labor_Charge}
                    onChange={handleChange}
                    placeholder="e.g. 2000"
                    min="0"
                    step="0.01"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Tax Amount (₹) *
                  </label>
                  <input
                    type="number"
                    name="Tax_Amount"
                    value={form.Tax_Amount}
                    onChange={handleChange}
                    placeholder="e.g. 360"
                    min="0"
                    step="0.01"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Discount Amount (₹) *
                  </label>
                  <input
                    type="number"
                    name="Discount_Amount"
                    value={form.Discount_Amount}
                    onChange={handleChange}
                    placeholder="e.g. 100"
                    min="0"
                    step="0.01"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-6 rounded-lg bg-blue-50 p-5">
                <p className="text-sm font-medium text-blue-800">
                  Calculated Invoice Total
                </p>
                <p className="mt-1 text-3xl font-bold text-blue-900">
                  ₹{currentTotal.toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-blue-700">
                  Labor charge + Tax amount − Discount amount
                </p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={
                    saving ||
                    (editingId === null &&
                      (availableBookings.length === 0 || !form.Booking_ID))
                  }
                  className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Invoice"
                      : "Generate Invoice"}
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
        )}

        {/* Invoice Records */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {isCustomer ? "Your Invoice Records" : "Invoice Records"}
              </h2>
              {isCustomer && (
                <p className="mt-1 text-sm text-slate-500">
                  These invoices are available for viewing only.
                </p>
              )}
            </div>

            <input
              type="text"
              placeholder="Search invoice, customer or vehicle..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading invoices...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table
                className={`w-full text-left text-sm text-slate-800 ${
                  isStaff ? "min-w-[1150px]" : "min-w-[950px]"
                }`}
              >
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Invoice ID</th>
                    <th className="p-3">Booking ID</th>
                    {isStaff && <th className="p-3">Customer</th>}
                    <th className="p-3">Vehicle</th>
                    <th className="p-3">Invoice Date</th>
                    <th className="p-3">Labor</th>
                    <th className="p-3">Tax</th>
                    <th className="p-3">Discount</th>
                    <th className="p-3">Total</th>
                    <th className="p-3">Status</th>
                    {isStaff && <th className="p-3">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredInvoices.map((invoice) => (
                    <tr
                      key={invoice.Invoice_ID}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-3 font-medium">
                        #{invoice.Invoice_ID}
                      </td>

                      <td className="p-3">#{invoice.Booking_ID}</td>

                      {isStaff && (
                        <td className="p-3">
                          {invoice.First_Name} {invoice.Last_Name}
                        </td>
                      )}

                      <td className="p-3">
                        {invoice.Registration_Number}
                        <div className="text-xs text-slate-500">
                          {invoice.Manufacturer} {invoice.Model}
                        </div>
                      </td>

                      <td className="p-3">
                        {formatDate(invoice.Invoice_Date)}
                      </td>

                      <td className="p-3">
                        ₹{Number(invoice.Labor_Charge).toFixed(2)}
                      </td>

                      <td className="p-3">
                        ₹{Number(invoice.Tax_Amount).toFixed(2)}
                      </td>

                      <td className="p-3">
                        ₹{Number(invoice.Discount_Amount).toFixed(2)}
                      </td>

                      <td className="p-3 font-semibold">
                        ₹
                        {calculateTotal(
                          invoice.Labor_Charge,
                          invoice.Tax_Amount,
                          invoice.Discount_Amount
                        ).toFixed(2)}
                      </td>

                      <td className="p-3">
                        <span className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
                          {invoice.Invoice_Status}
                        </span>
                      </td>

                      {isStaff && (
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(invoice)}
                              className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDelete(invoice.Invoice_ID)}
                              className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredInvoices.length === 0 && (
                    <tr>
                      <td
                        colSpan={isStaff ? 11 : 9}
                        className="p-8 text-center text-slate-500"
                      >
                        {isCustomer
                          ? "No invoices have been generated for your bookings yet."
                          : "No invoices found."}
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

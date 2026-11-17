
"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

interface Invoice {
  Invoice_ID: number;
  Booking_ID: number;
  Invoice_Status: string;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  First_Name: string;
  Last_Name: string;
}

interface Payment {
  Payment_ID: number;
  Invoice_ID: number;
  Booking_ID: number;
  Payment_Date: string;
  Amount: number | string;
  Payment_Method: string;
  Payment_Status: string;
  Invoice_Status: string;
  Customer_ID: number;
  First_Name: string;
  Last_Name: string;
  Phone: string;
}

interface PaymentForm {
  Invoice_ID: string;
  Amount: string;
  Payment_Method: string;
  Payment_Status: string;
}

interface AuthUser {
  Roles?: string[];
  roles?: string[];
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  payments?: Payment[];
  invoices?: Invoice[];
  user?: AuthUser;
  data?: {
    user?: AuthUser;
    Roles?: string[];
    roles?: string[];
  };
  Roles?: string[];
  roles?: string[];
}

const emptyForm: PaymentForm = {
  Invoice_ID: "",
  Amount: "",
  Payment_Method: "",
  Payment_Status: "Success",
};

const paymentMethods = [
  "Cash",
  "UPI",
  "Credit Card",
  "Debit Card",
  "Net Banking",
];

const paymentStatuses = [
  "Success",
  "Pending",
  "Failed",
  "Refunded",
];

function formatDate(value: string | null | undefined) {
  return value ? value.slice(0, 10) : "-";
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [roles, setRoles] = useState<string[]>([]);

  const [form, setForm] = useState<PaymentForm>(emptyForm);
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
      const [authResponse, paymentResponse, invoiceResponse] =
        await Promise.all([
          fetch("/api/auth/me", { cache: "no-store" }),
          fetch("/api/payments", { cache: "no-store" }),
          fetch("/api/invoices", { cache: "no-store" }),
        ]);

      const authData = (await authResponse.json()) as ApiResponse;
      const paymentData = (await paymentResponse.json()) as ApiResponse;
      const invoiceData = (await invoiceResponse.json()) as ApiResponse;

      if (!authResponse.ok) {
        throw new Error(authData.message || "Unable to verify your account");
      }

      if (!paymentResponse.ok) {
        throw new Error(paymentData.message || "Unable to fetch payments");
      }

      if (!invoiceResponse.ok) {
        throw new Error(invoiceData.message || "Unable to fetch invoices");
      }

      const userRoles =
        authData.user?.Roles ??
        authData.user?.roles ??
        authData.data?.user?.Roles ??
        authData.data?.user?.roles ??
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

      setPayments(paymentData.payments ?? []);
      setInvoices(invoiceData.invoices ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load payment data"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  const filteredPayments = useMemo(() => {
    const term = search.toLowerCase();

    return payments.filter((payment) =>
      [
        String(payment.Payment_ID),
        String(payment.Invoice_ID),
        String(payment.Booking_ID),
        payment.First_Name,
        payment.Last_Name,
        payment.Payment_Method,
        payment.Payment_Status,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [payments, search]);

  function handleChange(
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  function startEdit(payment: Payment) {
    if (!isStaff) return;

    setEditingId(payment.Payment_ID);

    setForm({
      Invoice_ID: String(payment.Invoice_ID),
      Amount: String(payment.Amount),
      Payment_Method: payment.Payment_Method,
      Payment_Status: payment.Payment_Status,
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

    if (!isStaff && !isCustomer) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload: Record<string, string | number> = {
        Amount: Number(form.Amount),
        Payment_Method: form.Payment_Method,
      };

      if (editingId === null) {
        payload.Invoice_ID = Number(form.Invoice_ID);
      }

      // Only staff can choose a payment status.
      // The API assigns Pending automatically for customers.
      if (isStaff) {
        payload.Payment_Status = form.Payment_Status;
      }

      const response = await fetch(
        editingId ? `/api/payments/${editingId}` : "/api/payments",
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
        throw new Error(data.message || "Unable to save payment");
      }

      setMessage(
        data.message ||
          (isCustomer
            ? "Payment record submitted. Status: Pending."
            : "Payment saved successfully")
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save payment"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(paymentId: number) {
    if (!isStaff) return;

    const confirmed = window.confirm(
      "Are you sure you want to delete this payment?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(`/api/payments/${paymentId}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Unable to delete payment");
      }

      setMessage(data.message || "Payment deleted successfully");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete payment"
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
              {isCustomer ? "My Payments" : "Payment Management"}
            </h1>

            <p className="mt-2 text-slate-500">
              {isCustomer
                ? "View your payment history and submit payments for your invoices."
                : "Record and manage customer payments."}
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">
              {isCustomer ? "My Payments" : "Total Payments"}
            </p>
            <p className="text-2xl font-bold text-blue-700">
              {payments.length}
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

        {/* Payment Form */}
        {(isStaff || isCustomer) && (
          <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-slate-800">
              {editingId
                ? "Update Payment"
                : isCustomer
                  ? "Submit Payment Record"
                  : "Record New Payment"}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Select Invoice *
                  </label>

                  {editingId !== null ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-slate-800">
                      Invoice #{form.Invoice_ID}
                      <p className="mt-1 text-xs text-slate-500">
                        The invoice associated with this payment cannot be
                        changed.
                      </p>
                    </div>
                  ) : (
                    <select
                      name="Invoice_ID"
                      value={form.Invoice_ID}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    >
                      <option value="">Select Invoice</option>

                      {invoices.map((invoice) => (
                        <option
                          key={invoice.Invoice_ID}
                          value={invoice.Invoice_ID}
                        >
                          Invoice #{invoice.Invoice_ID} — Booking #
                          {invoice.Booking_ID} — {invoice.Registration_Number}
                          {" ("}
                          {invoice.Invoice_Status}
                          {")"}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Payment Amount (₹) *
                  </label>

                  <input
                    type="number"
                    name="Amount"
                    value={form.Amount}
                    onChange={handleChange}
                    placeholder="Enter payment amount"
                    min="0.01"
                    step="0.01"
                    required
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Payment Method *
                  </label>

                  <select
                    name="Payment_Method"
                    value={form.Payment_Method}
                    onChange={handleChange}
                    required
                    className={inputClass}
                  >
                    <option value="">Select payment method</option>

                    {paymentMethods.map((method) => (
                      <option key={method} value={method}>
                        {method}
                      </option>
                    ))}
                  </select>
                </div>

                {isStaff && (
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Payment Status *
                    </label>

                    <select
                      name="Payment_Status"
                      value={form.Payment_Status}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    >
                      {paymentStatuses.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {isCustomer && (
                <div className="mt-5 rounded-lg bg-blue-50 p-4 text-sm text-blue-800">
                  Your payment record will be submitted with Pending status.
                  The service team must verify it and update its status.
                  This form records a payment entry; it does not process a
                  transaction through a bank or payment gateway.
                </div>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  type="submit"
                  disabled={
                    saving ||
                    loading ||
                    invoices.length === 0 ||
                    (!editingId && !form.Invoice_ID)
                  }
                  className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingId
                      ? "Update Payment"
                      : isCustomer
                        ? "Submit Payment Record"
                        : "Record Payment"}
                </button>

                {editingId !== null && isStaff && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-slate-300 px-6 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                )}
              </div>

              {invoices.length === 0 && !loading && (
                <p className="mt-3 text-sm text-amber-700">
                  {isCustomer
                    ? "No invoices are available for your account yet."
                    : "Generate an invoice before recording a payment."}
                </p>
              )}
            </form>
          </section>
        )}

        {/* Payment Records */}
        <section className="rounded-xl bg-white p-6 shadow-sm">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-800">
                {isCustomer ? "My Payment History" : "Payment Records"}
              </h2>

              {isCustomer && (
                <p className="mt-1 text-sm text-slate-500">
                  Your payment records are displayed for viewing only.
                </p>
              )}
            </div>

            <input
              type="text"
              placeholder="Search payment, invoice or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
            />
          </div>

          {loading ? (
            <p className="py-10 text-center text-slate-500">
              Loading payments...
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table
                className={`w-full text-left text-sm text-slate-800 ${
                  isStaff ? "min-w-[1100px]" : "min-w-[850px]"
                }`}
              >
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-3">Payment ID</th>
                    <th className="p-3">Invoice ID</th>
                    <th className="p-3">Booking ID</th>
                    {isStaff && <th className="p-3">Customer</th>}
                    <th className="p-3">Date</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    {isStaff && <th className="p-3">Actions</th>}
                  </tr>
                </thead>

                <tbody>
                  {filteredPayments.map((payment) => (
                    <tr
                      key={payment.Payment_ID}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="p-3 font-medium">
                        #{payment.Payment_ID}
                      </td>

                      <td className="p-3">#{payment.Invoice_ID}</td>

                      <td className="p-3">#{payment.Booking_ID}</td>

                      {isStaff && (
                        <td className="p-3">
                          <div className="font-medium">
                            {payment.First_Name} {payment.Last_Name}
                          </div>
                          <div className="text-xs text-slate-500">
                            {payment.Phone}
                          </div>
                        </td>
                      )}

                      <td className="p-3">
                        {formatDate(payment.Payment_Date)}
                      </td>

                      <td className="p-3 font-semibold">
                        ₹{Number(payment.Amount).toFixed(2)}
                      </td>

                      <td className="p-3">{payment.Payment_Method}</td>

                      <td className="p-3">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${
                            payment.Payment_Status === "Success"
                              ? "bg-green-50 text-green-700"
                              : payment.Payment_Status === "Pending"
                                ? "bg-yellow-50 text-yellow-700"
                                : payment.Payment_Status === "Refunded"
                                  ? "bg-purple-50 text-purple-700"
                                  : "bg-red-50 text-red-700"
                          }`}
                        >
                          {payment.Payment_Status}
                        </span>
                      </td>

                      {isStaff && (
                        <td className="p-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(payment)}
                              className="rounded-md bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                handleDelete(payment.Payment_ID)
                              }
                              className="rounded-md bg-red-50 px-3 py-1.5 font-medium text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}

                  {filteredPayments.length === 0 && (
                    <tr>
                      <td
                        colSpan={isStaff ? 9 : 8}
                        className="p-8 text-center text-slate-500"
                      >
                        {isCustomer
                          ? "No payment records found for your account."
                          : "No payments found."}
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


"use client";

import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";

interface Feedback {
  _id: string;
  booking_id: number;
  customer_id: number;
  rating: number;
  feedback: string;
  service_quality: string;
  submitted_at: string;
}

interface Booking {
  Booking_ID: number;
  Vehicle_ID: number;
  Registration_Number: string;
  Manufacturer: string;
  Model: string;
  Appointment_Date: string;
  Booking_Status: string;
}

interface FeedbackForm {
  booking_id: string;
  rating: string;
  feedback: string;
  service_quality: string;
}

interface AuthUser {
  Roles?: string[];
  roles?: string[];
}

interface ApiResponse {
  success?: boolean;
  message?: string;
  feedback?: Feedback[];
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

const emptyForm: FeedbackForm = {
  booking_id: "",
  rating: "5",
  feedback: "",
  service_quality: "Excellent",
};

const qualityOptions = [
  "Excellent",
  "Very Good",
  "Good",
  "Average",
  "Poor",
];

export default function CustomerFeedbackPage() {
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isCustomer, setIsCustomer] = useState(false);

  const [form, setForm] = useState<FeedbackForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Load the logged-in customer's bookings and feedback.
  async function loadData() {
    setLoading(true);
    setError("");

    try {
      const authResponse = await fetch("/api/auth/me", {
        cache: "no-store",
      });

      const authData = (await authResponse.json()) as ApiResponse;

      if (!authResponse.ok) {
        throw new Error(
          authData.message || "Unable to verify your account"
        );
      }

      const authUser =
        authData.user ??
        authData.data?.user ??
        authData.data ??
        authData;

      const userRoles =
        authUser.Roles ??
        authUser.roles ??
        authData.data?.Roles ??
        authData.data?.roles ??
        authData.Roles ??
        authData.roles ??
        [];

      // This page is restricted to accounts with only the Customer role.
      if (
        !Array.isArray(userRoles) ||
        userRoles.length !== 1 ||
        userRoles[0] !== "Customer"
      ) {
        setIsCustomer(false);
        setFeedbackList([]);
        setBookings([]);

        throw new Error(
          "Customer Feedback is available only to customer accounts."
        );
      }

      setIsCustomer(true);

      const [bookingResponse, feedbackResponse] = await Promise.all([
        fetch("/api/bookings", { cache: "no-store" }),
        fetch("/api/customer-feedback", { cache: "no-store" }),
      ]);

      const bookingData =
        (await bookingResponse.json()) as ApiResponse;

      const feedbackData =
        (await feedbackResponse.json()) as ApiResponse;

      if (!bookingResponse.ok) {
        throw new Error(
          bookingData.message || "Unable to fetch your bookings"
        );
      }

      if (!feedbackResponse.ok) {
        throw new Error(
          feedbackData.message || "Unable to fetch your feedback"
        );
      }

      setBookings(bookingData.bookings ?? []);
      setFeedbackList(feedbackData.feedback ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load feedback"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // Search feedback records.
  const filteredFeedback = useMemo(() => {
    const term = search.toLowerCase();

    return feedbackList.filter((item) =>
      [
        item._id,
        String(item.booking_id),
        String(item.rating),
        item.feedback,
        item.service_quality,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [feedbackList, search]);

  function handleChange(
    e: ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  }

  // Load an existing feedback record into the form.
  function startEdit(item: Feedback) {
    setEditingId(item._id);

    setForm({
      booking_id: String(item.booking_id),
      rating: String(item.rating),
      feedback: item.feedback,
      service_quality: item.service_quality,
    });

    setError("");
    setMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setError("");
    setMessage("");
  }

  // POST creates feedback; PUT updates existing feedback.
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!isCustomer) return;

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...(editingId === null
          ? { booking_id: Number(form.booking_id) }
          : {}),
        rating: Number(form.rating),
        feedback: form.feedback.trim(),
        service_quality: form.service_quality,
      };

      const response = await fetch(
        editingId
          ? `/api/customer-feedback/${editingId}`
          : "/api/customer-feedback",
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
        throw new Error(
          data.message || "Unable to save feedback"
        );
      }

      setMessage(
        data.message ||
          (editingId
            ? "Feedback updated successfully"
            : "Feedback submitted successfully")
      );

      setForm(emptyForm);
      setEditingId(null);

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to save feedback"
      );
    } finally {
      setSaving(false);
    }
  }

  // DELETE removes the selected feedback record.
  async function handleDelete(feedbackId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this feedback?"
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/customer-feedback/${feedbackId}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to delete feedback"
        );
      }

      if (editingId === feedbackId) {
        setForm(emptyForm);
        setEditingId(null);
      }

      setMessage(
        data.message || "Feedback deleted successfully"
      );

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete feedback"
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
            <a
              href="/"
              className="text-sm text-blue-600 hover:underline"
            >
              ← Back to Dashboard
            </a>

            <h1 className="mt-3 text-3xl font-bold text-slate-800">
              My Customer Feedback
            </h1>

            <p className="mt-2 text-slate-500">
              Share your service experience and review your submitted feedback.
            </p>
          </div>

          <div className="rounded-xl bg-white px-6 py-4 shadow-sm">
            <p className="text-sm text-slate-500">
              My Feedback
            </p>

            <p className="text-2xl font-bold text-blue-700">
              {feedbackList.length}
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
            Loading your feedback...
          </div>
        ) : isCustomer ? (
          <>
            {/* Feedback Form */}
            <section className="mb-8 rounded-xl bg-white p-6 shadow-sm">
              <h2 className="mb-5 text-xl font-bold text-slate-800">
                {editingId
                  ? "Edit Your Feedback"
                  : "Submit Your Feedback"}
              </h2>

              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                  {/* Booking Selection */}
                  <div className="sm:col-span-2 lg:col-span-3">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Select Your Booking *
                    </label>

                    <select
                      name="booking_id"
                      value={form.booking_id}
                      onChange={handleChange}
                      required
                      disabled={editingId !== null}
                      className={inputClass}
                    >
                      <option value="">
                        Select your booking
                      </option>

                      {bookings.map((booking) => (
                        <option
                          key={booking.Booking_ID}
                          value={booking.Booking_ID}
                        >
                          Booking #{booking.Booking_ID} —{" "}
                          {booking.Registration_Number} —{" "}
                          {booking.Manufacturer} {booking.Model}
                          {" ("}
                          {booking.Booking_Status}
                          {")"}
                        </option>
                      ))}
                    </select>

                    {bookings.length === 0 && (
                      <p className="mt-2 text-sm text-amber-700">
                        You need a booking before submitting feedback.
                      </p>
                    )}
                  </div>

                  {/* Rating */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Rating *
                    </label>

                    <select
                      name="rating"
                      value={form.rating}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    >
                      <option value="5">5 - Excellent</option>
                      <option value="4">4 - Very Good</option>
                      <option value="3">3 - Good</option>
                      <option value="2">2 - Average</option>
                      <option value="1">1 - Poor</option>
                    </select>
                  </div>

                  {/* Service Quality */}
                  <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Service Quality *
                    </label>

                    <select
                      name="service_quality"
                      value={form.service_quality}
                      onChange={handleChange}
                      required
                      className={inputClass}
                    >
                      {qualityOptions.map((quality) => (
                        <option key={quality} value={quality}>
                          {quality}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Feedback Description */}
                  <div className="sm:col-span-2">
                    <label className="mb-2 block text-sm font-medium text-slate-700">
                      Your Feedback *
                    </label>

                    <textarea
                      name="feedback"
                      value={form.feedback}
                      onChange={handleChange}
                      required
                      minLength={1}
                      maxLength={1000}
                      rows={3}
                      placeholder="Describe your service experience..."
                      className={inputClass}
                    />

                    <p className="mt-1 text-xs text-slate-500">
                      Maximum 1000 characters.
                    </p>
                  </div>
                </div>

                {/* Rating Preview */}
                <div className="mt-5 rounded-lg bg-blue-50 p-4">
                  <p className="text-sm font-medium text-blue-800">
                    Selected Rating
                  </p>

                  <p className="mt-1 text-2xl text-yellow-500">
                    {"★".repeat(Number(form.rating))}
                    <span className="text-slate-300">
                      {"★".repeat(5 - Number(form.rating))}
                    </span>
                  </p>
                </div>

                {/* Form Buttons */}
                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="submit"
                    disabled={
                      saving ||
                      (editingId === null && bookings.length === 0)
                    }
                    className="rounded-lg bg-blue-600 px-6 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {saving
                      ? editingId
                        ? "Updating..."
                        : "Submitting..."
                      : editingId
                        ? "Update Feedback"
                        : "Submit Feedback"}
                  </button>

                  <button
                    type="button"
                    onClick={resetForm}
                    className="rounded-lg border border-slate-300 px-6 py-2.5 font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {editingId ? "Cancel Edit" : "Reset"}
                  </button>
                </div>
              </form>
            </section>

            {/* Feedback Records */}
            <section className="rounded-xl bg-white p-6 shadow-sm">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                <h2 className="text-xl font-bold text-slate-800">
                  My Feedback History
                </h2>

                <input
                  type="text"
                  placeholder="Search booking, rating or feedback..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2 text-slate-900 placeholder:text-slate-400 outline-none focus:border-blue-600 sm:w-96"
                />
              </div>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[1050px] text-left text-sm text-slate-800">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="p-3">Feedback ID</th>
                      <th className="p-3">Booking ID</th>
                      <th className="p-3">Rating</th>
                      <th className="p-3">Service Quality</th>
                      <th className="p-3">Feedback</th>
                      <th className="p-3">Submitted Date</th>
                      <th className="p-3">Actions</th>
                    </tr>
                  </thead>

                  <tbody>
                    {filteredFeedback.map((item) => (
                      <tr
                        key={item._id}
                        className="border-b border-slate-100 align-top hover:bg-slate-50"
                      >
                        <td className="p-3 font-medium">
                          {item._id.slice(-8)}
                        </td>

                        <td className="p-3">
                          #{item.booking_id}
                        </td>

                        <td className="p-3">
                          <span className="font-semibold text-yellow-600">
                            {"★".repeat(item.rating)}
                          </span>

                          <span className="text-slate-400">
                            {"★".repeat(5 - item.rating)}
                          </span>

                          <span className="ml-1 text-slate-600">
                            ({item.rating}/5)
                          </span>
                        </td>

                        <td className="p-3">
                          {item.service_quality}
                        </td>

                        <td className="max-w-[280px] whitespace-normal p-3">
                          {item.feedback}
                        </td>

                        <td className="p-3">
                          {item.submitted_at
                            ? new Date(
                                item.submitted_at
                              ).toLocaleDateString()
                            : "-"}
                        </td>

                        {/* Edit and Delete */}
                        <td className="p-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => startEdit(item)}
                              className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                            >
                              Edit
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleDelete(item._id)}
                              className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}

                    {filteredFeedback.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          className="p-8 text-center text-slate-500"
                        >
                          You have not submitted any feedback yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : (
          <div className="rounded-xl bg-white p-8 text-center text-slate-600 shadow-sm">
            Customer Feedback is available only to customer accounts.
          </div>
        )}
      </div>
    </main>
  );
}

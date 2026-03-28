"use client";

import { useState } from "react";

const fieldClasses =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

export default function StoreCreatePage() {
  const [submitting, setSubmitting] = useState(false);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-semibold text-slate-900">Create Store</h1>
      <p className="mt-2 text-slate-600">
        Fill out the details below to register a new store. All fields can be updated later from the
        dashboard.
      </p>

      <form
        action="/api/stores/create"
        method="POST"
        encType="multipart/form-data"
        className="mt-8 space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        onSubmit={() => setSubmitting(true)}
      >
        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="name">
              Store Name*
            </label>
            <input id="name" name="name" required className={fieldClasses} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="storeType">
              Store Type
            </label>
            <input id="storeType" name="storeType" placeholder="e.g. Retail" className={fieldClasses} />
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="address">
              Address*
            </label>
            <input id="address" name="address" required className={fieldClasses} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="region">
              Region
            </label>
            <input id="region" name="region" placeholder="e.g. Pacific Northwest" className={fieldClasses} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="managerId">
              Manager ID
            </label>
            <input
              id="managerId"
              name="managerId"
              type="number"
              min={1}
              className={fieldClasses}
              placeholder="123"
            />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="email">
              Email
            </label>
            <input id="email" name="email" type="email" placeholder="store@example.com" className={fieldClasses} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="phone">
              Phone
            </label>
            <input id="phone" name="phone" placeholder="+1 (555) 123-4567" className={fieldClasses} />
          </div>
        </section>

        <section className="space-y-2">
          <label className="block text-sm font-medium text-slate-700" htmlFor="photo">
            Store Photo
          </label>
          <input
            id="photo"
            name="photo"
            type="file"
            accept="image/*"
            className="w-full rounded border border-dashed border-slate-300 px-3 py-6 text-sm text-slate-600"
          />
          <p className="text-xs text-slate-500">Accepted formats: PNG, JPG, GIF. Max 10MB.</p>
        </section>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {submitting ? "Submitting..." : "Create Store"}
          </button>
        </div>
      </form>
    </main>
  );
}

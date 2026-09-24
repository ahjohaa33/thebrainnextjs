"use client";

import { useState } from "react";
import styles from "./ContactForm.module.css";

const initialForm = {
  name: "",
  phone: "",
  email: "",
  subject: "",
  message: "",
};

function validate(form) {
  const errors = {};

  if (!form.name.trim()) errors.name = "Please enter your name.";

  if (!form.phone.trim() && !form.email.trim()) {
    errors.phone = "Please share a phone number or email so we can reach you.";
  } else if (form.phone.trim() && !/^[\d+\-\s()]{6,20}$/.test(form.phone.trim())) {
    errors.phone = "Please enter a valid phone number.";
  }

  if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }

  if (!form.message.trim()) {
    errors.message = "Please write a short message.";
  } else if (form.message.trim().length < 10) {
    errors.message = "Please add a few more details (at least 10 characters).";
  }

  return errors;
}

export default function ContactForm() {
  const [form, setForm] = useState(initialForm);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  }

  function handleSubmit(event) {
    event.preventDefault();

    const nextErrors = validate(form);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) return;

    // NOTE: intentionally not sent anywhere. This form is presentation-only —
    // it just confirms receipt to the visitor. If real submission is ever
    // needed, wire this up to a backend endpoint (or a service like
    // Formspree/EmailJS) here.
    setSubmitting(true);
    window.setTimeout(() => {
      setSubmitting(false);
      setSubmitted(true);
    }, 700);
  }

  function handleReset() {
    setForm(initialForm);
    setErrors({});
    setSubmitted(false);
  }

  if (submitted) {
    return (
      <div className={styles.successPanel} role="status">
        <div className={styles.successIcon} aria-hidden="true">
          ✓
        </div>
        <h3>Thanks, {form.name.split(" ")[0] || "there"}!</h3>
        <p>
          Your message has been received. Our support team will get back to
          you shortly — for anything urgent, feel free to call or WhatsApp us
          directly using the details on this page.
        </p>
        <button type="button" className={styles.secondaryBtn} onClick={handleReset}>
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="contact-name">
            Full Name <span className={styles.required}>*</span>
          </label>
          <input
            id="contact-name"
            type="text"
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            className={errors.name ? styles.invalid : ""}
            placeholder="Your name"
            autoComplete="name"
          />
          {errors.name && <p className={styles.fieldError}>{errors.name}</p>}
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-phone">
            Phone Number <span className={styles.required}>*</span>
          </label>
          <input
            id="contact-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => updateField("phone", e.target.value)}
            className={errors.phone ? styles.invalid : ""}
            placeholder="01XXXXXXXXX"
            autoComplete="tel"
          />
          {errors.phone && <p className={styles.fieldError}>{errors.phone}</p>}
        </div>
      </div>

      <div className={styles.row}>
        <div className={styles.field}>
          <label htmlFor="contact-email">Email (optional)</label>
          <input
            id="contact-email"
            type="email"
            value={form.email}
            onChange={(e) => updateField("email", e.target.value)}
            className={errors.email ? styles.invalid : ""}
            placeholder="you@example.com"
            autoComplete="email"
          />
          {errors.email && <p className={styles.fieldError}>{errors.email}</p>}
        </div>

        <div className={styles.field}>
          <label htmlFor="contact-subject">Subject (optional)</label>
          <input
            id="contact-subject"
            type="text"
            value={form.subject}
            onChange={(e) => updateField("subject", e.target.value)}
            placeholder="e.g. Warranty question"
          />
        </div>
      </div>

      <div className={styles.field}>
        <label htmlFor="contact-message">
          Message <span className={styles.required}>*</span>
        </label>
        <textarea
          id="contact-message"
          rows={5}
          value={form.message}
          onChange={(e) => updateField("message", e.target.value)}
          className={errors.message ? styles.invalid : ""}
          placeholder="How can we help?"
        />
        {errors.message && <p className={styles.fieldError}>{errors.message}</p>}
      </div>

      <button type="submit" className={styles.submitBtn} disabled={submitting}>
        {submitting ? "Sending…" : "Send Message"}
      </button>
    </form>
  );
}

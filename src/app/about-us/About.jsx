"use client";

import { useEffect, useMemo, useState } from "react";
import "./aboutPage.css";

const ABOUT_API = "/api/about";

const FALLBACK_IMAGE = "https://backend.ponnobd.com/frontend/assets/IMG_5864.JPG";
const BACKEND_BASE_URL = "https://backend.ponnobd.com";

function decodeHtml(html = "") {
  if (typeof window === "undefined") {
    return String(html)
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/\s+/g, " ")
      .trim();
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = html;
  return textarea.value;
}

function cleanText(value = "") {
  return decodeHtml(String(value))
    .replace(/<\/?code>/gi, " ")
    .replace(/<\/?p[^>]*>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?strong[^>]*>/gi, "\n")
    .replace(/`/g, "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function splitIntoSentences(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?।])\s+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function chunkSentences(sentences = [], chunkSize = 2) {
  const chunks = [];

  for (let i = 0; i < sentences.length; i += chunkSize) {
    const chunk = sentences.slice(i, i + chunkSize).join(" ");
    if (chunk) chunks.push(chunk);
  }

  return chunks;
}

function getSignatureLines(text = "") {
  const marker = "Warm regards";
  const index = text.toLowerCase().indexOf(marker.toLowerCase());

  if (index === -1) {
    return [
      "Warm regards,",
      "Md Raquibul Islam (Rakib)",
      "Founder & CEO, Ponnobd Electronics",
      "Local Vice President of JCI Dhaka Pioneer",
    ];
  }

  return text
    .slice(index)
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function removeSignaturePart(text = "") {
  const index = text.toLowerCase().indexOf("warm regards");
  return index === -1 ? text : text.slice(0, index).trim();
}

function normalizeImageUrl(url) {
  if (!url) return FALLBACK_IMAGE;

  const value = String(url).trim();

  if (!value) return FALLBACK_IMAGE;
  if (/^https?:\/\//i.test(value)) return value;

  return `${BACKEND_BASE_URL}/${value.replace(/^\/+/, "")}`;
}

function normalizeAboutResponse(json) {
  return json?.data || json?.about || json || {};
}

export default function About() {
  const [about, setAbout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    async function loadAbout() {
      try {
        const response = await fetch(ABOUT_API, {
          signal: controller.signal,
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });

        if (!response.ok) {
          throw new Error(`About API failed with status ${response.status}`);
        }

        const json = await response.json();
        const data = normalizeAboutResponse(json);

        if (active) {
          setAbout(data);
          setErrorMessage("");
        }
      } catch (error) {
        if (error.name === "AbortError") return;

        console.error("Failed to load about page:", error);

        if (active) {
          setAbout({});
          setErrorMessage("Failed to load about page content.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadAbout();

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const content = useMemo(() => {
    const rawDescription = cleanText(about?.ceo_description || "");
    const withoutSignature = removeSignaturePart(rawDescription);

    const paragraphs = withoutSignature
      .split(/\n{2,}/)
      .map((item) => item.trim())
      .filter(Boolean);

    const allSentences = splitIntoSentences(withoutSignature);

    const lead =
     
      allSentences.slice(0, 3).join(" ") ||
      "I am Raquibul Islam, a passionate and forward-thinking entrepreneur from Bangladesh.";

    const tabPanel =
      paragraphs[1] ||
      allSentences.slice(3, 6).join(" ") ||
      "Personally, I am an avid reader of business books and magazines. I firmly believe that knowledge is power and I constantly strive to keep myself updated with the latest global trends.";

    const remainingSentences = allSentences.slice(6);

    const generatedCards = chunkSentences(
      remainingSentences.length ? remainingSentences : allSentences.slice(2),
      2
    );

    const blessing =
      allSentences.find((sentence) =>
        sentence.toLowerCase().includes("almighty bless")
      ) ||
      "May the Almighty bless us all with prosperity, growth, and success in every walk of life.";

    const messageCards = generatedCards
      .filter((card) => !card.toLowerCase().includes("warm regards"))
      .filter((card) => !card.toLowerCase().includes("may the almighty bless"))
      .slice(0, 5);

    return {
      heroTitle:
        about?.ceo_speech_title ||
        about?.meta?.title ||
        "Speech From CEO",

      sectionTitle:
        about?.about_title ||
        "Building Trust Through Innovation, Quality & Service",

      sectionSubtitle:
        about?.about_description ||
        "A message from the leadership of Ponnobd Electronics and Pentanik IT.",

      lead,
      tabPanel,
      messageCards,
      blessing,

      signatureLines: getSignatureLines(rawDescription),

      image: normalizeImageUrl(
        about?.about_thumbnail ||
          about?.image ||
          about?.thumbnail ||
          about?.ceo_image
      ),
    };
  }, [about]);

  if (loading) {
    return (
      <main className="about-loading">
        <p>Loading about page...</p>
      </main>
    );
  }

  return (
    <>
      <header className="about-hero">
        <div className="about-hero-content">
          <h1>Speech From CEO</h1>

          <div className="about-breadcrumb">
            Home <span>›</span> About
          </div>
        </div>
      </header>

      <main>
        {errorMessage ? (
          <div className="about-error">
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <section className="about-section">
          <div className="about-text">
            <div className="about-message-header">
              <span className="about-section-badge">CEO Message</span>
              <h2>{content.sectionTitle}</h2>
              <p>{content.sectionSubtitle}</p>
            </div>

            <p className="about-lead">{content.lead}</p>

            <div className="about-line" />

            <p className="about-tab-panel">{content.tabPanel}</p>
          </div>

          <div className="about-visual">
            <div className="about-portrait-card" aria-label="CEO image">
              <img
                className="about-ceo-image"
                src={content.image}
                alt="Md Raquibul Islam Rakib"
                loading="eager"
                decoding="async"
              />
            </div>

            <div className="about-online-card">
              <div className="about-online-head">
                <span>My Businesses</span>
              </div>

              <div className="about-person-row">
                <span className="about-avatar" />
                <span>Ponnobd Team</span>
                <span className="about-dots">•••</span>
              </div>

              <div className="about-person-row">
                <span className="about-avatar two" />
                <span>Pentanik IT</span>
                <span className="about-dots">•••</span>
              </div>

              <div className="about-person-row">
                <span className="about-avatar three" />
                <span>Servicebari</span>
                <span className="about-dots">•••</span>
              </div>
            </div>
          </div>
        </section>

        <section className="about-message-section">
          <div className="about-message-container">
            <div className="about-message-grid">
              {content.messageCards.map((card, index) => (
                <div
                  className={`about-message-card ${
                    index === content.messageCards.length - 1
                      ? "about-wide-card"
                      : ""
                  }`}
                  key={`${card.slice(0, 30)}-${index}`}
                >
                  <p>{card}</p>
                </div>
              ))}

              <div className="about-message-card about-blessing-card">
                <p>{content.blessing}</p>

                <div className="about-signature">
                  {content.signatureLines.map((line, index) =>
                    index === 0 ? (
                      <strong key={`${line}-${index}`}>{line}</strong>
                    ) : (
                      <span key={`${line}-${index}`}>{line}</span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
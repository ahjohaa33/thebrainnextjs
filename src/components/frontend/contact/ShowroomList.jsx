import { normalizePhoneForTel } from "@/lib/footer-data";
import styles from "./ShowroomList.module.css";

function PhoneIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1C10.61 21 3 13.39 3 4c0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.24.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
    </svg>
  );
}

export default function ShowroomList({ showrooms = [] }) {
  if (!showrooms.length) {
    return (
      <div className={styles.fallback}>
        <p>
          Our showroom details are being updated. In the meantime, please
          reach us by phone or WhatsApp using the contact details on this
          page and we&apos;ll help you find the nearest location.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.grid}>
      {showrooms.map((showroom, index) => (
        <div className={styles.card} key={`${showroom?.title || "showroom"}-${index}`}>
          <h3>{showroom?.title || "Showroom"}</h3>

          {showroom?.description ? (
            <p className={styles.address}>{showroom.description}</p>
          ) : null}

          {showroom?.phone_one ? (
            <a href={`tel:${normalizePhoneForTel(showroom.phone_one)}`} className={styles.phone}>
              <PhoneIcon />
              <span>{showroom.phone_one}</span>
            </a>
          ) : null}

          {showroom?.phone_two ? (
            <a href={`tel:${normalizePhoneForTel(showroom.phone_two)}`} className={styles.phone}>
              <PhoneIcon />
              <span>{showroom.phone_two}</span>
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}

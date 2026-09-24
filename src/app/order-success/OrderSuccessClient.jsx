"use client";

// Loaded only on this route — these used to be global in layout.js.
import "@/app/_styles/main.css";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import styles from "./orderSuccess.module.css";


function formatPrice(value) {
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function shippingLabel(value) {
  if (value === "inside_dhaka") return "Inside Dhaka";
  if (value === "outside_dhaka") return "Outside Dhaka";
  return value || "Not provided";
}

function getOrderTotal(orderData) {
  const details = orderData?.orderDetails || {};
  return (
    details.total ||
    details.grand_total ||
    details.payable_amount ||
    details.amount ||
    orderData?.response?.data?.order?.total ||
    orderData?.response?.order?.total ||
    orderData?.response?.total ||
    orderData?.response?.data?.total ||
    orderData?.subtotal ||
    0
  );
}

function getLinePrice(item) {
  if (item?.total_price || item?.line_total) {
    return Number(item.total_price || item.line_total || 0);
  }
  return Number(item?.price || item?.unit_price || 0) * Number(item?.quantity || item?.qty || 1);
}

export default function OrderSuccessClient() {
  const [orderData, setOrderData] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const storedOrder = window.sessionStorage.getItem("ponnobd_last_order");
      if (storedOrder) setOrderData(JSON.parse(storedOrder));
    } catch (error) {
      console.error("Could not read order success data:", error);
    } finally {
      setLoaded(true);
    }
  }, []);

  const items = useMemo(() => {
    const responseItems =
      orderData?.orderDetails?.items ||
      orderData?.orderDetails?.order_details ||
      orderData?.orderDetails?.orderDetails ||
      orderData?.response?.data?.order?.order_details ||
      orderData?.response?.data?.order?.orderDetails ||
      orderData?.response?.order?.order_details ||
      orderData?.response?.items ||
      orderData?.response?.data?.items ||
      orderData?.response?.data?.order_details ||
      [];
    return responseItems.length > 0 ? responseItems : orderData?.items || [];
  }, [orderData]);

  if (!loaded) {
    return (
      <main className={styles.page}>
        <div className="container"><div className={styles.card}>Loading order details…</div></div>
      </main>
    );
  }

  if (!orderData) {
    return (
      
     
        <main className={styles.page}>
          <div className="container">
            <div className={styles.card}>
              <h1 className={styles.title}>No recent order found</h1>
              <p className={styles.muted}>We could not find order details in this browser session.</p>
              <div className={styles.actions}>
                <Link href="/cart" className={styles.secondaryBtn}>Back to Cart</Link>
                <Link href="/" className={styles.primaryBtn}>Continue Shopping</Link>
              </div>
            </div>
          </div>
        </main>
    

    );
  }

  const customer = orderData.customer || {};
  const total = getOrderTotal(orderData);

  return (
    <>
  
      <main className={styles.page}>
        <div className="container">
          <div className={styles.successHero}>
            <div className={styles.checkIcon}>✓</div>
            <div>
              <h1 className={styles.title}>Order placed successfully</h1>
              <p className={styles.muted}>Thank you. Your order has been received.</p>
            </div>
          </div>

          <div className={styles.grid}>
            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Order Details</h2>
              <div className={styles.infoList}>
                <div><span>Order Number</span><strong>{orderData.orderNumber || "Pending"}</strong></div>
                <div><span>Payment Method</span><strong>Cash on Delivery</strong></div>
                <div><span>Shipping Method</span><strong>{shippingLabel(orderData.shippingType)}</strong></div>
                <div><span>Total</span><strong>{formatPrice(total)}</strong></div>
              </div>
            </section>

            <section className={styles.card}>
              <h2 className={styles.sectionTitle}>Customer Details</h2>
              <div className={styles.infoList}>
                <div><span>Name</span><strong>{customer.name || "Not provided"}</strong></div>
                <div><span>Phone</span><strong>{customer.phone || "Not provided"}</strong></div>
                <div><span>Address</span><strong>{customer.address || "Not provided"}</strong></div>
                {customer.notes ? <div><span>Order Notes</span><strong>{customer.notes}</strong></div> : null}
              </div>
            </section>
          </div>

          <section className={styles.card}>
            <h2 className={styles.sectionTitle}>Ordered Products</h2>
            {items.length > 0 ? (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead><tr><th>Product</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
                  <tbody>
                    {items.map((item, index) => {
                      const product = item.product || {};
                      const productName = product.name || item.product_name || item.name || `Product ${index + 1}`;
                      const quantity = Number(item.quantity || item.qty || 1);
                      const price = Number(item.price || item.unit_price || 0);
                      const lineTotal = getLinePrice({ ...item, quantity, price });
                      return (
                        <tr key={item.id || item.cart_id || `${productName}-${index}`}>
                          <td>{productName}</td><td>{quantity}</td><td>{formatPrice(price)}</td><td>{formatPrice(lineTotal)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : <p className={styles.muted}>No product detail was returned for this order.</p>}
          </section>

          <div className={styles.actions}>
            <Link href="/" className={styles.primaryBtn}>Continue Shopping</Link>
            <Link href="/cart" className={styles.secondaryBtn}>Back to Cart</Link>
          </div>
        </div>
      </main>
    </>

  );
}

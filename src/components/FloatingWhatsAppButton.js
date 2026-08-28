import React from "react";
import { useShopContext } from "../context/ShopContext"; // Import ShopContext for region check
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./FloatingWhatsAppButton.css";

function FloatingWhatsAppButton() {
  const { shopRegion } = useShopContext(); // Use shop context to get the current region

  const whatsappUrl =
    shopRegion === "US"
      ? "https://wa.me/18452698649"
      : "https://wa.me/+972534309254";
  
  return (
    <div className="floating-whatsapp-button">
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="whatsapp-button"
      >
        <i className="fa-brands fa-whatsapp" /> WhatsApp Us
      </a>
    </div>
  );
}

export default FloatingWhatsAppButton;

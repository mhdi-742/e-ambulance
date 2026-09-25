import "./globals.css";

export const metadata = {
  title: "E-Ambulance",
  description: "Emergency Ambulance Service - Raiganj",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  );
}

import './globals.css';
import { SocketProvider } from '../context/SocketContext';

export const metadata = {
  title: 'FRAME Watch Party - Synchronized Real-Time Cinema',
  description: 'Synchronized media streaming platform powered by Next.js, Socket.io, and Redis NTP clock sync.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-ink text-app-text antialiased selection:bg-accent selection:text-accent-ink">
        <SocketProvider>
          {children}
        </SocketProvider>
      </body>
    </html>
  );
}

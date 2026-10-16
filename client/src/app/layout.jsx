import './globals.css';
import { SocketProvider } from '../context/SocketContext';

export const metadata = {
  title: 'FRAME Watch Party',
  description: 'Watch movies together in perfect sync — NTP clock sync, drift correction, shared queue, chat and reactions.',
};

export const viewport = {
  themeColor: '#0B0F19',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-ink text-app-text antialiased selection:bg-accent selection:text-white">
        <SocketProvider>{children}</SocketProvider>
      </body>
    </html>
  );
}

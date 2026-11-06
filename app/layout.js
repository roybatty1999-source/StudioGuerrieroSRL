export const metadata = {
  title: 'Intrastat PDF Extractor',
  description: 'Estrazione dati fatture con IA',
}

export default function RootLayout({ children }) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  )
}

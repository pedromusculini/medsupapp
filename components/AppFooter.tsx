import Link from 'next/link';

export default function AppFooter() {
  return (
    <footer className="border-t border-gray-200 bg-white px-4 py-6 md:px-8">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-center text-sm text-gray-600 sm:flex-row sm:text-left">
        <p>
          © {new Date().getFullYear()} MedSupAPP · Medical Super Application
        </p>
        <p>
          Suporte:{' '}
          <a
            href="mailto:suporte@medsupapp.com.br"
            className="font-medium text-[#228B22] hover:text-[#013a01] hover:underline"
          >
            suporte@medsupapp.com.br
          </a>
        </p>
      </div>
    </footer>
  );
}

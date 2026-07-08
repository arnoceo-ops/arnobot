export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .admin-nav {
            display: flex !important;
            height: auto !important;
            padding: 10px 12px !important;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            gap: 0;
          }
          .admin-nav::-webkit-scrollbar { display: none; }
          .admin-nav-spacer { display: none !important; }
          .admin-nav-center { flex-shrink: 0; justify-content: flex-start !important; }
          .admin-nav-right { flex-shrink: 0; margin-left: 16px; }
          .admin-content { padding: 24px 16px !important; }
          .admin-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        }
      `}</style>
      {children}
    </>
  )
}

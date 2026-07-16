import Link from 'next/link'

export default function SiteFooter() {
  return (
    <>
      <style>{`
        .site-footer { background: #0d1117; padding: 56px 60px 32px; border-top: 1px solid #1f2937; }
        .site-footer-inner {
          max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: repeat(3, 1fr);
          gap: 32px; padding-bottom: 40px; border-bottom: 1px solid #1f2937;
        }
        .site-footer-heading {
          font-family: 'DM Sans', sans-serif; font-size: 13px; letter-spacing: 3px;
          text-transform: uppercase; color: #f59e0b; margin-bottom: 16px;
        }
        .site-footer-col { display: flex; flex-direction: column; gap: 12px; }
        .site-footer-col a {
          font-family: 'DM Sans', sans-serif; font-size: 15px; color: #9ca3af;
          text-decoration: none; transition: color 0.2s;
        }
        .site-footer-col a:hover { color: #f1f5f9; }
        .site-footer-bottom {
          max-width: 1000px; margin: 24px auto 0; display: grid; grid-template-columns: 1fr auto 1fr;
          align-items: center;
        }
        .footer-logo { font-family: 'Bebas Neue', sans-serif; font-size: 24px; color: #f59e0b; letter-spacing: 3px; text-decoration: none; }
        .footer-copy { font-family: 'DM Sans', sans-serif; font-size: 15px; color: #9ca3af; }

        @media (max-width: 768px) {
          .site-footer { padding: 40px 24px 24px; }
          .site-footer-inner { grid-template-columns: 1fr; gap: 28px; text-align: center; }
          .site-footer-bottom { grid-template-columns: 1fr; gap: 12px; text-align: center; }
        }
      `}</style>
      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-col">
            <p className="site-footer-heading">Product</p>
            <Link href="/prijzen">Prijzen</Link>
            <Link href="/#hoe-het-werkt">Hoe het werkt</Link>
            <Link href="/#faq">Veelgestelde vragen</Link>
          </div>
          <div className="site-footer-col">
            <p className="site-footer-heading">Bedrijf</p>
            <a href="https://arno.blog/bio">Over Arno</a>
            <a href="mailto:arno@arno.bot">Contact</a>
            <a href="https://arno.blog">Blog</a>
          </div>
          <div className="site-footer-col">
            <p className="site-footer-heading">Juridisch</p>
            <Link href="/privacy">Privacy</Link>
            <Link href="/voorwaarden">Voorwaarden</Link>
            <a href="/arnobot-beveiliging.pdf">Beveiliging</a>
          </div>
        </div>
        <div className="site-footer-bottom">
          <Link href="/" className="footer-logo">ARNOBOT.</Link>
          <span />
          <span className="footer-copy" style={{ textAlign: 'right' }}>© 2026 ArnoBot</span>
        </div>
      </footer>
    </>
  )
}

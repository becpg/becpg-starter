"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Recipes" },
  { href: "/raw-materials", label: "Raw materials" },
  { href: "/new", label: "New recipe" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" || pathname.startsWith("/products") : pathname.startsWith(href));

  return (
    <aside className="sidebar">
      <Link href="/" className="brand">
        <img src="/symbol.svg" alt="" />
        <span>
          <b>beCPG</b>
          <small>Product studio</small>
        </span>
      </Link>
      <nav className="nav">
        {LINKS.map((link) => (
          <Link key={link.href} href={link.href} className={isActive(link.href) ? "active" : ""}>
            {link.label}
          </Link>
        ))}
      </nav>
      <div className="upsell">
        <span className="edition">beCPG Community</span>
        <b>Go further with beCPG Enterprise</b>
        <ul>
          <li>Regulatory checks on 90+ markets</li>
          <li>Reference data, ready to use</li>
          <li>Pre-configured AI agents</li>
        </ul>
        <a className="button" href="https://www.becpg.net/contact-us/" target="_blank" rel="noreferrer">
          Request a demo
        </a>
      </div>
    </aside>
  );
}

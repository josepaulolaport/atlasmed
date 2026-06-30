"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/territories", label: "Explorer" },
  { href: "/territories/types", label: "Types" },
  { href: "/territories/ambiguous-parents", label: "Ambiguous parents" },
  { href: "/territories/approvals", label: "Approvals" },
  { href: "/territories/unassigned-facilities", label: "Unassigned clinics" },
];

export function TerritorySubnav() {
  const pathname = usePathname();

  return (
    <nav className="mb-6 flex flex-wrap gap-2 border-b border-gray-200 pb-3">
      {links.map((link) => {
        const isActive =
          link.href === "/territories"
            ? pathname === "/territories"
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium",
              isActive
                ? "bg-blue-50 text-blue-700"
                : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

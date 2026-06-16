"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  User,
  Settings,
  Shield,
  LogOut,
  Users,
  Activity,
  Menu,
  Building2,
  Stethoscope,
} from "lucide-react";
import { cn, getInitials } from "@/lib/utils";
import {
  canManageUsers,
  canReadClinics,
  canReadDoctors,
  canViewHealth,
  hasMinimumRole,
} from "@/lib/permissions";

export function Navbar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!user || !user.role) return null;

  const navigation = [
    { name: "Dashboard", href: "/dashboard", icon: Activity },
    { name: "Profile", href: "/profile", icon: User },
    { name: "Sessions", href: "/sessions", icon: Shield },
    ...(canManageUsers(user.role.name)
      ? [{ name: "Users", href: "/users", icon: Users }]
      : []),
    ...(canReadClinics(user.role.name)
      ? [{ name: "Clinics", href: "/clinics", icon: Building2 }]
      : []),
    ...(canReadDoctors(user.role.name)
      ? [{ name: "Doctors", href: "/doctors", icon: Stethoscope }]
      : []),
    ...(hasMinimumRole(user.role.name, "MANAGER")
      ? [{ name: "Registry", href: "/registry-suggestions", icon: Shield }]
      : []),
    ...(canViewHealth(user.role.name)
      ? [{ name: "Health", href: "/health", icon: Activity }]
      : []),
  ];

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 justify-between">
          <div className="flex">
            <Link href="/dashboard" className="flex flex-shrink-0 items-center">
              <span className="text-2xl font-bold text-blue-600">AtlasMed</span>
            </Link>
            <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
              {navigation.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center border-b-2 px-1 pt-1 text-sm font-medium",
                      isActive
                        ? "border-blue-600 text-gray-900"
                        : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                    )}
                  >
                    <item.icon className="mr-2 h-4 w-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Badge variant="secondary" className="hidden sm:inline-flex">
              {user.role.name}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar>
                    <AvatarImage src={user.avatarUrl} alt={user.username} />
                    <AvatarFallback>
                      {getInitials(user.firstName, user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.firstName && user.lastName
                        ? `${user.firstName} ${user.lastName}`
                        : user.username}
                    </p>
                    <p className="text-xs leading-none text-gray-500">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/sessions">
                    <Shield className="mr-2 h-4 w-4" />
                    Sessions
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/security">
                    <Settings className="mr-2 h-4 w-4" />
                    Security
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="icon" className="sm:hidden">
              <Menu className="h-6 w-6" />
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}

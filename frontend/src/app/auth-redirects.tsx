"use client"

import { useAuth } from "../../lib/auth-context";
import { useRouter, usePathname } from "next/navigation";
import { useEffect } from "react";

export default function AuthRedirects() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Define public pages (auth pages)
    const publicPages = ['/auth/signin', '/auth/signup'];
    
    const isPublicPage = publicPages.includes(pathname);

    if (user && isPublicPage) {
      router.push('/');
    }
    // No other redirects needed - home page handles both authenticated and unauthenticated users
  }, [user, loading, router, pathname]);

  return null;
} 
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Loader2, LogOut } from 'lucide-react'

export function LogoutButton() {
  const [loading, setLoading] = useState(false)

  async function handleLogout() {
    setLoading(true)
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleLogout} disabled={loading}>
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <LogOut className="mr-1.5 h-4 w-4" />
          Abmelden
        </>
      )}
    </Button>
  )
}

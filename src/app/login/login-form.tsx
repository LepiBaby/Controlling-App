'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Bitte eine gültige E-Mail-Adresse eingeben'),
})

type FormData = z.infer<typeof schema>

interface LoginFormProps {
  next?: string
}

export function LoginForm({ next }: LoginFormProps) {
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  async function onSubmit({ email }: FormData) {
    setStatus('idle')
    setErrorMessage('')

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      setStatus('error')
      setErrorMessage('Ein Fehler ist aufgetreten. Bitte versuche es erneut.')
    } else {
      setStatus('success')
    }
  }

  if (status === 'success') {
    return (
      <Card className="w-full max-w-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
            <h2 className="text-lg font-semibold">Link verschickt!</h2>
            <p className="text-sm text-muted-foreground">
              Falls diese E-Mail registriert ist, wurde ein Login-Link verschickt.
              Bitte überprüfe dein Postfach.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Anmelden</CardTitle>
        <CardDescription>
          Gib deine E-Mail-Adresse ein. Wir senden dir einen Login-Link.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form noValidate onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">E-Mail-Adresse</Label>
            <Input
              id="email"
              type="email"
              placeholder="deine@email.de"
              autoComplete="email"
              autoFocus
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          {status === 'error' && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{errorMessage}</AlertDescription>
            </Alert>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Wird gesendet…
              </>
            ) : (
              'Magic Link senden'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}

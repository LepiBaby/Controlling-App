import { LoginForm } from './login-form'

interface LoginPageProps {
  searchParams: Promise<{ next?: string; error?: string }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next, error } = await searchParams

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/40 p-4">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Controlling App</h1>
        <p className="mt-1 text-sm text-muted-foreground">Interne Finanzplattform</p>
      </div>

      {error === 'auth_error' && (
        <div className="mb-4 w-full max-w-sm rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Der Login-Link ist ungültig oder bereits verwendet. Bitte fordere einen neuen an.
        </div>
      )}

      {error === 'session_expired' && (
        <div className="mb-4 w-full max-w-sm rounded-md border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Deine Session ist abgelaufen. Bitte melde dich erneut an.
        </div>
      )}

      <LoginForm next={next} />
    </div>
  )
}

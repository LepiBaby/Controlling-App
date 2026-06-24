// Dev-only guard against spurious `write EPIPE` crashes in the Next.js 16 / Turbopack dev server.
//
// Symptom: pages (esp. deep dynamic routes like /dashboard/langfristige-planung/[versionId]/...)
// intermittently 500 with "Jest worker encountered N child process exceptions, exceeding retry
// limit". The underlying cause is a `write EPIPE` raised as an *uncaughtException*: the dev server
// (or its render worker) writes to a stdout/IPC pipe whose read end has already closed. Next does
// not catch it, so the render worker child process dies; after two deaths Next gives up -> 500.
//
// This file is preloaded via NODE_OPTIONS=--require, so it runs in *every* dev node process,
// including the jest-worker children (NODE_OPTIONS is inherited by forked processes). It swallows
// EPIPE and preserves Node's default crash behavior for every other uncaught error.

const isEpipe = (err) => Boolean(err) && err.code === 'EPIPE'

// EPIPE most commonly surfaces on the std streams when the consuming terminal/pipe goes away.
process.stdout.on('error', (err) => {
  if (!isEpipe(err)) throw err
})
process.stderr.on('error', (err) => {
  if (!isEpipe(err)) throw err
})

// The worker IPC pipe (and anything else) surfaces EPIPE as an uncaughtException instead.
process.on('uncaughtException', (err) => {
  if (isEpipe(err)) return
  // Mirror Node's default behavior for genuine uncaught exceptions.
  console.error(err)
  process.exit(1)
})

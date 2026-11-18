import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim()
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()

if (!supabaseUrl || !supabasePublishableKey) {
  const missingVariables = [
    !supabaseUrl && 'VITE_SUPABASE_URL',
    !supabasePublishableKey && 'VITE_SUPABASE_PUBLISHABLE_KEY',
  ].filter(Boolean)

  throw new Error(
    `Supabase configuration is incomplete. Set ${missingVariables.join(' and ')} in .env.local.`,
  )
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey)

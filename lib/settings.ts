import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function getSetting(key: string): Promise<boolean> {
  const { data } = await supabase.from('arnobot_settings').select('value').eq('key', key).maybeSingle()
  return data?.value ?? false
}

export async function setSetting(key: string, value: boolean): Promise<void> {
  await supabase.from('arnobot_settings').upsert({ key, value, updated_at: new Date().toISOString() })
}

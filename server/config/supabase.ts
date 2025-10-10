import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://miswjgxxtegiltbnyalz.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1pc3dqZ3h4dGVnaWx0Ym55YWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3MjU5NjcsImV4cCI6MjA3NTMwMTk2N30.QFVOgbzgAuwI-2N2Lojt2vUCW-B3Yuc_6s4pXi52QPo';

export const supabase = createClient(supabaseUrl, supabaseKey);

// Test Supabase connection
export async function testSupabaseConnection(): Promise<void> {
  try {
    const { data, error } = await supabase.from('_prisma_migrations').select('*').limit(1);
    if (error && error.code !== 'PGRST116') { // PGRST116 is "relation does not exist" which is expected for new databases
      console.log('✅ Supabase connection successful');
    } else {
      console.log('✅ Supabase connection successful (no migrations table yet)');
    }
  } catch (error) {
    console.error('❌ Supabase connection failed:', error);
    throw error;
  }
}

export default supabase;

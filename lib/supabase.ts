import { createClient } from "@supabase/supabase-js";

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://nevunhoetcgydhmswvqf.supabase.co";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ldnVuaG9ldGNneWRobXN3dnFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDU4NjQzMTksImV4cCI6MjA2MTQ0MDMxOX0.QEFJTjg5c8JJI1_w4we3DUFWlmrDTLFyRjwXDTE-wU4";

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseKey);
'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'

export async function createTeacher(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const name = formData.get('name') as string

    if (!email || !password || !name) {
        return { error: 'All fields are required' }
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // 1. Create Auth User via direct REST API for better error visibility
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${serviceKey}`,
            'apikey': serviceKey,
        },
        body: JSON.stringify({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                role: 'teacher'
            }
        })
    })

    const authResult = await authResponse.json()
    console.log('Auth API Response Status:', authResponse.status)
    console.log('Auth API Response:', JSON.stringify(authResult, null, 2))

    if (!authResponse.ok) {
        // If user already exists, try to find them
        if (authResult?.msg?.includes('already') || authResult?.message?.includes('already')) {
            return { error: 'A user with this email already exists' }
        }
        const errMsg = authResult?.msg || authResult?.message || authResult?.error_description || JSON.stringify(authResult)
        return { error: `Auth error (${authResponse.status}): ${errMsg}` }
    }

    const userId = authResult?.id
    if (!userId) {
        return { error: 'User created but no ID returned' }
    }

    // 2. Create/Update Profile using admin client (bypasses RLS)
    const supabase = createAdminClient()
    const { error: profileError } = await supabase.from('profiles').upsert({
        id: userId,
        email,
        full_name: name,
        role: 'teacher'
    }, { onConflict: 'id' })

    if (profileError) {
        console.error('Profile Error:', JSON.stringify(profileError, null, 2))
        return { error: 'User created but profile failed: ' + profileError.message }
    }

    revalidatePath('/admin/teachers')
    return { success: true }
}

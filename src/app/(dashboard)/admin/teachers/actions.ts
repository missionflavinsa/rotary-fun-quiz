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

    const supabase = createAdminClient()

    // 1. Create Auth User
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name }
    })

    if (authError) {
        console.error('Auth Error:', authError)
        return { error: authError.message }
    }

    if (!authData.user) {
        return { error: 'Failed to create user' }
    }

    // 2. Create Profile
    // Note: Trigger might handle this in production, but we'll do it explicitly here as per schema policies
    const { error: profileError } = await supabase.from('profiles').insert({
        id: authData.user.id,
        email,
        full_name: name,
        role: 'teacher'
    })

    if (profileError) {
        console.error('Profile Error:', profileError)
        // Cleanup auth user if profile fails? 
        // For now return error
        return { error: 'User created but profile failed: ' + profileError.message }
    }

    revalidatePath('/admin/teachers')
    return { success: true }
}

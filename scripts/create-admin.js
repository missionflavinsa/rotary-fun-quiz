const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
)

async function createAdmin() {
    const email = 'admin@gmail.com'
    const password = 'Rotary@123'

    console.log(`Attempting to create user: ${email}`)

    const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'admin' } // Correct metadata if needed
    })

    if (error) {
        console.error('Error creating user:', error.message)
    } else {
        console.log('User created successfully:', data.user.id)

        // Also insert into profiles if needed (though our trigger/logic might handle it or we do it manual)
        const { error: profileError } = await supabase.from('profiles').insert({
            id: data.user.id,
            email: email,
            role: 'admin',
            full_name: 'Super Admin'
        })

        if (profileError) console.error('Error creating profile:', profileError.message)
        else console.log('Profile created successfully')
    }
}

createAdmin()

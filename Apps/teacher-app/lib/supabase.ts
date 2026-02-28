import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'
import { Platform } from 'react-native'

const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').trim()
const supabaseAnonKey = (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '').trim()

// Custom storage adapter to handle SSR/Build environment safely
const ExpoStorage = {
    getItem: (key: string) => {
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return Promise.resolve(null)
        }
        return AsyncStorage.getItem(key)
    },
    setItem: (key: string, value: string) => {
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return Promise.resolve()
        }
        return AsyncStorage.setItem(key, value)
    },
    removeItem: (key: string) => {
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return Promise.resolve()
        }
        return AsyncStorage.removeItem(key)
    },
}

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Missing Supabase environment variables! URL:', supabaseUrl ? 'set' : 'MISSING', 'Key:', supabaseAnonKey ? 'set' : 'MISSING')
}

// Custom storage adapter that handles SSR safely
const customStorage = {
    getItem: async (key: string): Promise<string | null> => {
        // Check if we're in a browser environment
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return null
        }
        return AsyncStorage.getItem(key)
    },
    setItem: async (key: string, value: string): Promise<void> => {
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return
        }
        await AsyncStorage.setItem(key, value)
    },
    removeItem: async (key: string): Promise<void> => {
        if (Platform.OS === 'web' && typeof window === 'undefined') {
            return
        }
        await AsyncStorage.removeItem(key)
    },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: customStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
    },
})

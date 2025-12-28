/**
 * User Session Management Utilities
 * Handles user authentication state and session data
 */

import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'
import { cache } from 'react'

/**
 * Get the current authenticated user
 * Cached for the duration of the request
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error) {
      console.error('Error fetching user:', error)
      return null
    }

    return user
  } catch (error) {
    console.error('Unexpected error fetching user:', error)
    return null
  }
})

/**
 * Get the current session
 */
export async function getSession() {
  const supabase = await createClient()
  
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error('Error fetching session:', error)
      return null
    }

    return session
  } catch (error) {
    console.error('Unexpected error fetching session:', error)
    return null
  }
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser()
  return user !== null
}

/**
 * Get user metadata
 */
export async function getUserMetadata() {
  const user = await getCurrentUser()
  return user?.user_metadata ?? null
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const supabase = await createClient()
  
  try {
    const { error } = await supabase.auth.signOut()
    
    if (error) {
      console.error('Error signing out:', error)
      throw error
    }
  } catch (error) {
    console.error('Unexpected error signing out:', error)
    throw error
  }
}














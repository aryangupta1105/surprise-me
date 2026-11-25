import { NextResponse } from 'next/server'
import { route } from '@/lib/http'
import { completeSignIn } from '@/server/accounts'

/** 36Blocks redirects here with ?proxy_auth_token=… after sign-in. */
export const GET = route(async (req) => {
  const token = req.nextUrl.searchParams.get('proxy_auth_token')
  if (!token) return NextResponse.redirect(new URL('/account?error=missing', req.url))
  await completeSignIn(token)
  return NextResponse.redirect(new URL('/dashboard?welcome=1', req.url))
})

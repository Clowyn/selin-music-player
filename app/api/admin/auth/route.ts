import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { password } = await request.json();
    
    if (password === process.env.ADMIN_PASSWORD) {
      return NextResponse.json({ authenticated: true });
    }
    
    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch {
    return NextResponse.json({ authenticated: false, error: 'Bad Request' }, { status: 400 });
  }
}

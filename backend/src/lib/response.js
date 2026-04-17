import { NextResponse } from 'next/server';

export function success(msg, data) {
  const payload = { code: 200, msg };
  if (typeof data !== 'undefined') {
    payload.data = data;
  }
  return NextResponse.json(payload);
}

export function bizError(code, msg, details) {
  const payload = { code, msg };
  if (typeof details !== 'undefined') {
    payload.details = details;
  }
  return NextResponse.json(payload, { status: code });
}

export function httpError(status, msg) {
  return NextResponse.json({ code: status, msg }, { status });
}

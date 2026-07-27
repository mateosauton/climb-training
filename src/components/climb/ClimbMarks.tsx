import type { SVGProps } from "react";

export function RopeKnotMark(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}><path d="M10 25c0-9 9-15 17-11 7 3 9 12 4 17-5 6-16 4-17-4-1-6 8-10 13-6 4 3 3 9-2 10-4 1-7-3-5-6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/><path d="m8 33 8-6m24-12-8 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/></svg>;
}

export function RouteTraceMark(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}><path d="M16 53c3-14 7-10 10-23 3-12 12-6 15-18 2-7 5-10 8-13" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/><circle cx="13" cy="55" r="4" fill="currentColor"/><circle cx="28" cy="29" r="4" fill="currentColor"/><circle cx="44" cy="18" r="4" fill="currentColor"/><path d="M50 8h9v9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

export function HoldMark(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" {...props}><path d="M12 42c3-17 10-27 23-30 9-2 18 4 17 13-1 8-9 7-10 14-1 7-7 13-16 12-9 0-16-2-14-9Z" fill="currentColor" opacity=".16"/><path d="M12 42c3-17 10-27 23-30 9-2 18 4 17 13-1 8-9 7-10 14-1 7-7 13-16 12-9 0-16-2-14-9Z" stroke="currentColor" strokeWidth="2"/><circle cx="34" cy="30" r="5" stroke="currentColor" strokeWidth="2"/></svg>;
}

export function CairnMark(props: SVGProps<SVGSVGElement>) {
  return <svg viewBox="0 0 48 48" fill="none" aria-hidden="true" {...props}><path d="M14 37c0-6 4-10 10-10s10 4 10 10H14Z" fill="currentColor" opacity=".2"/><path d="M17 27c0-5 3-8 7-8s7 3 7 8H17Zm3-9c0-4 2-7 4-7s4 3 4 7h-8Z" fill="currentColor" opacity=".55"/><path d="M10 39h28" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>;
}
